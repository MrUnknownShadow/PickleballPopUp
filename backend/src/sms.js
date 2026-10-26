const db = require("./db");

// Twilio REST via fetch (no SDK dependency). Without credentials, or with SMS_DRY_RUN=1, it logs
// instead of sending, so dev and teammates without a Twilio account can run the app.
async function sendSms(to, body) {
  const { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token, TWILIO_FROM_NUMBER: from } = process.env;
  if (process.env.SMS_DRY_RUN === "1" || !sid || !token || !from) {
    console.log(`[sms dry-run] to=${to} body=${JSON.stringify(body)}`);
    return { dryRun: true };
  }
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Twilio ${res.status}: ${data.message}`);
  return { sid: data.sid, status: data.status };
}

async function log(user, gid, kind, direction, body, status, error) {
  await db.query(
    `INSERT INTO SmsLog (UID, Username, GID, Kind, Direction, Body, Status, Error)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [user.uid ?? null, user.username ?? null, gid ?? null, kind, direction, body, status, error ?? null]
  );
}

// Texts one user (row needs uid, username, phonenumber, smsoptin) and records the outcome in SmsLog.
// Opted-out users are never texted. Stored numbers are digits with country code.
// Returns 'sent' | 'dry_run' | 'skipped' | 'failed'.
async function sendSmsToUser(user, body, { kind, gid } = {}) {
  if (!user.smsoptin || !user.phonenumber) {
    await log(user, gid, kind, "out", body, "skipped", "no phone or not opted in");
    return "skipped";
  }
  try {
    const r = await sendSms(`+${user.phonenumber}`, body);
    const status = r.dryRun ? "dry_run" : "sent";
    await log(user, gid, kind, "out", body, status);
    return status;
  } catch (e) {
    await log(user, gid, kind, "out", body, "failed", e.message);
    return "failed";
  }
}

// Twilio signs webhooks; reject forged ones once real credentials are configured.
// Needs PUBLIC_BASE_URL (e.g. https://your-api.onrender.com) to rebuild the URL Twilio signed.
function validTwilioSignature(req) {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token || process.env.SMS_DRY_RUN === "1") return true; // dry-run / local dev
  const base = process.env.PUBLIC_BASE_URL;
  if (!base) return false;
  const params = req.body || {};
  const data = base + req.originalUrl + Object.keys(params).sort().map((k) => k + params[k]).join("");
  const expected = require("crypto").createHmac("sha1", token).update(data).digest("base64");
  const got = req.get("X-Twilio-Signature") || "";
  return got.length === expected.length && require("crypto").timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}

module.exports = { sendSms, sendSmsToUser, log, validTwilioSignature };
