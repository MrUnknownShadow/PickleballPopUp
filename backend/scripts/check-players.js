// Checks the admin player tools, the substitution fix and the one-text-only rules, in dry-run mode. Usage:
//   SMS_DRY_RUN=1 node server.js     (one terminal)
//   node scripts/check-players.js [apiBase]
// Creates throwaway pl_* users and one week of events, then deletes them. Refuses to run over a real poll.
require("dotenv").config({ quiet: true });
const assert = require("assert");
const db = require("../src/db");
const { weekStartFor } = require("../src/tz");
const API = process.argv[2] || "http://localhost:3001";
const run = Date.now().toString().slice(-6);
const call = async (path, { method = "GET", body, token } = {}) => {
  const res = await fetch(API + path, { method, headers: { "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }) }, body: body && JSON.stringify(body) });
  const t = await res.text();
  return { status: res.status, data: t ? JSON.parse(t) : null };
};
const WEEK = weekStartFor();
const cleanup = async () => {
  await db.query("DELETE FROM GamePlayers WHERE GID IN (SELECT GID FROM Games WHERE PollWeek = $1)", [WEEK]);
  await db.query("DELETE FROM Games WHERE PollWeek = $1", [WEEK]);
  await db.query("DELETE FROM Availability WHERE WeekStart = $1", [WEEK]);
  await db.query("DELETE FROM WeeklyPolls WHERE WeekStart = $1", [WEEK]);
  await db.query("DELETE FROM Sessions WHERE UID IN (SELECT UID FROM Users WHERE Username LIKE $1)", [`pl_${run}_%`]);
  await db.query("DELETE FROM SmsLog WHERE Username LIKE $1", [`pl_${run}_%`]);
  await db.query("DELETE FROM Users WHERE Username LIKE $1", [`pl_${run}_%`]);
};

(async () => {
  assert.equal((await db.query("SELECT 1 FROM WeeklyPolls WHERE WeekStart = $1", [WEEK])).rows.length, 0, `a poll for ${WEEK} already exists; not running over it`);
  const adminName = `pl_${run}_admin`, a = `pl_${run}_a`, b = `pl_${run}_b`;
  const uid = {};
  for (const [i, n] of [adminName, a, b].entries()) {
    const r = await call("/api/users/register", { method: "POST", body: { username: n, pin: "4821", phoneNumber: `557${run}${i}`.slice(0, 10), smsOptIn: true } });
    assert.equal(r.status, 201, JSON.stringify(r.data));
    uid[n] = r.data.uid;
  }
  await db.query("UPDATE Users SET IsAdmin = TRUE WHERE Username = $1", [adminName]);
  const token = (await call("/api/users/login", { method: "POST", body: { username: adminName, pin: "4821" } })).data.token;
  const player = (await call("/api/users/login", { method: "POST", body: { username: a, pin: "4821" } })).data.token;

  // 1. adding players: admins only, no group code, validated like sign-up
  const mk = (extra = {}, tk = token) => call("/api/admin/players", { method: "POST", token: tk, body: { username: `pl_${run}_new`, pin: "1357", phoneNumber: `558${run}0`.slice(0, 10), ...extra } });
  assert.equal((await mk({}, null)).status, 401);
  assert.equal((await mk({}, player)).status, 403);
  assert.equal((await mk({ pin: "12" })).status, 400);
  assert.equal((await mk({ phoneNumber: "123" })).status, 400);
  assert.equal((await mk({ username: "  " })).status, 400);
  let r = await mk();
  assert.equal(r.status, 201, JSON.stringify(r.data));
  const newUid = r.data.uid;
  assert.equal((await mk()).status, 409, "same username twice");
  assert.equal((await mk({ username: `pl_${run}_other` })).status, 409, "same phone twice");
  assert.equal((await call("/api/users/login", { method: "POST", body: { username: `pl_${run}_new`, pin: "1357" } })).status, 200, "the new player can sign in with the PIN the admin set");
  const row = (await call("/api/admin/players", { token })).data.find((p) => p.uid === newUid);
  assert(row && row.smsoptin === false, "an admin-added player starts with texts off: only the player can consent");
  assert.equal((await call("/api/admin/players", { token: player })).status, 403);

  // 2. removing players
  assert.equal((await call(`/api/admin/players/${uid[adminName]}`, { method: "DELETE", token })).status, 400, "cannot remove yourself here");
  assert.equal((await call(`/api/admin/players/${newUid}`, { method: "DELETE", token: player })).status, 403);
  assert.equal((await call(`/api/admin/players/999999`, { method: "DELETE", token })).status, 404);

  // 3. substitution: a player who said None, and a player with no reply, are picked by hand and stay picked
  await call("/api/admin/week/blast", { method: "POST", token, body: { weekStart: WEEK } });
  await call("/api/admin/week/simulate-reply", { method: "POST", token, body: { uid: uid[a], text: "None" } });
  const week = () => call(`/api/admin/week?weekStart=${WEEK}`, { token }).then((x) => x.data);
  const confirm = (days) => call("/api/admin/week/confirm", { method: "POST", token, body: { weekStart: WEEK, days } }).then((x) => x.data);
  const ids = (w, d) => w.days[d].filter((p) => p.confirmed).map((p) => p.uid).sort();
  assert((await week()).roster.some((p) => p.uid === newUid), "every account is on the roster for the substitute picker");
  await confirm({ 3: { uids: [uid[a], newUid], time: "18:00", location: "court 1" } });
  let w = await week();
  assert.deepEqual(ids(w, 3), [uid[a], newUid].sort(), "both hand-picked players show as picked after a reload");
  assert(!w.none.some((p) => p.uid === uid[a]), "the player who said None no longer shows as unavailable once picked");
  assert(!w.noReply.some((p) => p.uid === newUid), "nor as no reply");
  assert.deepEqual(await confirm({ 3: { uids: ids(w, 3), time: "18:00", location: "court 1" } }), { confirmed: 0, removed: 0 }, "confirming the same picks again changes and texts nobody");

  // 4. swapping a player (the new player out, b in): one removal text and one selection text, nothing else
  const texts = async () => (await call("/api/admin/outbox", { token })).data.filter((m) => m.kind === "week_confirm" && m.direction === "out");
  const before = (await texts()).length;
  const swap = await confirm({ 3: { uids: [uid[a], uid[b]], time: "18:00", location: "court 1" } });
  assert.deepEqual(swap, { confirmed: 1, removed: 1 }, "swap: b is told they are in, the dropped player is told they are out");
  const sent = (await texts()).slice(0, (await texts()).length - before);
  assert.deepEqual(sent.map((m) => m.username).sort(), [`pl_${run}_new`, b].sort(), "exactly one text each: b (selected) and the dropped player (removed), nobody else: " + JSON.stringify(sent.map((m) => [m.username, m.body.slice(15, 60)])));

  // 5. Confirms at the same moment text each change once (smoke check: the claim in notifyConfirmed is the guard,
  //    but on a fast local database the requests rarely overlap, so this passes with or without it)
  await confirm({ 4: { uids: [uid[a]], time: "18:00", location: "court 1" } });
  const racers = await Promise.all([1, 2, 3].map(() => confirm({ 4: { uids: [uid[a], uid[b]], time: "18:00", location: "court 1" } })));
  assert.equal(racers.reduce((n, x) => n + x.confirmed, 0), 1, "three simultaneous Confirms add b to Thursday: b is texted once");

  // 6. reminders: claimed before sending, one text per player however many games are due
  await db.query("UPDATE Games SET GameTime = NOW() + INTERVAL '3 hours', ReminderSentAt = NULL, Status = 'scheduled' WHERE PollWeek = $1", [WEEK]);
  await db.query("UPDATE Users SET SmsOptIn = TRUE WHERE UID = $1", [uid[a]]);
  const notify = require("../src/notify");
  const remindersBefore = (await call("/api/admin/outbox", { token })).data.filter((m) => m.kind === "reminder").length;
  await Promise.all([notify.sendDueReminders(), notify.sendDueReminders(), notify.sendDueReminders()]);
  const mine = (await call("/api/admin/outbox", { token })).data.filter((m) => m.kind === "reminder" && m.username === a);
  assert.equal(mine.length, 1, "a player in two games that are both due gets one reminder, even with the timer firing three times at once");
  assert(/ and /.test(mine[0].body), "the one reminder lists both games");
  assert((await call("/api/admin/outbox", { token })).data.filter((m) => m.kind === "reminder").length > remindersBefore);

  // 7. removing a player takes them off the schedule too
  assert.equal((await call(`/api/admin/players/${newUid}`, { method: "DELETE", token })).status, 200);
  assert(!(await call("/api/admin/players", { token })).data.some((p) => p.uid === newUid), "removed player is gone");
  assert.equal((await call("/api/users/login", { method: "POST", body: { username: `pl_${run}_new`, pin: "1357" } })).status, 401, "and cannot sign in");

  // 8. public pages: the leaderboard and results load with no sign-in
  assert.equal((await call("/api/games/leaderboard")).status, 200);
  assert.equal((await call("/api/games/results")).status, 200);
  console.log("OK: add/remove players (admin only, validated, texts off), substitution stays picked, one text per change, one reminder per player, public leaderboard and results");
})().catch((e) => { console.error("FAIL:", e.message); process.exitCode = 1; }).finally(async () => { await cleanup(); process.exit(); });
