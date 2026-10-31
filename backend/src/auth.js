const crypto = require("crypto");
const db = require("./db");

const SESSION_DAYS = 30;

async function createSession(uid) {
  const token = crypto.randomBytes(32).toString("hex");
  await db.query("INSERT INTO Sessions (Token, UID) VALUES ($1, $2)", [token, uid]);
  return token;
}

// Bearer-token checks: requireUser for any signed-in player, requireAdmin for admins only. Older routes still trust
// the client username (see README).
const requireUser = (req, res, next) => check(req, res, next, false);
const requireAdmin = (req, res, next) => check(req, res, next, true);

async function check(req, res, next, adminOnly) {
  try {
    const token = (req.get("authorization") || "").replace(/^Bearer /, "");
    if (!token) return res.status(401).json({ error: "Sign in again" });
    const { rows } = await db.query(
      `SELECT Users.UID AS uid, Users.Username AS username, Users.IsAdmin AS isadmin
       FROM Sessions JOIN Users ON Users.UID = Sessions.UID
       WHERE Sessions.Token = $1
         AND Sessions.CreatedAt > NOW() - ($2 || ' days')::interval`,
      [token, String(SESSION_DAYS)]
    );
    if (!rows[0]) return res.status(401).json({ error: "Sign in again" });
    if (adminOnly && !rows[0].isadmin) return res.status(403).json({ error: "Admins only" });
    req.user = req.admin = rows[0];
    next();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
}

module.exports = { createSession, requireAdmin, requireUser };
