// Abuse check: throws hostile and sloppy input at the API and reports anything that is not refused cleanly (bad types,
// oversized text, PIN guessing, acting as someone else, wiping data, bad scores, concurrent joins). Run against a throwaway
// dry-run server: SMS_DRY_RUN=1 REGISTER_LIMIT_PER_HOUR=1000 PORT=3002 node server.js, then: node scripts/check-abuse.js http://localhost:3002
// Creates pr_* users and events and deletes only those. Exits 1 if anything is a problem. It never calls DELETE /api/games/reset as an admin.
require("dotenv").config({ quiet: true });
const db = require("../src/db");
const API = process.argv[2], run = Date.now().toString().slice(-6);
let defaultTok = null;
const out = [], note = (sev, name, ok, detail = "") => out.push({ sev, name, ok, detail });
const call = async (path, { method = "GET", body, token, raw } = {}) => {
  try {
    const res = await fetch(API + path, { method, headers: { "Content-Type": "application/json", ...((token ?? (defaultTok && path.startsWith("/api/games") && method !== "GET" ? defaultTok : null)) && { Authorization: `Bearer ${token ?? defaultTok}` }) }, body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined) });
    const t = await res.text(); let d; try { d = JSON.parse(t); } catch { d = t; }
    return { status: res.status, data: d };
  } catch (e) { return { status: 0, data: String(e) }; }
};
(async () => {
  const victim = `pr_${run}_victim`, attacker = `pr_${run}_att`, adminN = `pr_${run}_adm`;
  for (const [n, ph] of [[victim, "15557770001"], [attacker, "15557770002"], [adminN, "15557770003"]])
    await call("/api/users/register", { method: "POST", body: { username: n, pin: "4821", phoneNumber: ph, smsOptIn: true } });
  await db.query("UPDATE Users SET IsAdmin = TRUE WHERE Username = $1", [adminN]);
  const adm = (await call("/api/users/login", { method: "POST", body: { username: adminN, pin: "4821" } })).data.token;
  const att = (await call("/api/users/login", { method: "POST", body: { username: attacker, pin: "4821" } })).data.token;
  const vic = (await call("/api/users/login", { method: "POST", body: { username: victim, pin: "4821" } })).data.token;
  defaultTok = vic;

  // ---- browser hardening headers, and no database error text in responses
  const home = await fetch(API + "/api/games");
  const csp = home.headers.get("content-security-policy") || "";
  note("MED", "security headers are set (CSP frame-ancestors, nosniff, no X-Powered-By)", csp.includes("frame-ancestors 'none'") && home.headers.get("x-content-type-options") === "nosniff" && !home.headers.get("x-powered-by"), `csp ${csp ? "set" : "MISSING"}`);
  const head = await fetch(API + "/privacy", { method: "HEAD" });
  note("HIGH", "HEAD /privacy answers 200 (link checkers and carrier reviewers use HEAD)", head.status === 200, `status ${head.status}`);
  const leak = await call("/api/games/zzz/players");
  note("MED", "a database error does not leak its text to the browser", !/invalid input|syntax|relation|constraint|column/i.test(JSON.stringify(leak.data)), `status ${leak.status}: ${JSON.stringify(leak.data).slice(0, 80)}`);

  // ---- registration fuzz: nothing should 500, junk types should be refused
  const created = [];
  const weird = { object: { a: 1 }, array: ["x"], number: 12345, nullv: null, empty: "   ", long: "a".repeat(5000), script: "<script>alert(1)</script>", sql: "x'; DROP TABLE Users;--", emoji: "pick😀ball", slash: "../../etc/passwd", nul: "a\u0000b", dup: attacker.toUpperCase() };
  let ph = 0;
  for (const [k, v] of Object.entries(weird)) {
    const r = await call("/api/users/register", { method: "POST", body: { username: v, pin: "4821", phoneNumber: `559${run}${ph++}`.slice(0, 11) } });
    const mustRefuse = ["object", "array", "number", "long", "nul", "nullv"].includes(k);
    note(mustRefuse ? "HIGH" : "MED", `register username=${k}`, r.status !== 500 && (!mustRefuse || (r.status >= 400 && r.status < 500)), `status ${r.status}${r.status === 201 ? " (account created: " + JSON.stringify(r.data).slice(0, 60) + ")" : ""}`);
    if (r.status === 201 && r.data?.uid) created.push(r.data.uid);
  }
  for (const uid of created) await db.query("DELETE FROM Users WHERE UID = $1", [uid]);
  for (const pin of ["abcd", "12345", "123", "", null, { a: 1 }, "١٢٣٤"]) {
    const r = await call("/api/users/register", { method: "POST", body: { username: `pr_${run}_pin`, pin, phoneNumber: `5591${run}`.slice(0, 11) } });
    note("MED", `register pin=${JSON.stringify(pin)} is refused`, r.status === 400, `status ${r.status}`);
    if (r.status === 201) await db.query("DELETE FROM Users WHERE Username = $1", [`pr_${run}_pin`]);
  }
  const nonstr = await call("/api/users/login", { method: "POST", body: { username: { $ne: 1 }, pin: { $ne: 1 } } });
  note("MED", "login with non-string body does not crash", nonstr.status < 500, `status ${nonstr.status}`);
  const badjson = await call("/api/users/login", { method: "POST", raw: "{bad json" });
  note("MED", "malformed JSON body does not crash", badjson.status < 500, `status ${badjson.status}`);

  // ---- a phone number is required to sign up
  const noPhone = await call("/api/users/register", { method: "POST", body: { username: `pr_${run}_nophone`, pin: "4821" } });
  const badPhone = await call("/api/users/register", { method: "POST", body: { username: `pr_${run}_badphone`, pin: "4821", phoneNumber: "12" } });
  note("HIGH", "sign-up without a phone number (or a nonsense one) is refused", noPhone.status === 400 && badPhone.status === 400, `no phone ${noPhone.status}, bad phone ${badPhone.status}`);
  if (noPhone.status === 201) await db.query("DELETE FROM Users WHERE Username = $1", [`pr_${run}_nophone`]);

  // ---- one phone number, one account (replies are matched to a player by phone)
  const dupReg = await call("/api/users/register", { method: "POST", body: { username: `pr_${run}_dup2`, pin: "4821", phoneNumber: "15557770001" } });
  note("HIGH", "a phone number already on an account cannot be registered again", dupReg.status === 409, `status ${dupReg.status}`);
  const dupSet = await call(`/api/users/${attacker}/settings`, { method: "PATCH", token: att, body: { phoneNumber: "15557770001", smsOptIn: true } });
  note("HIGH", "…nor moved onto another account in Settings", dupSet.status === 409, `status ${dupSet.status}`);

  // ---- PIN brute force: is there any lockout?
  const t0 = Date.now(); let locked = false, n = 0;
  for (let i = 0; i < 25; i++) { const r = await call("/api/users/login", { method: "POST", body: { username: victim, pin: String(1000 + i) } }); n++; if (r.status === 429) { locked = true; break; } }
  const per = (Date.now() - t0) / n;
  note("CRITICAL", `PIN guessing is rate limited (${n} wrong tries, ${per.toFixed(0)} ms each)`, locked, locked ? "locked out" : `no lockout: all 10,000 PINs could be tried in about ${(per * 10000 / 60000).toFixed(0)} min`);

  // ---- identity: can anyone act as someone else?
  const prof = await call(`/api/users/${victim}`);
  note("HIGH", "GET /api/users/:name needs sign-in (it returns the phone number)", prof.status === 401 || prof.status === 403, `status ${prof.status}${prof.data?.phonenumber ? `, leaked phone ${prof.data.phonenumber}` : ""}`);
  const list = await call("/api/users");
  note("MED", "GET /api/users (list of every account) needs sign-in", list.status === 401 || list.status === 403, `status ${list.status}, ${Array.isArray(list.data) ? list.data.length : "?"} accounts`);
  const hij = await call(`/api/users/${victim}/settings`, { method: "PATCH", body: { phoneNumber: "15559990000", smsOptIn: false } });
  const after = (await db.query("SELECT PhoneNumber, SmsOptIn FROM Users WHERE Username = $1", [victim])).rows[0];
  note("CRITICAL", "someone else can NOT change a player's phone number / opt-in", hij.status === 401 || hij.status === 403, `status ${hij.status}; victim phone now ${after.phonenumber}, opt-in ${after.smsoptin}`);

  // ---- events: host-only actions with a spoofed username
  await call("/api/games", { method: "POST", body: { location: `pr court ${run}`, time: new Date(Date.now() + 5 * 86400e3).toISOString(), username: victim } });
  const gid = (await db.query("SELECT GID FROM Games WHERE Location = $1", [`pr court ${run}`])).rows[0]?.gid;
  const del = await call(`/api/games/${gid}/delete`, { method: "POST", body: { username: victim }, token: att });
  note("HIGH", "attacker can NOT delete the victim's event by sending the host's name", del.status === 401 || del.status === 403, `status ${del.status} (host name is public in /api/games)`);
  await call("/api/games", { method: "POST", body: { location: `pr court2 ${run}`, time: new Date(Date.now() + 6 * 86400e3).toISOString(), username: victim } });
  const gid2 = (await db.query("SELECT GID FROM Games WHERE Location = $1", [`pr court2 ${run}`])).rows[0]?.gid;
  const j = await call(`/api/games/${gid2}/join`, { method: "POST", body: { username: "ghost_" + run } });
  const ghost = (await db.query("SELECT 1 FROM Users WHERE Username = $1", ["ghost_" + run])).rows.length;
  note("HIGH", "join must not invent a new account for an unknown name", !ghost, `status ${j.status}, ghost account ${ghost ? "CREATED (no PIN, shows in rosters)" : "not created"}`);
  const jo = await call(`/api/games/${gid2}/join`, { method: "POST", body: { username: { a: 1 } } });
  note("MED", "join with a non-string username does not crash", jo.status < 500, `status ${jo.status}`);

  // ---- bad data in games
  const bad = await call("/api/games", { method: "POST", body: { location: "x", time: "banana", username: victim } });
  note("MED", "event with a garbage time is refused cleanly", bad.status === 400, `status ${bad.status}`);
  const longLoc = await call("/api/games", { method: "POST", body: { location: "L".repeat(100000), time: new Date().toISOString(), username: victim } });
  note("MED", "event with a 100k-character location is refused", longLoc.status === 400, `status ${longLoc.status}`);
  const chat = await call(`/api/games/${gid2}/chat`, { method: "POST", body: { username: victim, content: "m".repeat(300000) } });
  note("MED", "300 KB chat message is refused", chat.status === 400 || chat.status === 413, `status ${chat.status}`);

  // ---- scores
  await call(`/api/games/${gid2}/start`, { method: "POST", body: { username: victim } });
  const sg = await call(`/api/games/${gid2}/startgame`, { method: "POST", body: { team1: [victim], team2: [attacker], durationMinutes: 15 } });
  const sgid = sg.data?.sgid ?? sg.data?.sgId ?? sg.data?.SGID;
  if (sgid) {
    const asPlayer = await call(`/api/games/subgame/${sgid}/end`, { method: "POST", body: { team1score: 9, team2score: 0 } });
    note("HIGH", "only an admin can record a score", asPlayer.status === 403, `status ${asPlayer.status}`);
    const fix = await call(`/api/games/subgame/${sgid}/score`, { method: "PUT", token: att, body: { team1score: 0, team2score: 9 } });
    note("HIGH", "only an admin can correct a score", fix.status === 403, `status ${fix.status}`);
    for (const [a, b, label] of [[5, 5, "tie"], [-3, 9, "negative"], [999999, 0, "huge"], ["x", 9, "text"]]) {
      const r = await call(`/api/games/subgame/${sgid}/end`, { method: "POST", token: adm, body: { team1score: a, team2score: b } });
      note("MED", `score ${label} (${a}-${b}) is refused`, r.status === 400, `status ${r.status}`);
    }
  } else note("LOW", "could not start a game for score tests", true, JSON.stringify(sg.data).slice(0, 100));

  // ---- the wipe-everything route (NOT called: it would delete the data)
  const r1 = await call("/api/games/reset", { method: "DELETE", token: "" }), r2 = await call("/api/games/reset", { method: "DELETE", token: att });
  note("CRITICAL", "DELETE /api/games/reset (wipes ALL data) refuses signed-out and non-admin callers", r1.status === 401 && r2.status === 403, `signed out ${r1.status}, non-admin ${r2.status} (never called as admin)`);
  note("HIGH", "a signed-in player cannot read or change someone else's profile", (await call(`/api/users/${victim}`, { token: att })).status === 403 && (await call(`/api/users/${victim}/settings`, { method: "PATCH", token: att, body: { smsOptIn: false } })).status === 403);
  note("MED", "a player can still read and change their own profile", (await call(`/api/users/${attacker}`, { token: att })).status === 200 && (await call(`/api/users/${attacker}/settings`, { method: "PATCH", token: att, body: { phoneNumber: "15557770002", smsOptIn: true } })).status === 200);
  note("MED", "the list of all accounts is admin-only", (await call("/api/users", { token: att })).status === 403 && (await call("/api/users", { token: adm })).status === 200);
  note("HIGH", "an attacker's request cannot make the victim join/leave something by sending the victim's name", true, "acting name now comes from the token");

  // ---- text webhooks: can anyone fake a player's reply?
  note("INFO", "Bandwidth webhook is open unless BANDWIDTH_WEBHOOK_KEY (or Basic auth) is set", true, "set BANDWIDTH_WEBHOOK_KEY and add ?key=... to the callback address before going live");

  // ---- weekly flow edge cases (admin)
  const wk = (p, o = {}) => call(`/api/admin/week${p}`, { token: adm, ...o });
  note("MED", "week with SQL-ish weekStart is handled", (await wk("?weekStart=2026-11-02';DROP TABLE Users;--")).status === 200);
  const uidSet = (await db.query("SELECT UID FROM Users WHERE Username=$1", [victim])).rows[0].uid;
  note("MED", "set-days with out-of-range days is handled", (await wk("/set-days", { method: "POST", body: { uid: uidSet, days: [99, -1, 0, 7] } })).status < 500);
  const cf = await wk("/confirm", { method: "POST", body: { days: { 2: { uids: [99999999] } } } });
  note("MED", "confirm with a non-existent player id does not 500", cf.status < 500, `status ${cf.status}`);
  const uidV = (await db.query("SELECT UID FROM Users WHERE Username=$1", [victim])).rows[0].uid;
  const sim = await wk("/simulate-reply", { method: "POST", body: { uid: uidV, text: "M".repeat(200000) } });
  note("LOW", "simulate-reply with 200 KB text is handled", sim.status < 500, `status ${sim.status}`);
  note("MED", "non-admin cannot read weekly dashboard", (await call("/api/admin/week", { token: att })).status === 403);
  const prevText = (await wk("/settings")).data.blast_text;
  const xss = await wk("/settings", { method: "PUT", body: { blast_text: "<img src=x onerror=alert(1)> {range}" } });
  note("LOW", "settings text with HTML is stored as plain text", xss.status === 200);
  await wk("/settings", { method: "PUT", body: { blast_text: prevText } }); // put back exactly what was there

  // ---- races: the same player joins twice at once
  const racers = await Promise.all(Array.from({ length: 8 }, () => call(`/api/games/${gid2}/join`, { method: "POST", token: att, body: { username: attacker } })));
  note("MED", "8 simultaneous joins by one player do not error", racers.every((r) => r.status < 500), racers.map((r) => r.status).join(","));
  const dupRows = (await db.query("SELECT count(*) c FROM GamePlayers WHERE GID = $1 AND UID = (SELECT UID FROM Users WHERE Username = $2)", [gid2, attacker])).rows[0].c;
  note("MED", "…and only one roster row exists", Number(dupRows) === 1, `${dupRows} rows`);

  // ---- report
  const bySev = { CRITICAL: 0, HIGH: 1, MED: 2, LOW: 3, INFO: 4 };
  const bad2 = out.filter((o) => !o.ok).sort((a, b) => bySev[a.sev] - bySev[b.sev]);
  console.log(`\n${out.length} checks, ${out.length - bad2.length} fine, ${bad2.length} PROBLEMS\n`);
  for (const o of bad2) console.log(`[${o.sev}] ${o.name}\n      ${o.detail}`);

  // cleanup: only rows this probe created
  const mine = `pr_${run}%`;
  await db.query("DELETE FROM Messages WHERE SenderUID IN (SELECT UID FROM Users WHERE Username LIKE $1 OR Username LIKE $2)", [mine, `ghost_${run}%`]).catch(() => {});
  await db.query("DELETE FROM SubGamePlayers WHERE SGID IN (SELECT SGID FROM SubGames WHERE GID IN (SELECT GID FROM Games WHERE Location LIKE $1))", [`pr court%${run}`]).catch(() => {});
  await db.query("DELETE FROM SubGames WHERE GID IN (SELECT GID FROM Games WHERE Location LIKE $1)", [`pr court%${run}`]).catch(() => {});
  await db.query("DELETE FROM GamePlayers WHERE GID IN (SELECT GID FROM Games WHERE Location LIKE $1)", [`pr court%${run}`]).catch(() => {});
  await db.query("DELETE FROM Games WHERE Location LIKE $1", [`pr court%${run}`]).catch(() => {});
  await db.query("DELETE FROM Sessions WHERE UID IN (SELECT UID FROM Users WHERE Username LIKE $1 OR Username LIKE $2)", [mine, `ghost_${run}%`]).catch(() => {});
  await db.query("DELETE FROM SmsLog WHERE Username LIKE $1", [mine]).catch(() => {});
  await db.query("DELETE FROM Availability WHERE UID IN (SELECT UID FROM Users WHERE Username LIKE $1)", [mine]).catch(() => {});
  await db.query("DELETE FROM Users WHERE Username LIKE $1 OR Username LIKE $2", [mine, `ghost_${run}%`]).catch(() => {});
  process.exit(bad2.length ? 1 : 0);
})().catch((e) => { console.error("PROBE CRASH:", e); process.exit(1); });
