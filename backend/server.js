
require('dotenv').config()
const express = require("express");
const cors = require("cors");
const gamesRouter = require("./src/routes/games");
const usersRouter = require("./src/routes/users");
const adminRouter = require("./src/routes/admin");
const notify = require("./src/notify");
const availability = require("./src/availability");
const week = require("./src/routes/week");
const fs = require("fs");
const path = require("path");

const app = express();
app.disable("x-powered-by");
// Browser hardening headers. The CSP allows only this site's own scripts, plus Google Fonts for the typefaces.
app.use((req, res, next) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "geolocation=(), microphone=(), camera=(), payment=()",
    "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; media-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  });
  if (req.secure) res.set("Strict-Transport-Security", "max-age=15552000"); // only over HTTPS (needs trust proxy below)
  next();
});
app.set("trust proxy", 1); // behind Render's proxy: req.ip is the real client (needed for login rate limits)

app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
}));
app.use(express.json({ verify: (req, _res, buf) => { req.rawBody = buf; } })); // raw bytes needed for Telnyx signatures
app.use(express.urlencoded({ extended: false })); // Twilio webhooks are form-encoded

app.use("/api/games", gamesRouter);
app.use("/api/users", usersRouter);
app.use("/api/admin/week", week.admin);
app.use("/api/admin", adminRouter);
app.use("/api/schedule", week.schedule);

// Production: serve the built frontend (frontend/dist) from this same server, so the app has one address
// and no CORS setup. Skipped in dev, where Vite serves the frontend.
const dist = path.join(__dirname, "../frontend/dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.use((req, res, next) => ((req.method === "GET" || req.method === "HEAD") && !req.path.startsWith("/api") ? res.sendFile(path.join(dist, "index.html")) : next()));
}

// Run schema on startup to create tables if they don't exist
const db = require("./src/db");

async function initDb() {
  try {
    const schema = fs.readFileSync(path.join(__dirname, "db/schema.sql"), "utf8");
    await db.query(schema);
    console.log("Database ready");
  } catch (e) {
    console.error("DB init error:", e.message);
  }
}

const PORT = process.env.PORT || 3001;

async function start() {
  await initDb();
  // Queued availability texts and day-before reminders. ponytail: in-process timer, fine for one server instance.
  setInterval(() => {
    notify.sendDueInvites().catch((e) => console.error("invites:", e.message));
    notify.sendDueReminders().catch((e) => console.error("reminders:", e.message));
    availability.tick().catch((e) => console.error("weekly blast:", e.message));
  }, 60 * 1000);
  app.listen(PORT, () => console.log(`Server on ${PORT}`));
}

start();
