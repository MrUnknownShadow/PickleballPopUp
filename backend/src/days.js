// Turns a player's text reply into weekdays. Pure function: parseDays("MWF") -> { kind: "days", days: [1,3,5] }.
// kind is "days" | "none" | "unclear". 1 = Monday ... 5 = Friday; weekends are not offered yet.
const NAMES = { 1: "Monday", 2: "Tuesday", 3: "Wednesday", 4: "Thursday", 5: "Friday" };
const FULL = Object.entries(NAMES).map(([n, w]) => [w.toLowerCase(), +n]);
const SHORT = { mon: 1, mons: 1, tue: 2, tues: 2, tu: 2, wed: 3, weds: 3, thu: 4, thur: 4, thurs: 4, thr: 4, th: 4, fri: 5, m: 1, t: 2, w: 3, f: 5 };
const NONE = new Set(["none", "na", "no", "nope", "n", "cant", "cannot", "out", "0", "nothing", "notavailable", "unavailable"]);
const ALL = new Set(["all", "any", "every", "everyday", "allweek", "anyday", "weekdays"]);
const WEEKEND = new Set(["sat", "saturday", "sun", "sunday", "weekend", "weekends"]); // not offered yet -> needs review
const FILLER = new Set(["and", "plus", "i", "im", "ill", "can", "could", "play", "on", "only", "the", "a", "available", "am", "is", "for", "please", "thanks", "thank", "you", "do", "day", "days", "to", "just", "also"]);

function edit(a, b) { // Levenshtein distance
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

function oneDay(tok) { // a single weekday word, or null
  if (SHORT[tok]) return SHORT[tok];
  for (const [w, n] of FULL) if (tok === w || tok === w + "s") return n;
  if (WEEKEND.has(tok)) return null;
  if (tok.length >= 5) for (const [w, n] of FULL) if (edit(tok, w) <= (tok.length >= 7 ? 2 : 1)) return n; // misspellings like "wensday"
  return null;
}

function letters(tok) { // "mwf", "tth", "mtwthf" -> day numbers, or null if any letter is not m/t/w/h/f
  if (!/^[mtwhf]{2,}$/.test(tok)) return null;
  const out = [];
  for (let i = 0; i < tok.length; i++) {
    const c = tok[i];
    if (c === "m") out.push(1);
    else if (c === "w") out.push(3);
    else if (c === "f") out.push(5);
    else if (c === "t") { if (tok[i + 1] === "h") { out.push(4); i++; } else out.push(2); }
    else return null; // a stray "h"
  }
  return out;
}

function parseDays(text) {
  const s = String(text || "").toLowerCase().replace(/n\/a/g, "na").replace(/[’']/g, "").replace(/[^a-z0-9\-\s,;/+&]/g, " ");
  const toks = s.split(/[\s,;/+&]+/).filter(Boolean);
  const days = new Set();
  let none = false, all = false, bad = false;
  for (const raw of toks) {
    const range = raw.match(/^([a-z]+)-([a-z]+)$/); // mon-wed
    if (range) {
      const a = oneDay(range[1]), b = oneDay(range[2]);
      if (a && b && a <= b) for (let n = a; n <= b; n++) days.add(n); else bad = true;
      continue;
    }
    const tok = raw.replace(/-/g, "");
    if (FILLER.has(tok)) continue;
    if (NONE.has(tok)) { none = true; continue; }
    if (ALL.has(tok)) { all = true; continue; }
    const one = oneDay(tok);
    if (one) { days.add(one); continue; }
    const many = letters(tok);
    if (many) { many.forEach((n) => days.add(n)); continue; }
    bad = true;
  }
  if (bad || (none && (days.size || all)) || (!none && !days.size && !all)) return { kind: "unclear", days: [] };
  if (none) return { kind: "none", days: [] };
  if (all) return { kind: "days", days: [1, 2, 3, 4, 5] };
  return { kind: "days", days: [...days].sort() };
}

const dayList = (days) => days.map((n) => NAMES[n]).join(", ");

module.exports = { parseDays, dayList, NAMES };
