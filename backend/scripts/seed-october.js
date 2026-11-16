// Loads the sponsor's October 2026 games into a LOCAL database so the Results pages can be compared with the PDF.
// Usage: node scripts/seed-october.js            (add --remove to delete everything it added)
// Players are created as accounts that cannot sign in (no PIN), marked with Email 'seed:october-2026'.
require("dotenv").config({ quiet: true });
const db = require("../src/db");
const { zonedToUtc } = require("../src/tz");
const { SHEETS } = require("./fixtures/october-2026");

const MARK = "seed:october-2026", PLACE = "october 2026 demo";

(async () => {
  if (!/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL || "")) throw new Error("Refusing: DATABASE_URL is not a local database");
  await db.query("DELETE FROM Games WHERE Location = $1", [PLACE]);
  await db.query("DELETE FROM Users WHERE Email = $1", [MARK]);
  if (process.argv.includes("--remove")) return console.log("Removed the October demo data");

  const uid = {};
  for (const [day, [gamesText]] of Object.entries(SHEETS)) {
    const games = gamesText.trim().split("\n").map((l) => l.trim().match(/^(\w+) & (\w+) (\d+) (\d+) (\w+) & (\w+)$/));
    for (const name of new Set(games.flatMap((m) => [m[1], m[2], m[5], m[6]]).map((n) => n.toLowerCase()))) {
      if (uid[name]) continue;
      const { rows } = await db.query("SELECT UID, Email FROM Users WHERE Username = $1", [name]);
      if (rows[0]) throw new Error(`A real account named "${name}" already exists; not mixing demo games into it`);
      uid[name] = (await db.query("INSERT INTO Users (Username, Email) VALUES ($1, $2) RETURNING UID", [name, MARK])).rows[0].uid;
    }
    const [m, d] = day.split(" ")[0].split("/");
    const start = zonedToUtc(`2026-${m.padStart(2, "0")}-${d.padStart(2, "0")}`, day.includes("Sheet 2") ? "19:30" : "17:00");
    const gid = (await db.query(
      "INSERT INTO Games (GameTime, Location, Status, StartedAt, EndedAt) VALUES ($1, $2, 'completed', $1, $1) RETURNING GID", [start, PLACE]
    )).rows[0].gid;
    for (const [i, g] of games.entries()) {
      const at = new Date(start.getTime() + i * 15 * 60e3);
      const sgid = (await db.query(
        "INSERT INTO SubGames (GID, Team1Score, Team2Score, CreatedAt, StartedAt, EndedAt, Status) VALUES ($1, $2, $3, $4, $4, $4, 'completed') RETURNING SGID",
        [gid, +g[3], +g[4], at]
      )).rows[0].sgid;
      for (const [team, names] of [[1, [g[1], g[2]]], [2, [g[5], g[6]]]]) {
        for (const [seat, n] of names.entries()) await db.query("INSERT INTO SubGamePlayers (SGID, UID, Team, IsWinner, Seat) VALUES ($1, $2, $3, $4, $5)", [sgid, uid[n.toLowerCase()], team, (team === 1) === (+g[3] > +g[4]), seat]);
      }
    }
  }
  console.log(`Added ${Object.keys(SHEETS).length} October sessions for ${Object.keys(uid).length} demo players at "${PLACE}"`);
})().then(() => process.exit(0), (e) => { console.error(e.message); process.exit(1); });
