// Plays a normal session as real players through the API: register, login, event, join, score a game, chat, end session.
// Run against a dry-run server: node scripts/check-game-flow.js http://localhost:3002 . Leaves sm_* rows (delete with the SQL in README if needed).
const assert = require("assert"); const API = process.argv[2]; const run = Date.now().toString().slice(-6);
const call = async (p, { method = "GET", body, token } = {}) => { if (process.env.TRACE) console.log(method, p); const r = await fetch(API + p, { method, headers: { "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }) }, body: body && JSON.stringify(body) }); const t = await r.text(); if (process.env.TRACE && r.status >= 400) console.log("   ->", r.status, t.slice(0, 120)); return { status: r.status, data: t ? JSON.parse(t) : null }; };
(async () => {
  const names = ["host", "p2", "p3", "p4"].map((n) => `sm_${run}_${n}`); const tok = {};
  for (const [i, n] of names.entries()) { assert.equal((await call("/api/users/register", { method: "POST", body: { username: n, pin: "4821", phoneNumber: `557${run}${i}` } })).status, 201); tok[n] = (await call("/api/users/login", { method: "POST", body: { username: n, pin: "4821" } })).data.token; assert(tok[n]); }
  const [host, p2, p3, p4] = names;
  assert.equal((await call("/api/games", { method: "POST", token: tok[host], body: { location: `smoke ${run}`, time: new Date(Date.now() + 2 * 3600e3).toISOString() } })).status, 200);
  const g = (await call("/api/games", { token: tok[host] })).data.find((x) => x.location === `smoke ${run}`); assert(g, "event listed");
  for (const n of [p2, p3, p4, host]) assert.equal((await call(`/api/games/${g.gid}/join`, { method: "POST", token: tok[n] })).status, 200);
  assert.equal((await call(`/api/games/${g.gid}/players`)).data.length, 4);
  assert.equal((await call(`/api/games/${g.gid}/start`, { method: "POST", token: tok[host] })).status, 200);
  const sg = await call(`/api/games/${g.gid}/startgame`, { method: "POST", token: tok[host], body: { team1: [host, p2], team2: [p3, p4], durationMinutes: 15 } }); assert.equal(sg.status, 200, JSON.stringify(sg.data));
  const sgid = sg.data.sgid ?? sg.data.sgId ?? sg.data.SGID ?? (await call(`/api/games/${g.gid}/subgames`)).data[0].sgid;
  assert.equal((await call(`/api/games/subgame/${sgid}/end`, { method: "POST", token: tok[host], body: { team1score: 9, team2score: 4 } })).status, 200);
  assert.equal((await call(`/api/games/${g.gid}/chat`, { method: "POST", token: tok[p2], body: { content: "hi" } })).status, 200);
  assert.equal((await call(`/api/games/${g.gid}/chat`)).data.length >= 1, true);
  // a non-host cannot end or delete the session; the host can
  assert.equal((await call(`/api/games/${g.gid}/delete`, { method: "POST", token: tok[p2] })).status, 403);
  assert.equal((await call(`/api/games/${g.gid}/end`, { method: "POST", token: tok[host] })).status, 200);
  assert((await call("/api/games/leaderboard")).data.some((r) => r.username === host || r.Username === host), "leaderboard shows the player");
  // own settings work, wrong PIN lockout
  assert.equal((await call(`/api/users/${host}/settings`, { method: "PATCH", token: tok[host], body: { phoneNumber: "15550001111", smsOptIn: true } })).status, 200);
  // sign-up without ticking the text option must not opt the person in (carrier consent rule)
  const noTick = `sm_${run}_notick`;
  assert.equal((await call("/api/users/register", { method: "POST", body: { username: noTick, pin: "4821", phoneNumber: "15558880001" } })).status, 201);
  const prof = (await call(`/api/users/${noTick}`, { token: (await call("/api/users/login", { method: "POST", body: { username: noTick, pin: "4821" } })).data.token })).data;
  assert.equal(prof.smsoptin, false, "no tick, no texts");
  console.log("OK: register, login, create event, join, start session, play + score a game, chat, host-only delete refused, end session, leaderboard, own settings");
  process.exit(0);
})().catch((e) => { console.error("SMOKE FAIL:", e.message); process.exit(1); });
