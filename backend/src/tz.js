// Venue-timezone helpers. Dates are 'YYYY-MM-DD' strings, so nothing here depends on the server's timezone.
const DOW = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const pad = (n) => String(n).padStart(2, "0");
const venueTz = () => process.env.VENUE_TZ || "America/Chicago";

// Wall-clock parts of an instant in the venue timezone.
function parts(date = new Date()) {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: venueTz(), year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: "h23" });
  const o = Object.fromEntries(f.formatToParts(date).map((p) => [p.type, p.value]));
  return { y: +o.year, m: +o.month, d: +o.day, h: +o.hour, min: +o.minute, dow: DOW[o.weekday], ymd: `${o.year}-${o.month}-${o.day}` };
}

function addDays(ymd, n) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

// Monday of the week to schedule: Mon-Fri -> this week's Monday; Sat/Sun -> the coming Monday.
function weekStartFor(now = new Date()) {
  const { ymd, dow } = parts(now);
  return addDays(ymd, dow === 0 ? 1 : dow === 6 ? 2 : 1 - dow);
}

// Venue wall-clock date + 'HH:MM' -> the exact UTC instant.
function zonedToUtc(ymd, hhmm) {
  const [y, m, d] = ymd.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, h, mi);
  const p = parts(new Date(guess));
  return new Date(guess - (Date.UTC(p.y, p.m - 1, p.d, p.h, p.min) - guess)); // ponytail: one pass, can be an hour off exactly at a DST change
}

module.exports = { parts, addDays, weekStartFor, zonedToUtc, venueTz, pad };
