const db = require("./db");

// Twilio REST via fetch (no SDK dependency). Without credentials it logs instead of sending,
// so dev and teammates without a Twilio account can run the app.
async function sendSms(to, body) {
  const { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token, TWILIO_FROM_NUMBER: from } = process.env;
  if (!sid || !token || !from) {
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

// Texts a user only if they opted in and have a phone number. Stored numbers are digits with country code.
async function sendSmsToUser(username, body) {
  const { rows } = await db.query(
    "SELECT PhoneNumber, SmsOptIn FROM Users WHERE Username = $1",
    [username]
  );
  const u = rows[0];
  if (!u || !u.smsoptin || !u.phonenumber) return { skipped: true };
  return sendSms(`+${u.phonenumber}`, body);
}

module.exports = { sendSms, sendSmsToUser };
