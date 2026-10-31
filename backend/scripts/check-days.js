// Quick check of the reply parser. Run: node scripts/check-days.js
const assert = require("assert");
const { parseDays } = require("../src/days");
const d = (t) => { const r = parseDays(t); return r.kind === "days" ? r.days.join("") : r.kind; };
const cases = {
  "MWF": "135", "mwf": "135", "TTh": "24", "tth": "24", "M T W Th F": "12345", "MTWThF": "12345", "m, w, f": "135",
  "Mon and Wed": "13", "Monday!!": "1", "Thurs": "4", "tues thurs": "24", "Tuesday, Thursday": "24", "Th": "4", "T": "2",
  "I can do Tuesday and Thursday": "24", "wensday": "3", "thursdy": "4", "mon-wed": "123", "M-F": "12345", "all": "12345", "any day": "12345",
  "None": "none", "N/A": "none", "na": "none", "n/a": "none", "N": "none", "No": "none", "can't": "none", "cant": "none",
  "Sat": "unclear", "Sunday": "unclear", "yes": "unclear", "tomorrow": "unclear", "hello there": "unclear", "": "unclear",
  "none mon": "unclear", "mwx": "unclear", "wh": "unclear",
};
for (const [text, want] of Object.entries(cases)) assert.equal(d(text), want, `"${text}" -> ${d(text)}, expected ${want}`);
console.log(`OK: ${Object.keys(cases).length} reply examples parsed as expected`);
