// Scorekeeping statistics in the format of the sponsor's monthly report (October_2026_Pickleball.pdf).
// Input is a list of finished games in play order: { team1: [names], team2: [names], s1, s2 }.
// Definitions were worked out from the report and match every row of it (see scripts/check-stats.js):
//   Srv% = win rate when on Team 1, Rcv% = win rate when on Team 2 (0% when never on that side),
//   AvgMgn = average point gap of the player's games (wins and losses), Close = W-L in games decided by 3 or less
//   (the report's Close column counts 3-point games even though its blue row colour is only for 2 or less),
//   Streak = the run of wins or losses at the end, carried across sessions in a combined summary.

// The report rounds like Python's round(): exact halves go to the even neighbour (62.5% -> 62, 87.5% -> 88, 2.25 -> 2.2),
// and anything else rounds by the float's exact value (4.35 is stored as 4.3499.. and gives 4.3).
function pyRound(x, digits = 0) {
  const [int, frac] = Math.abs(x).toFixed(100).split(".");
  const keep = int + frac.slice(0, digits), rest = frac.slice(digits);
  let n = BigInt(keep);
  if (rest[0] > "5" || (rest[0] === "5" && (/[1-9]/.test(rest.slice(1)) || n % 2n === 1n))) n += 1n;
  const v = Number(n) / 10 ** digits;
  return x < 0 ? -v : v;
}

function classify(s1, s2) {
  if (s1 === 0 || s2 === 0) return "shutout";
  const gap = Math.abs(s1 - s2);
  if (gap > 6) return "blowout";
  if (gap <= 2) return "close";
  return null;
}

// One row per player, best Win% first, ties in the order players first appeared. `order` can list names that
// appeared earlier (the report's second sheet for 10/23 keeps the first sheet's order).
function playerStats(games, order = []) {
  const by = new Map();
  const get = (name) => {
    if (!by.has(name)) by.set(name, { player: name, order: by.size, w: 0, l: 0, pf: 0, pa: 0, margin: 0, srvW: 0, srvG: 0, rcvW: 0, rcvG: 0, closeW: 0, closeL: 0, results: [] });
    return by.get(name);
  };
  for (const name of order) get(name);
  for (const g of games) {
    const close = Math.abs(g.s1 - g.s2) <= 3;
    for (const [team, side, mine, theirs] of [[g.team1, 1, g.s1, g.s2], [g.team2, 2, g.s2, g.s1]]) {
      for (const name of team) {
        const p = get(name), won = mine > theirs;
        won ? p.w++ : p.l++;
        p.pf += mine; p.pa += theirs; p.margin += Math.abs(mine - theirs);
        if (side === 1) { p.srvG++; if (won) p.srvW++; } else { p.rcvG++; if (won) p.rcvW++; }
        if (close) won ? p.closeW++ : p.closeL++;
        p.results.push(won ? "W" : "L");
      }
    }
  }
  const pct = (w, n) => (n ? pyRound((100 * w) / n) : 0);
  return [...by.values()]
    .filter((p) => p.results.length)
    .sort((a, b) => b.w * (a.w + a.l) - a.w * (b.w + b.l) || a.order - b.order)
    .map((p) => {
      const n = p.w + p.l, last = p.results[n - 1];
      let run = 0;
      while (run < n && p.results[n - 1 - run] === last) run++;
      return {
        player: p.player, w: p.w, l: p.l, winPct: pct(p.w, n),
        pf: p.pf, pa: p.pa, avgF: pyRound(p.pf / n, 1), avgA: pyRound(p.pa / n, 1), diff: p.pf - p.pa,
        srvPct: pct(p.srvW, p.srvG), rcvPct: pct(p.rcvW, p.rcvG),
        streak: `${last}${run}`, avgMgn: pyRound(p.margin / n, 1), closeW: p.closeW, closeL: p.closeL,
      };
    });
}

module.exports = { pyRound, classify, playerStats };
