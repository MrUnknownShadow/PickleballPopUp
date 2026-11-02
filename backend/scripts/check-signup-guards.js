// Checks the sign-up guards: per-address limit and the optional group code. Starts its own throwaway dry-run server on port 3003
// with REGISTER_LIMIT_PER_HOUR=4 and SIGNUP_CODE set, so it needs nothing running. Usage: node scripts/check-signup-guards.js
require("dotenv").config({ quiet: true });
const assert = require("assert");
const { spawn } = require("child_process");
const db = require("../src/db");
const API = "http://localhost:3003", run = Date.now().toString().slice(-6), CODE = "test-code-" + run;
const post = async (body) => { const r = await fetch(API + "/api/users/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); return { status: r.status, data: await r.json().catch(() => ({})) }; };
const user = (i, extra = {}) => ({ username: `sg_${run}_${i}`, pin: "4821", phoneNumber: `558${run}${i}`.slice(0, 10), ...extra });

(async () => {
  const srv = spawn("node", ["server.js"], { cwd: __dirname + "/..", env: { ...process.env, PORT: "3003", SMS_DRY_RUN: "1", REGISTER_LIMIT_PER_HOUR: "4", SIGNUP_CODE: CODE }, stdio: "ignore" });
  try {
    for (let i = 0; i < 40; i++) { try { if ((await fetch(API + "/api/users/config")).ok) break; } catch {} await new Promise((r) => setTimeout(r, 250)); }
    const cfg = await (await fetch(API + "/api/users/config")).json();
    assert.equal(cfg.signupCodeRequired, true); assert(!JSON.stringify(cfg).includes(CODE), "the code itself is never sent to the browser");
    assert.equal((await post(user(1))).status, 403, "no code -> refused");
    assert.equal((await post(user(2, { groupCode: "wrong" }))).status, 403, "wrong code -> refused");
    assert.equal((await post(user(3, { groupCode: CODE }))).status, 201, "right code -> account created");
    // the 4th attempt from this address is still inside the limit of 4 per hour; the 5th is not
    assert.equal((await post(user(4, { groupCode: CODE }))).status, 201);
    assert.equal((await post(user(5, { groupCode: CODE }))).status, 429, "over the per-address limit -> 429");
    console.log("OK: group code required and never leaked, wrong code refused, right code works, per-address limit enforced");
  } finally {
    srv.kill();
    await db.query("DELETE FROM Users WHERE Username LIKE $1", [`sg_${run}_%`]).catch(() => {});
    process.exit(process.exitCode || 0);
  }
})().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
