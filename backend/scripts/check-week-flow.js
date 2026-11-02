// End-to-end check of the weekly availability flow in dry-run mode (no text provider needed). Usage:
//   SMS_DRY_RUN=1 node server.js     (in one terminal)
//   node scripts/check-week-flow.js [apiBase]
// Creates throwaway wk_* users and one week of events, then deletes them.
require("dotenv").config({ quiet: true });
const assert = require("assert");
const db = require("../src/db");
const { addDays, weekStartFor } = require("../src/tz");
const API = process.argv[2] || "http://localhost:3001";
const run = Date.now().toString().slice(-6);
const call = async (path, { method = "GET", body, token } = {}) => {
  const res = await fetch(API + path, { method, headers: { "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }) }, body: body && JSON.stringify(body) });
  const t = await res.text();
  return { status: res.status, data: t ? JSON.parse(t) : null };
};
// The real upcoming week (replies only count for a poll within a week of today). Refuses to run over a real poll.
const WEEK = weekStartFor();

const cleanup = async () => {
  await db.query("DELETE FROM GamePlayers WHERE GID IN (SELECT GID FROM Games WHERE PollWeek = $1)", [WEEK]);
  await db.query("DELETE FROM Games WHERE PollWeek = $1", [WEEK]);
  await db.query("DELETE FROM Availability WHERE WeekStart = $1", [WEEK]);
  await db.query("DELETE FROM WeeklyPolls WHERE WeekStart = $1", [WEEK]);
  await db.query("DELETE FROM Sessions WHERE UID IN (SELECT UID FROM Users WHERE Username LIKE $1)", [`wk_${run}_%`]);
  await db.query("DELETE FROM SmsLog WHERE Username LIKE $1", [`wk_${run}_%`]);
  await db.query("DELETE FROM Users WHERE Username LIKE $1", [`wk_${run}_%`]);
};

(async () => {
  assert.equal((await db.query("SELECT 1 FROM WeeklyPolls WHERE WeekStart = $1", [WEEK])).rows.length, 0, `a poll for ${WEEK} already exists; not running over it`);
  const names = Array.from({ length: 6 }, (_, i) => `wk_${run}_p${i}`);
  const adminName = `wk_${run}_admin`;
  const uid = {};
  for (const [i, n] of [...names, adminName].entries()) {
    const r = await call("/api/users/register", { method: "POST", body: { username: n, pin: "4821", phoneNumber: `556${run}${i}`.slice(0, 10), smsOptIn: true } });
    assert.equal(r.status, 201, JSON.stringify(r.data));
    uid[n] = (await db.query("SELECT UID FROM Users WHERE Username = $1", [n])).rows[0].uid;
  }
  await db.query("UPDATE Users SET IsAdmin = TRUE WHERE Username = $1", [adminName]);
  const token = (await call("/api/users/login", { method: "POST", body: { username: adminName, pin: "4821" } })).data.token;
  const player = (await call("/api/users/login", { method: "POST", body: { username: names[0], pin: "4821" } })).data.token;
  const week = () => call(`/api/admin/week?weekStart=${WEEK}`, { token }).then((r) => r.data);
  const sms = async (kind) => (await call("/api/admin/outbox", { token })).data.filter((m) => m.kind === kind && m.direction === "out" && m.status === "dry_run" && names.concat(adminName).includes(m.username));
  const say = (n, text) => call("/api/admin/week/simulate-reply", { method: "POST", token, body: { uid: uid[n], text } });

  // auth: players cannot use the admin routes; schedule needs a login
  assert.equal((await call(`/api/admin/week?weekStart=${WEEK}`)).status, 401);
  assert.equal((await call(`/api/admin/week?weekStart=${WEEK}`, { token: player })).status, 403);
  assert.equal((await call("/api/schedule")).status, 200, "the schedule is public: no sign-in needed");
  assert.equal((await call("/api/schedule", { token: player })).status, 200);

  // 1. blast: every opted-in player is asked once; a second blast is refused
  let r = await call("/api/admin/week/blast", { method: "POST", token, body: { weekStart: WEEK } });
  assert.equal(r.data.alreadySent, false);
  assert((await sms("week_blast")).length >= 7, "blast should text all opted-in players");
  assert((await sms("week_blast")).every((m) => m.body.startsWith("BARnBoy Group")), "every text names the brand (carrier registration sample messages must match)");
  assert.equal((await call("/api/admin/week/blast", { method: "POST", token, body: { weekStart: WEEK } })).data.alreadySent, true);

  const [a, b, c, d, e] = names;
  await say(a, "MWF"); await say(b, "Tuesday and Thursday"); await say(c, "N/A"); await say(d, "tomorrow?"); await say(e, "all");
  let w = await week();
  const set = (day) => w.days[day].map((p) => p.username).sort();
  assert.deepEqual(set(1), [a, e].sort()); assert.deepEqual(set(2), [b, e].sort()); assert.deepEqual(set(5), [a, e].sort());
  assert.deepEqual(w.none.map((p) => p.username), [c]);
  assert.deepEqual(w.unclear.map((p) => p.username), [d]);
  assert(w.noReply.some((p) => p.username === names[5]), "a player who never replied shows as no reply");
  assert((await sms("week_reply")).length >= 5, "each reply gets one short answer");

  // 2. latest reply replaces the earlier one
  await say(a, "Th");
  w = await week();
  assert(!set(1).includes(a) && !set(5).includes(a) && set(4).includes(a), "latest reply should replace MWF");

  // 3. admin fixes an unclear reply
  await call("/api/admin/week/set-days", { method: "POST", token, body: { weekStart: WEEK, uid: uid[d], days: [2] } });
  assert((await week()).days[2].some((p) => p.username === d));

  // 4. confirm Tuesday: b + d picked, e said Tuesday but was not picked. Picked get one text, e gets none.
  const before = (await sms("week_confirm")).length;
  r = await call("/api/admin/week/confirm", { method: "POST", token, body: { weekStart: WEEK, days: { 2: { uids: [uid[b], uid[d]], time: "18:00", location: "court 9" } } } });
  assert.equal(r.data.confirmed, 2);
  const texts = (await sms("week_confirm")).slice(0, (await sms("week_confirm")).length - before);
  assert(texts.every((m) => m.body.includes("Tuesday") && m.body.includes("/schedule")), "confirmation names the day and links the schedule");
  assert(!(await sms("week_confirm")).some((m) => m.username === e), "unpicked player gets no text");
  w = await week();
  assert(w.days[2].find((p) => p.username === b).confirmed && !w.days[2].find((p) => p.username === e).confirmed);
  assert.equal(w.games[2].location, "court 9");

  // 5. the confirmed day is a real event: picked players see it, the unpicked one does not
  const g = (await db.query("SELECT GID, GameTime FROM Games WHERE PollWeek = $1 AND PollDay = 2", [WEEK])).rows[0];
  assert(g, "confirming creates an event");
  assert((await call(`/api/games?username=${b}`)).data.some((x) => x.gid === g.gid));
  assert(!(await call(`/api/games?username=${e}`)).data.some((x) => x.gid === g.gid));

  // 6. re-confirming the same picks sends nothing; adding Thursday for b sends one new text listing both days
  const n1 = (await sms("week_confirm")).length;
  await call("/api/admin/week/confirm", { method: "POST", token, body: { weekStart: WEEK, days: { 2: { uids: [uid[b], uid[d]], time: "18:00", location: "court 9" } } } });
  assert.equal((await sms("week_confirm")).length, n1, "same picks, no new texts");
  await call("/api/admin/week/confirm", { method: "POST", token, body: { weekStart: WEEK, days: { 4: { uids: [uid[b], uid[a]] } } } });
  const last = (await sms("week_confirm"))[0];
  assert.equal((await sms("week_confirm")).length, n1 + 2);
  assert((await sms("week_confirm")).some((m) => m.username === b && /Tuesday, Thursday/.test(m.body)), "b is told about both days");

  // 7. removing a picked player tells them; the schedule page lists names
  await call("/api/admin/week/confirm", { method: "POST", token, body: { weekStart: WEEK, days: { 2: { uids: [uid[b]] } } } });
  assert((await sms("week_confirm")).some((m) => m.username === d && /no longer/.test(m.body)));
  const pub = (await call(`/api/schedule?weekStart=${WEEK}`)).data.current;
  assert(pub.days.some((x) => x.day === 2 && x.players.includes(b)) && pub.days.every((x) => !x.me), "public view works and marks nobody as 'me'");
  const sch = (await call(`/api/schedule?weekStart=${WEEK}`, { token: player })).data.current;
  assert(sch.days.some((x) => x.day === 2 && x.players.includes(b) && !x.players.includes(d)));
  assert(sch.days.find((x) => x.day === 4).me, "the schedule marks the viewer's own days");

  // 8. a reply after the cutoff is kept but marked late and gets no text
  await db.query("UPDATE WeeklyPolls SET CutoffAt = NOW() - INTERVAL '1 hour' WHERE WeekStart = $1", [WEEK]);
  const n2 = (await sms("week_reply")).length;
  await say(names[5], "M");
  assert.equal((await sms("week_reply")).length, n2, "late reply: no text");
  assert((await week()).days[1].find((p) => p.username === names[5]).late);

  // 8b. settings are validated: a bad time is refused instead of silently stopping the Sunday send
  assert.equal((await call("/api/admin/week/settings", { method: "PUT", token, body: { blast_time: "2pm" } })).status, 400);
  assert.equal((await call("/api/admin/week/settings", { method: "PUT", token, body: { cutoff_hours: "soon" } })).status, 400);

  // 9. settings round-trip, and the automatic blast stays off unless switched on
  assert.equal((await call("/api/admin/week/settings", { token })).data.blast_auto, "0");
  const s = await call("/api/admin/week/settings", { method: "PUT", token, body: { default_time: "19:30" } });
  assert.equal(s.data.default_time, "19:30");
  await call("/api/admin/week/settings", { method: "PUT", token, body: { default_time: "18:00" } });

  // 10. the old per-event YES/NO flow still works when there is an open per-event invite (see check-sms-flow.js)
  console.log("OK: blast, replies, latest-wins, N/A, unclear, late, confirm per day, no text for unpicked, removal, schedule, settings");

  await cleanup();
  process.exit(0);
})().catch(async (e) => { console.error("FAIL:", e.message, "\n", e.stack.split("\n")[1]); await cleanup().catch(() => {}); process.exit(1); });
