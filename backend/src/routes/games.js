const express = require("express");
const db = require("../db");

const { requireUser, requireAdmin } = require("../auth");

const router = express.Router();

// Final scores: whole numbers 0-99 and never a tie (a tie used to be recorded as a Team B win, which corrupted the leaderboard).
function scoreError(a, b) {
  const x = Number(a), y = Number(b);
  if (a === "" || b === "" || a === null || b === null || !Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x > 99 || y > 99) return "Scores must be whole numbers from 0 to 99";
  if (x === y) return "A game cannot end in a tie. Play on until one team leads.";
  return null;
}

// Every change (anything but GET) needs a signed-in user, and the acting username always comes from the login token,
// never from the request body, so nobody can act as the host or as another player by sending their name.
router.use((req, res, next) => {
  if (req.method === "GET") return next();
  requireUser(req, res, () => { req.body = { ...req.body, username: req.user.username }; next(); });
});

/* GET ALL EVENTS */
router.get("/", async (req, res) => {
  try {
    // With ?username=, hide events the player declined or was not selected for.
    const username = String(req.query.username || "").trim().toLowerCase();
    const { rows } = await db.query(
      `SELECT * FROM Games WHERE NOT EXISTS (
         SELECT 1 FROM GamePlayers JOIN Users ON Users.UID = GamePlayers.UID
         WHERE GamePlayers.GID = Games.GID AND Users.Username = $1
           AND GamePlayers.Status IN ('declined', 'not_selected'))
       ORDER BY GameTime DESC`,
      [username]
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

/* GET USERS */
router.get("/users", async (req, res) => {
  try {
    const { rows } = await db.query("SELECT Username FROM Users");
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

/* LEADERBOARD */
router.get("/leaderboard", async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT 
        Users.Username,
        COUNT(DISTINCT sgp.sgid) as "totalGames",
        SUM(CASE WHEN sgp.iswinner = true THEN 1 ELSE 0 END) as wins
      FROM Users
      JOIN SubGamePlayers sgp ON Users.UID = sgp.uid
      JOIN SubGames sg ON sgp.SGID = sg.SGID
      JOIN Games g ON sg.GID = g.GID
      WHERE g.Status = 'completed'
      GROUP BY Users.UID, Users.Username
      HAVING COUNT(DISTINCT sgp.sgid) > 0
      ORDER BY wins DESC
    `);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

/* HISTORY */
router.get("/history", async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT 
        Games.GID as gid,
        Games.Location as location,
        Games.GameTime as gametime,
        SubGames.SGID as sgid,
        SubGames.Team1Score as team1score,
        SubGames.Team2Score as team2score,
        SubGames.CreatedAt as createdat,
        sgp.IsWinner as iswinner,
        sgp.Team as team,
        Users.Username as username
      FROM Games
      JOIN SubGames ON Games.GID = SubGames.GID
      JOIN SubGamePlayers sgp ON SubGames.SGID = sgp.SGID
      JOIN Users ON sgp.UID = Users.UID
      WHERE Games.Status = 'completed'
      ORDER BY SubGames.CreatedAt DESC
    `);

    const grouped = {};
    rows.forEach((row) => {
      const key = row.sgid;
      if (!grouped[key]) {
        grouped[key] = {
          sgid: row.sgid,
          gid: row.gid,
          location: row.location,
          time: row.createdat,
          team1score: row.team1score,
          team2score: row.team2score,
          players: [],
          winners: [],
        };
      }
      if (row.username) grouped[key].players.push(row.username);
      if (row.iswinner) grouped[key].winners.push(row.username);
    });

    res.json(Object.values(grouped));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

/* CREATE EVENT */
router.post("/", async (req, res) => {
  try {
    let { location, time, username } = req.body;
    if (typeof location !== "string" || !location.trim() || location.length > 100) return res.status(400).json({ error: "Location must be 1 to 100 characters" });
    if (typeof time !== "string" || Number.isNaN(new Date(time).getTime())) return res.status(400).json({ error: "Enter a valid date and time" });

    location = location.trim().toLowerCase();
    username = username?.trim().toLowerCase();

    const existing = await db.query(
      "SELECT * FROM Games WHERE Location = $1 AND GameTime = $2",
      [location, time]
    );
    if (existing.rows.length > 0) return res.status(400).json({ error: "Event already exists!" });

    await db.query(
      "INSERT INTO Games (Location, GameTime, Status, CreatedBy) VALUES ($1, $2, 'scheduled', $3)",
      [location, time, username]
    );
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

/* GET PLAYERS FOR EVENT */
router.get("/:id/players", async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT Users.Username
      FROM GamePlayers
      JOIN Users ON GamePlayers.UID = Users.UID
      WHERE GamePlayers.GID = $1 AND GamePlayers.Status IN ('joined', 'selected')
    `, [req.params.id]);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

/* GET SUB-GAMES FOR EVENT */
router.get("/:id/subgames", async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT 
        SubGames.SGID as sgid,
        SubGames.Team1Score as team1score,
        SubGames.Team2Score as team2score,
        SubGames.CreatedAt as createdat,
        SubGames.StartedAt as startedat,
        SubGames.EndedAt as endedat,
        SubGames.Status as status,
        SubGames.DurationMinutes as durationminutes,
        sgp.Team as team,
        Users.Username as username
      FROM SubGames
      JOIN SubGamePlayers sgp ON SubGames.SGID = sgp.SGID
      JOIN Users ON sgp.UID = Users.UID
      WHERE SubGames.GID = $1
      ORDER BY SubGames.CreatedAt ASC
    `, [req.params.id]);

    const grouped = {};
    rows.forEach((row) => {
      const key = row.sgid;
      if (!grouped[key]) {
        grouped[key] = {
          sgid: row.sgid,
          team1score: row.team1score,
          team2score: row.team2score,
          createdat: row.createdat,
          startedat: row.startedat,
          endedat: row.endedat,
          status: row.status,
          durationminutes: row.durationminutes,
          team1: [],
          team2: [],
        };
      }
      if (row.team === 1) grouped[key].team1.push(row.username);
      if (row.team === 2) grouped[key].team2.push(row.username);
    });

    res.json(Object.values(grouped));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

/* RECORD SUB-GAME */
router.post("/:id/subgame", async (req, res) => {
  try {
    const { team1, team2, team1score, team2score } = req.body;
    const gameId = req.params.id;

    if (!Array.isArray(team1) || !Array.isArray(team2)) return res.status(400).json({ error: "Missing data" });
    const bad = scoreError(team1score, team2score);
    if (bad) return res.status(400).json({ error: bad });

    // Create sub-game
    const { rows: sgRows } = await db.query(
      "INSERT INTO SubGames (GID, Team1Score, Team2Score) VALUES ($1, $2, $3) RETURNING SGID",
      [gameId, team1score, team2score]
    );
    const sgid = sgRows[0].sgid;
    const team1wins = parseInt(team1score) > parseInt(team2score);

    // Record team 1 players
    for (const name of team1) {
      const { rows } = await db.query("SELECT * FROM Users WHERE Username = $1", [name.toLowerCase()]);
      if (rows.length > 0) {
        await db.query(
          "INSERT INTO SubGamePlayers (SGID, UID, Team, IsWinner) VALUES ($1, $2, $3, $4)",
          [sgid, rows[0].uid, 1, team1wins]
        );
      }
    }

    // Record team 2 players
    for (const name of team2) {
      const { rows } = await db.query("SELECT * FROM Users WHERE Username = $1", [name.toLowerCase()]);
      if (rows.length > 0) {
        await db.query(
          "INSERT INTO SubGamePlayers (SGID, UID, Team, IsWinner) VALUES ($1, $2, $3, $4)",
          [sgid, rows[0].uid, 2, !team1wins]
        );
      }
    }

    res.json({ success: true, sgid });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

/* JOIN EVENT */
router.post("/:id/join", async (req, res) => {
  try {
    const username = req.body.username.trim().toLowerCase();
    const gameId = req.params.id;

    const { rows } = await db.query("SELECT * FROM Users WHERE LOWER(Username) = $1", [username]);
    const user = rows[0];
    if (!user) return res.status(404).json({ error: "User not found" });

    await db.query(
      `INSERT INTO GamePlayers (GID, UID) VALUES ($1, $2)
       ON CONFLICT (GID, UID) DO UPDATE SET Status = 'joined'
       WHERE GamePlayers.Status IN ('queued', 'invited', 'declined')`,
      [gameId, user.uid]
    );
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

/* LEAVE EVENT */
router.post("/:id/leave", async (req, res) => {
  try {
    const username = req.body.username.trim().toLowerCase();
    const gameId = req.params.id;

    const { rows } = await db.query("SELECT * FROM Users WHERE Username = $1", [username]);
    if (rows.length > 0) {
      await db.query("DELETE FROM GamePlayers WHERE GID = $1 AND UID = $2", [gameId, rows[0].uid]);
    }
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

/* DELETE EVENT */
router.post("/:id/delete", async (req, res) => {
  try {
    const username = req.body.username.trim().toLowerCase();
    const gameId = req.params.id;

    const { rows } = await db.query("SELECT * FROM Games WHERE GID = $1", [gameId]);
    if (rows.length === 0) return res.status(404).json({ error: "Game not found" });
    if (rows[0].createdby !== username) return res.status(403).json({ error: "Not authorized" });

    await db.query("DELETE FROM GamePlayers WHERE GID = $1", [gameId]);
    await db.query("DELETE FROM Games WHERE GID = $1", [gameId]);
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

/* START SESSION */
router.post("/:id/start", async (req, res) => {
  try {
    await db.query(
      "UPDATE Games SET Status = 'in_progress', StartedAt = NOW() WHERE GID = $1",
      [req.params.id]
    );
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

/* START SUB-GAME (teams only, no score yet) */
router.post("/:id/startgame", async (req, res) => {
  try {
    const { team1, team2 } = req.body;
    const gameId = req.params.id;
    const duration = parseInt(req.body.durationMinutes ?? 15, 10);

    if (!team1 || !team2) return res.status(400).json({ error: "Missing teams" });
    if (!(duration >= 1 && duration <= 180)) return res.status(400).json({ error: "Duration must be 1-180 minutes" });

    const { rows: sgRows } = await db.query(
      "INSERT INTO SubGames (GID, Status, StartedAt, DurationMinutes) VALUES ($1, 'in_progress', NOW(), $2) RETURNING SGID",
      [gameId, duration]
    );
    const sgid = sgRows[0].sgid;

    for (const name of team1) {
      const { rows } = await db.query("SELECT * FROM Users WHERE Username = $1", [name.toLowerCase()]);
      if (rows.length > 0) {
        await db.query("INSERT INTO SubGamePlayers (SGID, UID, Team) VALUES ($1, $2, 1)", [sgid, rows[0].uid]);
      }
    }
    for (const name of team2) {
      const { rows } = await db.query("SELECT * FROM Users WHERE Username = $1", [name.toLowerCase()]);
      if (rows.length > 0) {
        await db.query("INSERT INTO SubGamePlayers (SGID, UID, Team) VALUES ($1, $2, 2)", [sgid, rows[0].uid]);
      }
    }

    res.json({ success: true, sgid });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

/* END SUB-GAME (enter score, mark winners) */
router.post("/subgame/:sgid/end", async (req, res) => {
  try {
    const { team1score, team2score } = req.body;
    const sgid = req.params.sgid;

    const bad = scoreError(team1score, team2score);
    if (bad) return res.status(400).json({ error: bad });

    const team1wins = parseInt(team1score) > parseInt(team2score);

    // Only a game still in progress can be finished, so a double tap or a replay cannot overwrite a recorded score.
    const done = await db.query(
      "UPDATE SubGames SET Team1Score = $1, Team2Score = $2, Status = 'completed', EndedAt = NOW() WHERE SGID = $3 AND Status = 'in_progress' RETURNING SGID",
      [team1score, team2score, sgid]
    );
    if (!done.rows.length) return res.status(409).json({ error: "That game is already finished or does not exist" });
    await db.query("UPDATE SubGamePlayers SET IsWinner = $1 WHERE SGID = $2 AND Team = 1", [team1wins, sgid]);
    await db.query("UPDATE SubGamePlayers SET IsWinner = $1 WHERE SGID = $2 AND Team = 2", [!team1wins, sgid]);

    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

/* END SESSION */
router.post("/:id/end", async (req, res) => {
  try {
    await db.query(
      "UPDATE Games SET Status = 'completed', EndedAt = NOW() WHERE GID = $1",
      [req.params.id]
    );
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});


/* GET CHAT */
router.get("/:id/chat", async (req, res) => {
  try {
    const gameId = req.params.id;
    await db.query("INSERT INTO Conversations (CID) VALUES ($1) ON CONFLICT DO NOTHING", [gameId]);
    const { rows } = await db.query(`
      SELECT Messages.Content, Messages.SentAt, Users.Username
      FROM Messages
      JOIN Users ON Messages.SenderUID = Users.UID
      WHERE Messages.CID = $1
      ORDER BY Messages.SentAt ASC
    `, [gameId]);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

/* SEND CHAT */
router.post("/:id/chat", async (req, res) => {
  try {
    const { username, content } = req.body;
    const gameId = req.params.id;

    if (typeof content !== "string" || !content.trim()) return res.status(400).json({ error: "Empty message" });
    if (content.length > 1000) return res.status(400).json({ error: "Messages can be up to 1000 characters" });

    const { rows } = await db.query("SELECT UID AS uid FROM Users WHERE LOWER(Username) = $1", [username.toLowerCase()]);
    if (!rows[0]) return res.status(404).json({ error: "User not found" });

    await db.query("INSERT INTO Conversations (CID) VALUES ($1) ON CONFLICT DO NOTHING", [gameId]); // chat can be posted before it was ever opened
    await db.query(
      "INSERT INTO Messages (CID, SenderUID, Content) VALUES ($1, $2, $3)",
      [gameId, rows[0].uid, content.trim()]
    );
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

/* RESET */
router.delete("/reset", requireAdmin, async (req, res) => {
  try {
    await db.query("DELETE FROM SubGamePlayers");
    await db.query("DELETE FROM SubGames");
    await db.query("DELETE FROM GamePlayers");
    await db.query("DELETE FROM Games");
    await db.query("DELETE FROM Messages");
    await db.query("DELETE FROM Conversations");
    res.json({ message: "Reset complete" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;