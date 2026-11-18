const bcrypt = require("bcryptjs");
const db = require("./db");

// Account rules shared by sign-up, the admin's add-player form and account deletion, so they cannot drift apart.

// Usernames are text only: 1-30 characters, no control characters (a stray NUL or a 5000-character name used to crash the server).
function cleanUsername(v) {
  if (typeof v !== "string") return null;
  const name = v.trim();
  return name.length >= 1 && name.length <= 30 && !/[\u0000-\u001f\u007f]/.test(name) ? name : null;
}

const validPin = (pin) => /^\d{4}$/.test(String(pin || ""));

function normalizePhoneNumber(phoneNumber) {
  const digits = String(phoneNumber || "").replace(/\D/g, "");
  if (!digits) return null;
  return digits.length === 10 ? `1${digits}` : digits;
}

const validPhoneNumber = (phoneNumber) => !phoneNumber || /^\d{10,15}$/.test(phoneNumber);

class AccountError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// Checks the details and inserts the account. Throws AccountError (400 bad details, 409 already taken).
// Texts start off unless smsOptIn is true: only the player may turn them on (carrier consent rule).
async function createAccount({ username, pin, phoneNumber, smsOptIn = false }) {
  const name = cleanUsername(username);
  const phone = normalizePhoneNumber(phoneNumber);
  if (!name) throw new AccountError(400, "Username must be 1 to 30 characters");
  if (!validPin(pin)) throw new AccountError(400, "PIN must be exactly 4 digits");
  // A phone number is required: replies are matched to a player by phone (texting itself needs the ticked box).
  if (!phone || !validPhoneNumber(phone)) throw new AccountError(400, "Enter a valid mobile phone number");
  // A phone number belongs to one account.
  if ((await db.query("SELECT 1 FROM Users WHERE PhoneNumber = $1", [phone])).rows.length) throw new AccountError(409, "That phone number is already used by another account");
  if ((await db.query("SELECT 1 FROM Users WHERE LOWER(Username) = LOWER($1)", [name])).rows.length) throw new AccountError(409, "Username already exists");
  const optIn = smsOptIn === true;
  const { rows } = await db.query(
    `INSERT INTO Users (Username, PinHash, PhoneNumber, SmsOptIn, SmsOptedInAt)
     VALUES ($1, $2, $3, $4, CASE WHEN $4 THEN NOW() ELSE NULL END) RETURNING UID, Username`,
    [name, await bcrypt.hash(String(pin), 12), phone, optIn]
  );
  return { uid: rows[0].uid, username: rows[0].username };
}

// Removes the player and everything of theirs. Finished games they played lose them as a player, so their results change.
async function removeAccount(uid) {
  await db.query("DELETE FROM GamePlayers WHERE UID = $1", [uid]);
  await db.query("DELETE FROM SubGamePlayers WHERE UID = $1", [uid]);
  await db.query("DELETE FROM ConversationParticipants WHERE UID = $1", [uid]);
  await db.query("DELETE FROM Messages WHERE SenderUID = $1", [uid]);
  await db.query("DELETE FROM Users WHERE UID = $1", [uid]);
}

module.exports = { cleanUsername, validPin, normalizePhoneNumber, validPhoneNumber, AccountError, createAccount, removeAccount };
