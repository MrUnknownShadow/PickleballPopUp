const db = require("./db");
const { sendSmsToUser, log } = require("./sms");
const { parseDays, dayList } = require("./days");
const { getSettings, fill } = require("./settings");
const { parts, addDays, weekStartFor, zonedToUtc } = require("./tz");

const DAYS = [1, 2, 3, 4, 5];
const toList = (s) => (s ? s.split(",").map(Number) : []);
const toStr = (days) => [...new Set(days)].sort().join(",");
const link = () => `${process.env.PUBLIC_BASE_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || 3001}`}/schedule`;
const range = (weekStart) => {
  const f = (ymd) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return `${f(weekStart)} - ${f(addDays(weekStart, 4))}`;
};
const textable = `SELECT UID AS uid, Username AS username, PhoneNumber AS phonenumber, SmsOptIn AS smsoptin FROM Users WHERE SmsOptIn = TRUE AND PhoneNumber IS NOT NULL`;

/* ---------- Sunday blast ---------- */

// Texts every opted-in player the weekly question. One poll per week: the row is claimed first, so a restart
// or a second tick can never send it twice.
async function sendBlast(weekStart) {
  const s = await getSettings();
  const sentAt = new Date();
  const { rows } = await db.query(
    "INSERT INTO WeeklyPolls (WeekStart, SentAt, CutoffAt) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING WeekStart",
    [weekStart, sentAt, new Date(sentAt.getTime() + Number(s.cutoff_hours) * 3600e3)]
  );
  if (!rows.length) return { alreadySent: true, sent: 0 };
  const { rows: users } = await db.query(textable);
  const text = fill(s.blast_text, { range: range(weekStart) });
  for (const u of users) await sendSmsToUser(u, text, { kind: "week_blast" });
  return { alreadySent: false, sent: users.length };
}

// Runs every minute. Sunday after blast_time, and only when the admin switched automatic sending on.
async function tick() {
  const s = await getSettings();
  if (s.blast_auto !== "1") return;
  const p = parts();
  const [h, m] = s.blast_time.split(":").map(Number);
  if (p.dow !== 0 || p.h * 60 + p.min < h * 60 + m) return;
  await sendBlast(addDays(p.ymd, 1));
}

/* ---------- replies ---------- */

// The poll that a reply right now belongs to: the latest one whose week has not ended.
async function openPoll() {
  const { rows } = await db.query(
    "SELECT WeekStart AS weekstart, CutoffAt AS cutoffat FROM WeeklyPolls WHERE WeekStart >= $1 AND WeekStart <= $2 ORDER BY WeekStart DESC LIMIT 1",
    [addDays(parts().ymd, -5), addDays(parts().ymd, 7)]
  );
  return rows[0] || null;
}

async function saveAvailability(weekStart, uid, kind, days, raw, late = false) {
  await db.query(
    `INSERT INTO Availability (WeekStart, UID, Days, Status, Raw, Late, UpdatedAt) VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (WeekStart, UID) DO UPDATE SET Days = $3, Status = $4, Raw = $5, Late = $6, UpdatedAt = NOW()`,
    [weekStart, uid, toStr(days), kind, raw, late]
  );
}

// Returns true when the reply was an answer to the weekly question (so the caller stops there).
async function handleReply(user, text) {
  const poll = await openPoll();
  if (!poll) return false;
  const s = await getSettings();
  const r = parseDays(text);
  const late = new Date() > new Date(poll.cutoffat);
  await saveAvailability(poll.weekstart, user.uid, r.kind, r.days, text, late && r.kind !== "unclear");
  if (r.kind === "unclear") {
    if (s.ack_replies === "1") await sendSmsToUser(user, s.unclear_text, { kind: "week_reply" });
  } else if (!late && s.ack_replies === "1") {
    await sendSmsToUser(user, r.kind === "none" ? s.ack_none_text : fill(s.ack_days_text, { days: dayList(r.days) }), { kind: "week_reply" });
  } // late replies get no text; the admin still sees them
  return true;
}

/* ---------- admin dashboard ---------- */

async function getWeek(weekStart) {
  const { rows: pollRows } = await db.query("SELECT SentAt AS sentat, CutoffAt AS cutoffat FROM WeeklyPolls WHERE WeekStart = $1", [weekStart]);
  const { rows: av } = await db.query(
    `SELECT Availability.UID AS uid, Users.Username AS username, Days AS days, Status AS status, Raw AS raw, Late AS late
     FROM Availability JOIN Users ON Users.UID = Availability.UID WHERE WeekStart = $1 ORDER BY Users.Username`,
    [weekStart]
  );
  const { rows: games } = await db.query(
    "SELECT GID AS gid, PollDay AS day, GameTime AS gametime, Location AS location FROM Games WHERE PollWeek = $1", [weekStart]
  );
  const { rows: sel } = await db.query(
    `SELECT Games.PollDay AS day, GamePlayers.UID AS uid FROM GamePlayers JOIN Games ON Games.GID = GamePlayers.GID
     WHERE Games.PollWeek = $1 AND GamePlayers.Status = 'selected'`, [weekStart]
  );
  const chosen = new Set(sel.map((x) => `${x.day}:${x.uid}`));
  const { rows: everyone } = await db.query(
    `SELECT UID AS uid, Username AS username, SmsOptIn AS smsoptin, RIGHT(PhoneNumber, 4) AS phonelast4 FROM Users WHERE SmsOptIn = TRUE AND PhoneNumber IS NOT NULL ORDER BY Username`
  );
  const answered = new Set(av.map((a) => a.uid));
  const days = Object.fromEntries(DAYS.map((d) => [d, []]));
  for (const a of av) if (a.status !== "unclear") for (const d of toList(a.days)) days[d]?.push({ uid: a.uid, username: a.username, confirmed: chosen.has(`${d}:${a.uid}`), late: a.late });
  const s = await getSettings();
  return {
    weekStart, range: range(weekStart), poll: pollRows[0] || null, settings: s, days,
    games: Object.fromEntries(DAYS.map((d) => { const g = games.find((x) => x.day === d); return [d, g ? { gid: g.gid, time: g.gametime, location: g.location } : null]; })),
    none: av.filter((a) => a.status === "none").map((a) => ({ uid: a.uid, username: a.username, late: a.late })),
    unclear: av.filter((a) => a.status === "unclear").map((a) => ({ uid: a.uid, username: a.username, raw: a.raw })),
    noReply: everyone.filter((u) => !answered.has(u.uid)),
  };
}

// Admin fixes an unclear reply (or answers for a player who called in).
async function setDays(weekStart, uid, days) {
  const clean = days.filter((d) => DAYS.includes(d));
  await saveAvailability(weekStart, uid, clean.length ? "manual" : "none", clean, "(set by admin)");
}

/* ---------- confirming a day ---------- */

// days = { "1": { uids: [...], time: "18:00", location: "court 1" }, ... }. Each day with at least one player becomes
// an event. Players who said they could play but were not picked are hidden from it. Afterwards every player whose
// set of confirmed days changed gets one text; players nobody picked get none.
async function confirmWeek(weekStart, input, adminName) {
  const s = await getSettings();
  for (const d of DAYS) {
    const cfg = input[d];
    if (!cfg) continue; // day not part of this save
    const asked = (cfg.uids || []).filter(Number.isInteger);
    const uids = asked.length ? (await db.query("SELECT UID AS uid FROM Users WHERE UID = ANY($1::int[])", [asked])).rows.map((r) => r.uid) : [];
    const { rows: ex } = await db.query("SELECT GID AS gid FROM Games WHERE PollWeek = $1 AND PollDay = $2", [weekStart, d]);
    let gid = ex[0]?.gid;
    if (!uids.length) { // nobody picked: drop an unplayed event, keep one that already has games
      if (gid) {
        const { rows: played } = await db.query("SELECT 1 FROM SubGames WHERE GID = $1 LIMIT 1", [gid]);
        if (played.length) await db.query("UPDATE GamePlayers SET Status = 'not_selected' WHERE GID = $1", [gid]);
        else { await db.query("DELETE FROM GamePlayers WHERE GID = $1", [gid]); await db.query("DELETE FROM Games WHERE GID = $1", [gid]); }
      }
      continue;
    }
    const when = zonedToUtc(addDays(weekStart, d - 1), /^\d{1,2}:\d{2}$/.test(cfg.time || "") ? cfg.time : s.default_time);
    const location = String(cfg.location || s.default_location).trim().toLowerCase().slice(0, 100);
    if (gid) await db.query("UPDATE Games SET GameTime = $2, Location = $3 WHERE GID = $1 AND Status = 'scheduled'", [gid, when, location]);
    else gid = (await db.query(
      "INSERT INTO Games (Location, GameTime, Status, CreatedBy, PollWeek, PollDay) VALUES ($1, $2, 'scheduled', $3, $4, $5) RETURNING GID",
      [location, when, adminName, weekStart, d]
    )).rows[0].gid;
    // The confirmation text already told them; a game that is already inside the reminder window must not also
    // trigger a reminder a minute later. Games further out keep their normal reminder.
    const soon = when.getTime() - Date.now() <= (Number(s.reminder_hours) || 24) * 3600e3;
    await db.query("UPDATE Games SET ReminderSentAt = CASE WHEN $2 THEN COALESCE(ReminderSentAt, NOW()) ELSE NULL END WHERE GID = $1", [gid, soon]);
    const { rows: couldPlay } = await db.query("SELECT UID AS uid, Days AS days FROM Availability WHERE WeekStart = $1", [weekStart]);
    const everyone = new Set([...uids, ...couldPlay.filter((a) => toList(a.days).includes(d)).map((a) => a.uid)]);
    for (const uid of everyone) {
      await db.query(
        "INSERT INTO GamePlayers (GID, UID, Status) VALUES ($1, $2, $3) ON CONFLICT (GID, UID) DO UPDATE SET Status = EXCLUDED.Status",
        [gid, uid, uids.includes(uid) ? "selected" : "not_selected"]
      );
      if (uids.includes(uid)) // a player the admin added by hand needs a row so the text below can find them
        await db.query("INSERT INTO Availability (WeekStart, UID, Status) VALUES ($1, $2, 'manual') ON CONFLICT DO NOTHING", [weekStart, uid]);
    }
    await db.query("UPDATE GamePlayers SET Status = 'not_selected' WHERE GID = $1 AND Status = 'selected' AND UID <> ALL($2::int[])", [gid, uids]);
  }
  return notifyConfirmed(weekStart);
}

async function notifyConfirmed(weekStart) {
  const s = await getSettings();
  const { rows } = await db.query(
    `SELECT Availability.UID AS uid, Users.Username AS username, Users.PhoneNumber AS phonenumber, Users.SmsOptIn AS smsoptin,
            Availability.NotifiedDays AS notified,
            COALESCE((SELECT STRING_AGG(Games.PollDay::text, ',' ORDER BY Games.PollDay) FROM GamePlayers JOIN Games ON Games.GID = GamePlayers.GID
                      WHERE Games.PollWeek = $1 AND GamePlayers.UID = Availability.UID AND GamePlayers.Status = 'selected'), '') AS now
     FROM Availability JOIN Users ON Users.UID = Availability.UID WHERE Availability.WeekStart = $1`,
    [weekStart]
  );
  let confirmed = 0, removed = 0;
  for (const r of rows) {
    if (r.now === r.notified) continue;
    if (r.now) { await sendSmsToUser(r, fill(s.confirm_text, { days: dayList(toList(r.now)), link: link() }), { kind: "week_confirm" }); confirmed++; }
    else if (r.notified) { await sendSmsToUser(r, fill(s.removed_text, { days: dayList(toList(r.notified)), link: link() }), { kind: "week_confirm" }); removed++; }
    await db.query("UPDATE Availability SET NotifiedDays = $3 WHERE WeekStart = $1 AND UID = $2", [weekStart, r.uid, r.now]);
  }
  return { confirmed, removed };
}

/* ---------- schedule page (any signed-in player) ---------- */

async function getSchedule(weekStart, viewerUid) {
  const { rows } = await db.query(
    `SELECT Games.PollDay AS day, Games.GID AS gid, Games.GameTime AS gametime, Games.Location AS location,
            Users.UID AS uid, Users.Username AS username
     FROM Games JOIN GamePlayers ON GamePlayers.GID = Games.GID AND GamePlayers.Status = 'selected'
     JOIN Users ON Users.UID = GamePlayers.UID WHERE Games.PollWeek = $1 ORDER BY Games.PollDay, Users.Username`,
    [weekStart]
  );
  const byDay = {};
  for (const r of rows) (byDay[r.day] ||= { day: r.day, date: addDays(weekStart, r.day - 1), gid: r.gid, time: r.gametime, location: r.location, players: [], me: false });
  for (const r of rows) { byDay[r.day].players.push(r.username); if (r.uid === viewerUid) byDay[r.day].me = true; }
  return { weekStart, range: range(weekStart), days: Object.values(byDay) };
}

module.exports = { sendBlast, tick, handleReply, getWeek, setDays, confirmWeek, getSchedule, weekStartFor, openPoll, saveAvailability, parts };
