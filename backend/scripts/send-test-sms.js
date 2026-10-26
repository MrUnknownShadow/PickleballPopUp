// Usage: node scripts/send-test-sms.js +15551234567 "message"
require("dotenv").config();
const { sendSms } = require("../src/sms");
const [to, ...rest] = process.argv.slice(2);
if (!to) { console.error('Usage: node scripts/send-test-sms.js +15551234567 "message"'); process.exit(1); }
sendSms(to, rest.join(" ") || "PicklePlay test text").then(
  (r) => { console.log(r); process.exit(0); },
  (e) => { console.error(e.message); process.exit(1); }
);
