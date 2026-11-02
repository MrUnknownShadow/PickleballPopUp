const db = require("./db");

// Admin-editable settings (message wording and timing). {placeholders} are filled in when texts are sent.
const DEFAULTS = {
  blast_auto: "0",           // "1" = send the weekly blast by itself on blast_day/blast_time. Off until the admin turns it on.
  blast_time: "14:00",       // Sunday, venue time
  cutoff_hours: "6",         // replies later than this after the blast are kept but marked late
  default_time: "18:00",     // time and place given to a confirmed day unless the admin changes them
  default_location: "court 1",
  reminder_hours: "24",      // day-before reminder goes out this long before the game
  ack_replies: "1",          // "1" = text back after a reply ("Got it ...")
  blast_text: "BARnBoy Group: which days can you play {range}? Reply with days like M T W Th F, or None. Reply STOP to opt out.",
  confirm_text: "BARnBoy Group: you've been selected for {days}. Full schedule: {link} Reply STOP to opt out.",
  removed_text: "BARnBoy Group: update, you're no longer scheduled for {days}. Schedule: {link}",
  ack_days_text: "BARnBoy Group: got it, {days}. Reply again to change.",
  ack_none_text: "BARnBoy Group: got it, no days this week. Reply again to change.",
  unclear_text: "BARnBoy Group: sorry, didn't catch that. Reply with days like M T W Th F, or None.",
};

async function getSettings() {
  const { rows } = await db.query("SELECT Key AS key, Value AS value FROM Settings");
  return { ...DEFAULTS, ...Object.fromEntries(rows.map((r) => [r.key, r.value])) };
}

const HHMM = /^([01]?\d|2[0-3]):[0-5]\d$/;
const RULES = {
  blast_auto: [/^[01]$/, "must be on or off"],
  ack_replies: [/^[01]$/, "must be on or off"],
  blast_time: [HHMM, "must look like 14:00"],
  default_time: [HHMM, "must look like 18:00"],
  cutoff_hours: [/^\d{1,3}$/, "must be a whole number of hours"],
  reminder_hours: [/^\d{1,3}$/, "must be a whole number of hours"],
};

// Only known keys, only strings, trimmed, length-limited and checked (a bad time would silently stop the Sunday send).
async function saveSettings(input) {
  for (const key of Object.keys(DEFAULTS)) {
    if (typeof input[key] !== "string") continue;
    const v = input[key].trim();
    if (RULES[key] && !RULES[key][0].test(v)) { const e = new Error(`${key.replace(/_/g, " ")} ${RULES[key][1]}`); e.status = 400; throw e; }
    if (!v) { const e = new Error(`${key.replace(/_/g, " ")} cannot be empty`); e.status = 400; throw e; }
    await db.query(
      "INSERT INTO Settings (Key, Value) VALUES ($1, $2) ON CONFLICT (Key) DO UPDATE SET Value = EXCLUDED.Value",
      [key, input[key].trim().slice(0, 400)]
    );
  }
  return getSettings();
}

const fill = (template, vars) => template.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));

module.exports = { DEFAULTS, getSettings, saveSettings, fill };
