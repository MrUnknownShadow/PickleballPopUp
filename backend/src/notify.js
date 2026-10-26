const db = require("./db");
const { sendSmsToUser, log } = require("./sms");

const ROW = `Users.UID AS uid, Users.Username AS username, Users.PhoneNumber AS phonenumber, Users.SmsOptIn AS smsoptin,
  Games.GID AS gid, Games.GameTime AS gametime, Games.Location AS location, GamePlayers.InviteNote AS invitenote`;

// Stored GameTime is a naive wall-clock timestamp, so format it in server-local time without conversion.
// ponytail: assumes server TZ == players' TZ; store a timezone on Games if they ever differ.
function when(t) {
  return new Date(t).toLocaleString("en-US", { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });
}
const withNote = (text, note) => (note && note.trim() ? `${text}\n\n${note.trim()}` : text);

// Admin picks players: sendAt null = text now, otherwise they are queued until sendAt (e.g. Sunday morning).
async function queueInvites(gid, uids, sendAt, note) {
  for (const uid of uids) {
    await db.query(
      `INSERT INTO GamePlayers (GID, UID, Status, InviteSendAt, InviteNote) VALUES ($1, $2, 'queued', $3, $4)
       ON CONFLICT (GID, UID) DO UPDATE SET Status = 'queued', InviteSendAt = $3, InviteNote = $4
       WHERE GamePlayers.Status IN ('invited', 'declined', 'queued')`,
      [gid, uid, sendAt ?? new Date(), note ?? null]
    );
  }
  return sendDueInvites();
}

async function sendDueInvites() {
  const { rows } = await db.query(
    `SELECT ${ROW} FROM GamePlayers
     JOIN Users ON Users.UID = GamePlayers.UID JOIN Games ON Games.GID = GamePlayers.GID
     WHERE GamePlayers.Status = 'queued' AND GamePlayers.InviteSendAt <= $1`,
    [new Date()]
  );
  for (const r of rows) {
    const text = withNote(
      `Pickleball: ${when(r.gametime)} at ${r.location}. Can you play? Reply YES to join or NO to skip.`,
      r.invitenote
    );
    await sendSmsToUser(r, text, { kind: "availability", gid: r.gid });
    await db.query("UPDATE GamePlayers SET Status = 'invited' WHERE GID = $1 AND UID = $2", [r.gid, r.uid]);
  }
  return rows.length;
}

// Player replies YES / NO to the most recent open invite.
async function handleReply(phone, text) {
  const { rows: u } = await db.query(
    "SELECT UID AS uid, Username AS username, PhoneNumber AS phonenumber, SmsOptIn AS smsoptin FROM Users WHERE PhoneNumber = $1",
    [phone]
  );
  const user = u[0];
  if (!user) return;
  const answer = text.trim().toUpperCase().replace(/[^A-Z]/g, "");
  await log(user, null, "reply", "in", text, "received");
  if (answer === "STOP") { // the real webhook handles STOP itself; this lets the admin test tool do it too
    await db.query("UPDATE Users SET SmsOptIn = FALSE, SmsOptedOutAt = NOW() WHERE UID = $1", [user.uid]);
    return;
  }
  const yes = ["YES", "Y"].includes(answer);
  if (!yes && !["NO", "N"].includes(answer)) return;
  const { rows } = await db.query(
    `SELECT GamePlayers.GID AS gid, Games.GameTime AS gametime, Games.Location AS location FROM GamePlayers
     JOIN Games ON Games.GID = GamePlayers.GID
     WHERE GamePlayers.UID = $1 AND GamePlayers.Status = 'invited' AND Games.Status = 'scheduled'
     ORDER BY GamePlayers.InviteSendAt DESC LIMIT 1`,
    [user.uid]
  );
  const g = rows[0];
  if (!g) return;
  await db.query("UPDATE GamePlayers SET Status = $3 WHERE GID = $1 AND UID = $2", [g.gid, user.uid, yes ? "joined" : "declined"]);
  await sendSmsToUser(
    user,
    yes ? `Thanks! You're signed up for ${when(g.gametime)}. We'll text you if you're picked.` : "No problem, thanks for letting us know.",
    { kind: "reply", gid: g.gid }
  );
}

// Admin confirms final roster. Only players whose status changes get a text.
async function selectPlayers(gid, selectedUids, note) {
  const { rows } = await db.query(
    `SELECT ${ROW}, GamePlayers.Status AS status FROM GamePlayers
     JOIN Users ON Users.UID = GamePlayers.UID JOIN Games ON Games.GID = GamePlayers.GID
     WHERE GamePlayers.GID = $1 AND GamePlayers.Status IN ('joined', 'selected', 'not_selected')`,
    [gid]
  );
  let picked = 0, dropped = 0;
  for (const r of rows) {
    const next = selectedUids.includes(r.uid) ? "selected" : "not_selected";
    if (r.status === next) continue;
    await db.query("UPDATE GamePlayers SET Status = $3 WHERE GID = $1 AND UID = $2", [gid, r.uid, next]);
    const text = next === "selected"
      ? `You're in! Pickleball ${when(r.gametime)} at ${r.location}.`
      : `Thanks for signing up for pickleball ${when(r.gametime)}. We didn't need you for this one, hope to see you next time.`;
    await sendSmsToUser(r, withNote(text, note), { kind: next, gid });
    next === "selected" ? picked++ : dropped++;
  }
  return { picked, dropped };
}

// Final schedule: everyone selected gets the names of everyone playing.
async function sendSchedule(gid, note) {
  const { rows } = await db.query(
    `SELECT ${ROW} FROM GamePlayers
     JOIN Users ON Users.UID = GamePlayers.UID JOIN Games ON Games.GID = GamePlayers.GID
     WHERE GamePlayers.GID = $1 AND GamePlayers.Status = 'selected' ORDER BY Users.Username`,
    [gid]
  );
  if (!rows.length) return 0;
  const text = withNote(
    `Pickleball schedule: ${when(rows[0].gametime)} at ${rows[0].location}. Playing (${rows.length}): ${rows.map((r) => r.username).join(", ")}.`,
    note
  );
  for (const r of rows) await sendSmsToUser(r, text, { kind: "schedule", gid });
  return rows.length;
}

// Reminder to selected players once the game is within 24h. Runs once per game.
async function sendDueReminders() {
  const now = new Date();
  const { rows: games } = await db.query(
    `SELECT GID FROM Games WHERE Status = 'scheduled' AND ReminderSentAt IS NULL AND GameTime > $1 AND GameTime <= $2`,
    [now, new Date(now.getTime() + 24 * 3600 * 1000)]
  );
  for (const { gid } of games) {
    const { rows } = await db.query(
      `SELECT ${ROW} FROM GamePlayers
       JOIN Users ON Users.UID = GamePlayers.UID JOIN Games ON Games.GID = GamePlayers.GID
       WHERE GamePlayers.GID = $1 AND GamePlayers.Status = 'selected'`,
      [gid]
    );
    for (const r of rows) {
      await sendSmsToUser(r, `Reminder: you're playing pickleball ${when(r.gametime)} at ${r.location}.`, { kind: "reminder", gid });
    }
    await db.query("UPDATE Games SET ReminderSentAt = NOW() WHERE GID = $1", [gid]);
  }
  return games.length;
}

module.exports = { queueInvites, sendDueInvites, handleReply, selectPlayers, sendSchedule, sendDueReminders };
