const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../db");

const { createSession } = require("../auth");
const { validTwilioSignature } = require("../sms");
const { handleReply } = require("../notify");

const router = express.Router();

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
    const username = String(req.body.username || "").trim();
    const pin = String(req.body.pin || "");
    const phoneNumber = normalizePhoneNumber(req.body.phoneNumber);
    // Opt-in by default; texts only go out once a phone number is on file.
    const smsOptIn = req.body.smsOptIn !== false && !!phoneNumber;

    if (!username) {
      return res.status(400).json({
        error: "Username is required",
      });
    }

    if (!validPin(pin)) {
      return res.status(400).json({
        error: "PIN must be exactly 4 digits",
      });
    }

    if (!validPhoneNumber(phoneNumber)) {
      return res.status(400).json({
        error: "Enter a valid phone number",
      });
    }

    const existing = await db.query(
      `SELECT UID
       FROM Users
       WHERE LOWER(Username) = LOWER($1)`,
      [username]
    );

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

/* GET ACCOUNT SETTINGS */
router.get("/:username", async (req, res) => {
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
    res.status(500).json({ error: e.message });
  }
});

/* UPDATE ACCOUNT SETTINGS */
router.patch("/:username/settings", async (req, res) => {
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
    res.status(500).json({ error: e.message });
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
    res.status(500).json({ error: e.message });
  }
});

/* SMS PROVIDER WEBHOOK: STOP immediately revokes consent. */
router.post("/sms/inbound", async (req, res) => {
  try {
    if (!validTwilioSignature(req)) return res.status(403).json({ error: "Bad signature" });
    const from = normalizePhoneNumber(req.body.from || req.body.From);
    const body = String(req.body.body || req.body.Body || "").trim().toUpperCase();

    if (from && body === "STOP") {
      await db.query(
        `UPDATE Users
         SET SmsOptIn = FALSE, SmsOptedOutAt = NOW()
         WHERE PhoneNumber = $1`,
        [from]
      );
    } else if (from) {
      await handleReply(from, String(req.body.body || req.body.Body || ""));
    }

    res.status(204).send();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* LOGIN */
router.post("/login", async (req, res) => {
  try {
    const username = String(req.body.username || "").trim();
    const pin = String(req.body.pin || "");

    if (!username || !validPin(pin)) {
      return res.status(400).json({
        error: "Username and 4-digit PIN are required",
      });
    }

    const { rows } = await db.query(
      `SELECT UID, Username, PinHash, IsAdmin
       FROM Users
       WHERE LOWER(Username) = LOWER($1)`,
      [username]
    );

    const user = rows[0];

    if (!user || !user.pinhash) {
      return res.status(401).json({
        error: "Invalid username or PIN",
      });
    }

    const matches = await bcrypt.compare(
      pin,
      user.pinhash
    );

    if (!matches) {
      return res.status(401).json({
        error: "Invalid username or PIN",
      });
    }

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
router.get("/", async (req, res) => {
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