// Recomputes every table in the sponsor's October_2026_Pickleball.pdf from its game lists and compares row by row.
// Run: node scripts/check-stats.js
const assert = require("assert");
const { playerStats, classify } = require("../src/stats");
const { SHEETS, MONTH } = require("./fixtures/october-2026");

const lines = (s) => s.trim().split("\n").map((l) => l.trim());
const parseGame = (l) => {
  const m = l.match(/^(\w+) & (\w+) (\d+) (\d+) (\w+) & (\w+)$/);
  return { team1: [m[1], m[2]], s1: +m[3], s2: +m[4], team2: [m[5], m[6]] };
};
const sign = (n) => (n > 0 ? `+${n}` : String(n));
const daily = (r) => `${r.player} ${r.w}-${r.l} ${r.winPct}% ${r.pf} ${r.pa} ${sign(r.diff)} ${r.srvPct}% ${r.rcvPct}% ${r.streak} ${r.avgMgn.toFixed(1)} ${r.closeW}-${r.closeL}`;
const combined = (r) => `${r.player} ${r.w}-${r.l} ${r.winPct}% ${r.pf} ${r.avgF.toFixed(1)} ${r.pa} ${r.avgA.toFixed(1)} ${sign(r.diff)} ${r.srvPct}% ${r.rcvPct}% ${r.streak} ${r.avgMgn.toFixed(1)} ${r.closeW}-${r.closeL}`;
const CODE = { close: "C", blowout: "B", shutout: "S", null: "-" };

const all = [];
let rows = 0, earlier = [];
for (const [day, [gamesText, colours, statsText]] of Object.entries(SHEETS)) {
  const games = lines(gamesText).map(parseGame);
  all.push(...games);
  assert.equal(games.map((g) => CODE[classify(g.s1, g.s2)]).join(""), colours, `${day} row colours`);
  assert.deepEqual(playerStats(games, day.includes("Sheet 2") ? earlier : []).map(daily), lines(statsText), `${day} player stats`);
  earlier = games.flatMap((g) => [...g.team1, ...g.team2]);
  rows += games.length;
}
assert.deepEqual(playerStats(all).map(combined), lines(MONTH), "combined summary");
console.log(`OK: ${Object.keys(SHEETS).length} sheets, ${rows} games, row colours, every daily table and the combined summary match the PDF`);
