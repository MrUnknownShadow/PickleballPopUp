
require('dotenv').config()
const express = require("express");
const cors = require("cors");
const gamesRouter = require("./src/routes/games");
const usersRouter = require("./src/routes/users");
const adminRouter = require("./src/routes/admin");
const notify = require("./src/notify");
const fs = require("fs");
const path = require("path");

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
}));
app.use(express.json({ verify: (req, _res, buf) => { req.rawBody = buf; } })); // raw bytes needed for Telnyx signatures
app.use(express.urlencoded({ extended: false })); // Twilio webhooks are form-encoded

app.use("/api/games", gamesRouter);
app.use("/api/users", usersRouter);
app.use("/api/admin", adminRouter);

// Production: serve the built frontend (frontend/dist) from this same server, so the app has one address
// and no CORS setup. Skipped in dev, where Vite serves the frontend.
const dist = path.join(__dirname, "../frontend/dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.use((req, res, next) => (req.method === "GET" && !req.path.startsWith("/api") ? res.sendFile(path.join(dist, "index.html")) : next()));
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
  }, 60 * 1000);
  app.listen(PORT, () => console.log(`Server on ${PORT}`));
}

start();
