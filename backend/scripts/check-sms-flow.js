// End-to-end check of the text flow in dry-run mode (no Twilio keys needed). Usage:
//   node scripts/check-sms-flow.js [apiBase]      (server must be running; default http://localhost:3001)
// Server must run with TZ=UTC SMS_DRY_RUN=1 (TZ matches the Postgres clock). Creates throwaway e2e_* users and one event, then deletes them.
require("dotenv").config({ quiet: true });
const assert = require("assert");
const db = require("../src/db");
const API = process.argv[2] || "http://localhost:3001";
const run = Date.now().toString().slice(-6);

const call = async (path, { method = "GET", body, token, form } = {}) => {
  const res = await fetch(API + path, {
    method,
    headers: { ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : { "Content-Type": "application/json" }), ...(token && { Authorization: `Bearer ${token}` }) },
    body: form ? new URLSearchParams(form) : body && JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null };
};
const outbox = async (token) => (await call("/api/admin/outbox", { token })).data;
const count = (log, kind, status) => log.filter((m) => m.kind === kind && m.direction === "out" && (!status || m.status === status)).length;

(async () => {
  // users: admin + 8 players (phone + opted in)
  const names = Array.from({ length: 8 }, (_, i) => `e2e_${run}_p${i}`);
  const admin = `e2e_${run}_admin`;
  const phone = (i) => `555${run}${i}`.slice(0, 10);
  for (const [i, n] of [...names, admin].entries()) {
    const r = await call("/api/users/register", { method: "POST", body: { username: n, pin: "4821", phoneNumber: phone(i), smsOptIn: true } });
    assert.equal(r.status, 201, `register ${n}: ${JSON.stringify(r.data)}`);
  }
  const uid = {};
  for (const r of (await db.query("SELECT UID, Username FROM Users WHERE Username LIKE $1", [`e2e_${run}_%`])).rows) uid[r.username] = r.uid;
  await db.query("UPDATE Users SET IsAdmin = TRUE WHERE Username = $1", [admin]);
  const token = (await call("/api/users/login", { method: "POST", body: { username: admin, pin: "4821" } })).data.token;
  const player = (await call("/api/users/login", { method: "POST", body: { username: names[0], pin: "4821" } })).data.token;
  assert(token && player);

  // auth: no token 401, non-admin 403
  assert.equal((await call("/api/admin/outbox")).status, 401);
  assert.equal((await call("/api/admin/outbox", { token: player })).status, 403);

  // event tomorrow noon
  const t = new Date(Date.now() + 36 * 3600e3); t.setMinutes(0, 0, 0);
  const iso = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}T12:00`;
  await call("/api/games", { method: "POST", body: { location: `e2e court ${run}`, time: iso, username: admin } });
  const gid = (await db.query("SELECT GID FROM Games WHERE Location = $1", [`e2e court ${run}`])).rows[0].gid;
  const statusOf = async () => Object.fromEntries((await call(`/api/admin/games/${gid}/players`, { token })).data.filter((p) => p.username.startsWith(`e2e_${run}`)).map((p) => [p.username, p.status]));

  // 1. availability to all 8 now
  let r = await call(`/api/admin/games/${gid}/invite`, { method: "POST", token, body: { uids: names.map((n) => uid[n]), note: "Bring water!" } });
  assert.deepEqual(r.data, { sentNow: 8, queued: 0 });
  let st = await statusOf(); assert(names.every((n) => st[n] === "invited"));
  let log = await outbox(token);
  assert.equal(count(log, "availability", "dry_run"), 8);
  assert(log.find((m) => m.kind === "availability").body.includes("Bring water!"), "custom note missing");

  // 2. replies: 6 YES (mixed case/punctuation), 1 NO, 1 silent
  for (const i of [0, 1, 2, 3, 4, 5]) await call("/api/admin/simulate-reply", { method: "POST", token, body: { uid: uid[names[i]], text: i % 2 ? "yes!" : "Y" } });
  await call("/api/admin/simulate-reply", { method: "POST", token, body: { uid: uid[names[6]], text: "no" } });
  st = await statusOf();
  assert.deepEqual([0, 1, 2, 3, 4, 5].map((i) => st[names[i]]), Array(6).fill("joined"));
  assert.equal(st[names[6]], "declined"); assert.equal(st[names[7]], "invited");
  // declined player no longer sees the event; invited one still does
  assert(!(await call(`/api/games?username=${names[6]}`)).data.some((g) => g.gid === gid));
  assert((await call(`/api/games?username=${names[7]}`)).data.some((g) => g.gid === gid));

  // 3. admin picks 4 of the 6
  r = await call(`/api/admin/games/${gid}/select`, { method: "POST", token, body: { selected: [0, 1, 2, 3].map((i) => uid[names[i]]), note: "See you there" } });
  assert.deepEqual(r.data, { picked: 4, dropped: 2 });
  log = await outbox(token);
  assert.equal(count(log, "selected", "dry_run"), 4); assert.equal(count(log, "not_selected", "dry_run"), 2);
  // not-selected players don't see the event (or in the roster); selected ones do
  assert(!(await call(`/api/games?username=${names[4]}`)).data.some((g) => g.gid === gid));
  assert((await call(`/api/games?username=${names[0]}`)).data.some((g) => g.gid === gid));
  const roster = (await call(`/api/games/${gid}/players`)).data.map((p) => p.username);
  assert.deepEqual(roster.sort(), names.slice(0, 4).sort());
  // re-confirming the same selection sends nothing new
  await call(`/api/admin/games/${gid}/select`, { method: "POST", token, body: { selected: [0, 1, 2, 3].map((i) => uid[names[i]]) } });
  assert.equal(count(await outbox(token), "selected"), 4);

  // 4. schedule text lists all 4 names
  r = await call(`/api/admin/games/${gid}/schedule`, { method: "POST", token, body: { note: "Court 3" } });
  assert.equal(r.data.sent, 4);
  const sched = (await outbox(token)).filter((m) => m.kind === "schedule");
  assert.equal(sched.length, 4);
  assert(names.slice(0, 4).every((n) => sched[0].body.includes(n)) && sched[0].body.includes("Court 3"));

  // 5. day-before reminder: move game to +2h, run scheduler
  await db.query("UPDATE Games SET GameTime = NOW() + INTERVAL '2 hours' WHERE GID = $1", [gid]); // DB clock: server must run with TZ=UTC
  await call("/api/admin/run-scheduler", { method: "POST", token });
  assert.equal(count(await outbox(token), "reminder", "dry_run"), 4);
  await call("/api/admin/run-scheduler", { method: "POST", token });
  assert.equal(count(await outbox(token), "reminder"), 4, "reminder must send once");

  // 6. queued Sunday-style invite waits until its time
  r = await call(`/api/admin/games/${gid}/invite`, { method: "POST", token, body: { uids: [uid[names[7]]], sendAt: new Date(Date.now() + 3600e3).toISOString() } });
  assert.deepEqual(r.data, { sentNow: 0, queued: 1 });
  assert.equal((await statusOf())[names[7]], "queued");
  await db.query("UPDATE GamePlayers SET InviteSendAt = NOW() - INTERVAL '1 second' WHERE GID = $1 AND UID = $2", [gid, uid[names[7]]]);
  await call("/api/admin/run-scheduler", { method: "POST", token });
  assert.equal((await statusOf())[names[7]], "invited");

  // 7. STOP via the inbound webhook (form-encoded like Twilio) opts out; later texts are skipped
  assert.equal((await call("/api/users/sms/inbound", { method: "POST", form: { From: `+1${phone(1)}`, Body: "STOP" } })).status, 204);
  assert.equal((await db.query("SELECT SmsOptIn FROM Users WHERE UID = $1", [uid[names[1]]])).rows[0].smsoptin, false);
  await call(`/api/admin/games/${gid}/schedule`, { method: "POST", token, body: {} });
  const skipped = (await outbox(token)).filter((m) => m.kind === "schedule" && m.status === "skipped");
  assert.equal(skipped.length, 1);

  console.log("OK: availability, replies, selection, visibility, schedule, reminder, queue, STOP, auth all passed");
  // cleanup
  await db.query("DELETE FROM Games WHERE GID = $1", [gid]);
  await db.query("DELETE FROM SmsLog WHERE Username LIKE $1", [`e2e_${run}_%`]);
  await db.query("DELETE FROM Users WHERE Username LIKE $1", [`e2e_${run}_%`]);
  process.exit(0);
})().catch((e) => { console.error("FAIL:", e.message, (e.stack.match(/check-sms-flow.js:\d+/) || [""])[0]); process.exit(1); });
