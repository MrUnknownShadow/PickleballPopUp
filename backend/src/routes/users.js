const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../db");

const { createSession, requireUser, requireAdmin } = require("../auth");
const { validTwilioSignature, validBandwidthAuth, validTelnyxSignature } = require("../sms");
const { handleReply } = require("../notify");

const router = express.Router();

// Usernames are text only: 1-30 characters, no control characters (a stray NUL or a 5000-character name used to crash the server).
function cleanUsername(v) {
  if (typeof v !== "string") return null;
  const name = v.trim();
  return name.length >= 1 && name.length <= 30 && !/[\u0000-\u001f\u007f]/.test(name) ? name : null;
}

// Wrong-PIN guesses: 8 per 15 minutes per client and name (and 40 per name overall), then 429. In memory, so one server only.
const WINDOW_MS = 15 * 60e3;
const failures = new Map();
function lockedFor(key, max) {
  const f = failures.get(key);
  if (!f) return 0;
  if (Date.now() - f.first > WINDOW_MS) { failures.delete(key); return 0; }
  return f.n >= max ? Math.ceil((f.first + WINDOW_MS - Date.now()) / 60e3) : 0;
}
function recordFailure(key) {
  const f = failures.get(key);
  if (!f || Date.now() - f.first > WINDOW_MS) failures.set(key, { n: 1, first: Date.now() });
  else f.n++;
  if (failures.size > 5000) failures.clear();
}

// Sign-ups: at most REGISTER_LIMIT_PER_HOUR (default 20) per client address, so a script cannot create accounts in bulk
// (every opted-in account is texted). If SIGNUP_CODE is set, a new account must also give that group code.
const signups = new Map();
function signupBlocked(ip) {
  const max = Number(process.env.REGISTER_LIMIT_PER_HOUR) || 20, now = Date.now();
  const f = signups.get(ip);
  if (!f || now - f.first > 3600e3) { signups.set(ip, { n: 1, first: now }); if (signups.size > 5000) signups.clear(); return false; }
  f.n++;
  return f.n > max;
}
function codeMatches(given) {
  const want = process.env.SIGNUP_CODE;
  if (!want) return true;
  return typeof given === "string" && given.trim().length === want.length && require("crypto").timingSafeEqual(Buffer.from(given.trim()), Buffer.from(want));
}

// Only the owner of a profile (or an admin) may read or change it. Needs requireUser first.
function ownerOrAdmin(req, res, next) {
  if (req.user.isadmin || req.user.username.toLowerCase() === String(req.params.username).toLowerCase()) return next();
  res.status(403).json({ error: "That is not your account" });
}

function validPin(pin) {
  return /^\d{4}$/.test(String(pin || ""));
}

function normalizePhoneNumber(phoneNumber) {
  const digits = String(phoneNumber || "").replace(/\D/g, "");
  if (!digits) return null;
  return digits.length === 10 ? `1${digits}` : digits;
}

function validPhoneNumber(phoneNumber) {
  return !phoneNumber || /^\d{10,15}$/.test(phoneNumber);
}

/* CREATE ACCOUNT */
router.post("/register", async (req, res) => {
  try {
    if (signupBlocked(req.ip)) return res.status(429).json({ error: "Too many sign-ups from this connection. Try again later." });
    if (!codeMatches(req.body.groupCode)) return res.status(403).json({ error: "Wrong group code. Ask the organizer for it." });

    const username = cleanUsername(req.body.username);
    const pin = String(req.body.pin || "");
    const phoneNumber = normalizePhoneNumber(req.body.phoneNumber);
    // Texts only after the person ticks the box themselves (carrier rule), and only once a phone number is on file.
    const smsOptIn = req.body.smsOptIn === true && !!phoneNumber;

    if (!username) {
      return res.status(400).json({
        error: "Username must be 1 to 30 characters",
      });
    }

    if (!validPin(pin)) {
      return res.status(400).json({
        error: "PIN must be exactly 4 digits",
      });
    }

    // A phone number is required to create an account (texting itself stays optional: it needs the ticked box).
    if (!phoneNumber || !validPhoneNumber(phoneNumber)) {
      return res.status(400).json({
        error: "Enter a valid mobile phone number",
      });
    }

    const existing = await db.query(
      `SELECT UID
       FROM Users
       WHERE LOWER(Username) = LOWER($1)`,
      [username]
    );

    // A phone number belongs to one account: replies are matched to a player by phone.
    if (phoneNumber) {
      const taken = await db.query("SELECT 1 FROM Users WHERE PhoneNumber = $1", [phoneNumber]);
      if (taken.rows.length) return res.status(409).json({ error: "That phone number is already used by another account" });
    }

    if (existing.rows.length > 0) {
      return res.status(409).json({
        error: "Username already exists",
      });
    }

    const pinHash = await bcrypt.hash(pin, 12);

    const { rows } = await db.query(
      `INSERT INTO Users (Username, PinHash, PhoneNumber, SmsOptIn, SmsOptedInAt)
       VALUES ($1, $2, $3, $4, CASE WHEN $4 THEN NOW() ELSE NULL END)
       RETURNING UID, Username`,
      [username, pinHash, phoneNumber, smsOptIn]
    );

    res.status(201).json({
      uid: rows[0].uid,
      username: rows[0].username,
    });
  } catch (e) {
    console.error("Register error:", e);
    res.status(500).json({
      error: e.message,
    });
  }
});

/* PUBLIC: does the sign-up form need a group code? (the code itself is never sent) */
router.get("/config", (_req, res) => res.json({ signupCodeRequired: !!process.env.SIGNUP_CODE }));

/* GET ACCOUNT SETTINGS */
router.get("/:username", requireUser, ownerOrAdmin, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT UID, Username, Email, PhoneNumber, SmsOptIn, CreatedAt
       FROM Users
       WHERE LOWER(Username) = LOWER($1)`,
      [req.params.username]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

/* UPDATE ACCOUNT SETTINGS */
router.patch("/:username/settings", requireUser, ownerOrAdmin, async (req, res) => {
  try {
    const phoneNumber = normalizePhoneNumber(req.body.phoneNumber);
    const smsOptIn = req.body.smsOptIn === true;

    if (!validPhoneNumber(phoneNumber)) {
      return res.status(400).json({ error: "Enter a valid phone number" });
    }

    if (smsOptIn && !phoneNumber) {
      return res.status(400).json({
        error: "A phone number is required to enable text notifications",
      });
    }

    if (phoneNumber) {
      const taken = await db.query("SELECT 1 FROM Users WHERE PhoneNumber = $1 AND LOWER(Username) <> LOWER($2)", [phoneNumber, req.params.username]);
      if (taken.rows.length) return res.status(409).json({ error: "That phone number is already used by another account" });
    }

    const { rows } = await db.query(
      `UPDATE Users
       SET PhoneNumber = $1,
           SmsOptIn = $2,
           SmsOptedInAt = CASE WHEN $2 AND NOT SmsOptIn THEN NOW() ELSE SmsOptedInAt END,
           SmsOptedOutAt = CASE WHEN NOT $2 AND SmsOptIn THEN NOW() ELSE SmsOptedOutAt END
       WHERE LOWER(Username) = LOWER($3)
       RETURNING UID, Username, Email, PhoneNumber, SmsOptIn, CreatedAt`,
      [phoneNumber, smsOptIn, req.params.username]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

/* DELETE ACCOUNT */
router.delete("/:username", async (req, res) => {
  try {
    const username = String(req.params.username || "").trim();
    const pin = String(req.body.pin || "");
    const { rows } = await db.query(
      "SELECT UID, PinHash FROM Users WHERE LOWER(Username) = LOWER($1)",
      [username]
    );
    const user = rows[0];

    if (!user || !user.pinhash || !(await bcrypt.compare(pin, user.pinhash))) {
      return res.status(401).json({ error: "Your PIN is incorrect" });
    }

    await db.query("DELETE FROM GamePlayers WHERE UID = $1", [user.uid]);
    await db.query("DELETE FROM SubGamePlayers WHERE UID = $1", [user.uid]);
    await db.query("DELETE FROM ConversationParticipants WHERE UID = $1", [user.uid]);
    await db.query("DELETE FROM Messages WHERE SenderUID = $1", [user.uid]);
    await db.query("DELETE FROM Users WHERE UID = $1", [user.uid]);

    res.json({ success: true });
  } catch (e) {
    console.error("Delete account error:", e);
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

// STOP immediately revokes consent; anything else is treated as an availability reply.
async function handleInbound(from, text) {
  if (!from) return;
  const word = text.trim().toUpperCase();
  if (word === "START" || word === "UNSTOP") {
    // Re-subscribing after STOP: the carrier-side block is lifted by the text provider; this keeps our own flag in step.
    // (The provider sends the confirmation message itself.)
    await db.query("UPDATE Users SET SmsOptIn = TRUE, SmsOptedInAt = NOW() WHERE PhoneNumber = $1 AND NOT SmsOptIn", [from]);
    return;
  }
  if (word === "STOP") {
    await db.query(
      `UPDATE Users
       SET SmsOptIn = FALSE, SmsOptedOutAt = NOW()
       WHERE PhoneNumber = $1`,
      [from]
    );
  } else {
    await handleReply(from, text);
  }
}

/* TWILIO WEBHOOK */
router.post("/sms/inbound", async (req, res) => {
  try {
    if (!validTwilioSignature(req)) return res.status(403).json({ error: "Bad signature" });
    await handleInbound(normalizePhoneNumber(req.body.from || req.body.From), String(req.body.body || req.body.Body || ""));
    res.status(204).send();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

/* TELNYX WEBHOOK: set the messaging profile's webhook URL to /api/users/sms/telnyx */
router.post("/sms/telnyx", async (req, res) => {
  try {
    if (!validTelnyxSignature(req)) return res.status(403).json({ error: "Bad signature" });
    const ev = req.body?.data;
    console.log(`[telnyx inbound] ${ev?.event_type}`);
    if (ev?.event_type === "message.received" && ev.payload?.direction === "inbound") {
      await handleInbound(normalizePhoneNumber(ev.payload.from?.phone_number), String(ev.payload.text || ""));
    }
    res.status(200).send();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

/* BANDWIDTH WEBHOOK: set the application's inbound callback URL to /api/users/sms/bandwidth */
router.post("/sms/bandwidth", async (req, res) => {
  try {
    if (!validBandwidthAuth(req)) return res.status(401).json({ error: "Bad credentials" });
    // Optional shared secret in the callback address (.../sms/bandwidth?key=...), for when Basic auth is not set on the application.
    const key = process.env.BANDWIDTH_WEBHOOK_KEY;
    if (key && !(typeof req.query.key === "string" && req.query.key.length === key.length && require("crypto").timingSafeEqual(Buffer.from(req.query.key), Buffer.from(key)))) return res.status(401).json({ error: "Bad key" });
    for (const ev of Array.isArray(req.body) ? req.body : []) {
      console.log(`[bandwidth inbound] ${ev.type} from=...${String(ev.message?.from || "").slice(-4)}`);
      if (ev.type === "message-received") {
        await handleInbound(normalizePhoneNumber(ev.message?.from), String(ev.message?.text || ""));
      }
    }
    res.status(200).send();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

/* LOGIN */
router.post("/login", async (req, res) => {
  try {
    const username = cleanUsername(req.body.username);
    const pin = String(req.body.pin || "");

    if (!username || !validPin(pin)) {
      return res.status(400).json({
        error: "Username and 4-digit PIN are required",
      });
    }

    const who = username.toLowerCase();
    const keys = [[`${req.ip}|${who}`, 8], [`name|${who}`, 40]];
    const wait = Math.max(...keys.map(([k, max]) => lockedFor(k, max)));
    if (wait) return res.status(429).json({ error: `Too many wrong PINs. Try again in ${wait} minute${wait === 1 ? "" : "s"}.` });

    const { rows } = await db.query(
      `SELECT UID, Username, PinHash, IsAdmin
       FROM Users
       WHERE LOWER(Username) = LOWER($1)`,
      [username]
    );

    const user = rows[0];

    const matches = user && user.pinhash ? await bcrypt.compare(pin, user.pinhash) : false;

    if (!matches) {
      keys.forEach(([k]) => recordFailure(k));
      return res.status(401).json({
        error: "Invalid username or PIN",
      });
    }
    failures.delete(keys[0][0]);

    res.json({
      uid: user.uid,
      username: user.username,
      isAdmin: user.isadmin,
      token: await createSession(user.uid),
    });
  } catch (e) {
    console.error("Login error:", e);
    res.status(500).json({
      error: e.message,
    });
  }
});

/* GET USERS */
router.get("/", requireAdmin, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT UID, Username, Email, CreatedAt
       FROM Users
       ORDER BY CreatedAt DESC`
    );

    res.json(rows);
  } catch (e) {
    res.status(500).json({
      error: e.message,
    });
  }
});

module.exports = router;