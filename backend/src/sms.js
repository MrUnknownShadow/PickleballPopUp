const db = require("./db");

// Bandwidth Build: exchange the OAuth client id/secret for a bearer token (cached until just before it expires).
let bwToken = null, bwExpires = 0;
async function bandwidthToken(id, secret) {
  if (bwToken && Date.now() < bwExpires) return bwToken;
  const res = await fetch("https://api.bandwidth.com/api/v1/oauth2/token", {
    method: "POST",
    headers: { Authorization: "Basic " + Buffer.from(`${id}:${secret}`).toString("base64"), "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Bandwidth auth ${res.status}: ${data.error_description || data.error || data.message || "failed"}`);
  bwToken = data.access_token;
  bwExpires = Date.now() + (data.expires_in - 30) * 1000;
  return bwToken;
}

// Sends via Telnyx, Bandwidth Build or Twilio (REST via fetch, no SDK). SMS_PROVIDER=telnyx|bandwidth|twilio
// picks one; otherwise the first provider whose variables are all set wins, in that order.
// Without credentials, or with SMS_DRY_RUN=1, it logs instead of sending, so dev and teammates
// without an account can run the app.
async function sendSms(to, body) {
  const { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token, TWILIO_FROM_NUMBER: from } = process.env;
  const { BANDWIDTH_ACCOUNT_ID: bwAcct, BANDWIDTH_CLIENT_ID: bwId, BANDWIDTH_CLIENT_SECRET: bwSecret,
          BANDWIDTH_APPLICATION_ID: bwApp, BANDWIDTH_FROM_NUMBER: bwFrom } = process.env;
  const { TELNYX_API_KEY: tlKey, TELNYX_FROM_NUMBER: tlFrom, SMS_PROVIDER: want } = process.env;
  const ready = { telnyx: tlKey && tlFrom, bandwidth: bwAcct && bwId && bwSecret && bwApp && bwFrom, twilio: sid && token && from };
  const provider = want ? (ready[want] ? want : null) : ["telnyx", "bandwidth", "twilio"].find((p) => ready[p]);
  if (process.env.SMS_DRY_RUN === "1" || !provider) {
    console.log(`[sms dry-run] to=${to} body=${JSON.stringify(body)}`);
    return { dryRun: true };
  }
  if (provider === "telnyx") {
    const res = await fetch("https://api.telnyx.com/v2/messages", {
      method: "POST",
      headers: { Authorization: `Bearer ${tlKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: tlFrom, to, text: body }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Telnyx ${res.status}: ${data.errors?.[0]?.detail || data.errors?.[0]?.title || JSON.stringify(data)}`);
    return { sid: data.data?.id, status: data.data?.to?.[0]?.status || "queued" };
  }
  if (provider === "bandwidth") {
    // Build trial rejects non-ASCII (curly quotes, dashes, emoji) and only texts the verified number.
    const text = body.replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/[\u2013\u2014]/g, "-").replace(/[^\x00-\x7F]/g, "");
    const res = await fetch(`https://api.bandwidth.com/v1/build/accounts/${bwAcct}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${await bandwidthToken(bwId, bwSecret)}`, "Content-Type": "application/json" },
      body: JSON.stringify({ applicationId: bwApp, to: [to], from: bwFrom, text }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Bandwidth ${res.status}: ${data.description || data.message || JSON.stringify(data)}`);
    return { sid: data.id, status: "sent" };
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
  const base = process.env.PUBLIC_BASE_URL || process.env.RENDER_EXTERNAL_URL; // Render sets the latter
  if (!base) return false;
  const params = req.body || {};
  const data = base + req.originalUrl + Object.keys(params).sort().map((k) => k + params[k]).join("");
  const expected = require("crypto").createHmac("sha1", token).update(data).digest("base64");
  const got = req.get("X-Twilio-Signature") || "";
  return got.length === expected.length && require("crypto").timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}

// Bandwidth callbacks carry no signature; they use HTTP Basic auth if you set credentials on the application.
// Set BANDWIDTH_WEBHOOK_USER / BANDWIDTH_WEBHOOK_PASSWORD to the same values to enforce it.
function validBandwidthAuth(req) {
  const { BANDWIDTH_WEBHOOK_USER: u, BANDWIDTH_WEBHOOK_PASSWORD: p } = process.env;
  if (!u || !p || process.env.SMS_DRY_RUN === "1") return true; // dry-run / local dev
  const expected = "Basic " + Buffer.from(`${u}:${p}`).toString("base64");
  const got = req.get("Authorization") || "";
  return got.length === expected.length && require("crypto").timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}

// Telnyx signs webhooks with Ed25519 over `${timestamp}|${raw body}`; TELNYX_PUBLIC_KEY is the base64 key from
// Mission Control > Keys & Credentials > Public Key. Unset = unchecked (dev only).
function validTelnyxSignature(req) {
  const key = process.env.TELNYX_PUBLIC_KEY;
  if (!key || process.env.SMS_DRY_RUN === "1") return true;
  const ts = req.get("telnyx-timestamp") || "", sig = req.get("telnyx-signature-ed25519") || "";
  if (!ts || !sig || !req.rawBody || Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  try {
    const pub = require("crypto").createPublicKey({ key: Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), Buffer.from(key, "base64")]), format: "der", type: "spki" });
    return require("crypto").verify(null, Buffer.concat([Buffer.from(`${ts}|`), req.rawBody]), pub, Buffer.from(sig, "base64"));
  } catch { return false; }
}

module.exports = { sendSms, sendSmsToUser, log, validTwilioSignature, validBandwidthAuth, validTelnyxSignature };
