const crypto = require("crypto");
const db = require("./db");

const SESSION_DAYS = 30;

async function createSession(uid) {
  const token = crypto.randomBytes(32).toString("hex");
  await db.query("INSERT INTO Sessions (Token, UID) VALUES ($1, $2)", [token, uid]);
  return token;
}

// Bearer-token check for admin-only routes. Other routes still trust the client username (see README).
async function requireAdmin(req, res, next) {
  try {
    const token = (req.get("authorization") || "").replace(/^Bearer /, "");
    if (!token) return res.status(401).json({ error: "Sign in again" });
    const { rows } = await db.query(
      `SELECT Users.UID, Users.Username, Users.IsAdmin
       FROM Sessions JOIN Users ON Users.UID = Sessions.UID
       WHERE Sessions.Token = $1
         AND Sessions.CreatedAt > NOW() - ($2 || ' days')::interval`,
      [token, String(SESSION_DAYS)]
    );
    if (!rows[0]) return res.status(401).json({ error: "Sign in again" });
    if (!rows[0].isadmin) return res.status(403).json({ error: "Admins only" });
    req.admin = rows[0];
    next();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
}

module.exports = { createSession, requireAdmin };
