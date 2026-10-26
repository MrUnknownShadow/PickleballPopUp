const express = require("express");
const db = require("../db");
const { requireAdmin } = require("../auth");
const notify = require("../notify");

const router = express.Router();
router.use(requireAdmin);

const intList = (v) => Array.isArray(v) && v.every(Number.isInteger) ? v : null;
const noteOf = (v) => (typeof v === "string" ? v.slice(0, 300) : "");
const fail = (res, e) => { console.error(e); res.status(500).json({ error: "Server error" }); };

/* ALL PLAYERS + THEIR STATUS FOR ONE EVENT */
router.get("/games/:id/players", async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT Users.UID AS uid, Users.Username AS username, Users.SmsOptIn AS smsoptin,
              RIGHT(Users.PhoneNumber, 4) AS phonelast4, GamePlayers.Status AS status
       FROM Users LEFT JOIN GamePlayers ON GamePlayers.UID = Users.UID AND GamePlayers.GID = $1
       ORDER BY Users.Username`,
      [req.params.id]
    );
    res.json(rows);
  } catch (e) { fail(res, e); }
});

/* ASK AVAILABILITY: sendAt omitted = text now, otherwise queued until then */
router.post("/games/:id/invite", async (req, res) => {
  try {
    const uids = intList(req.body.uids);
    const sendAt = req.body.sendAt ? new Date(req.body.sendAt) : null;
    if (!uids?.length || (sendAt && isNaN(sendAt))) return res.status(400).json({ error: "Pick players and a valid time" });
    const sent = await notify.queueInvites(req.params.id, uids, sendAt, noteOf(req.body.note));
    res.json({ sentNow: sent, queued: uids.length - sent });
  } catch (e) { fail(res, e); }
});

/* CONFIRM FINAL ROSTER: texts selected + not selected */
router.post("/games/:id/select", async (req, res) => {
  try {
    const uids = intList(req.body.selected);
    if (!uids) return res.status(400).json({ error: "selected must be a list of player ids" });
    res.json(await notify.selectPlayers(req.params.id, uids, noteOf(req.body.note)));
  } catch (e) { fail(res, e); }
});

/* SEND FINAL SCHEDULE (with names) TO SELECTED PLAYERS */
router.post("/games/:id/schedule", async (req, res) => {
  try {
    res.json({ sent: await notify.sendSchedule(req.params.id, noteOf(req.body.note)) });
  } catch (e) { fail(res, e); }
});

/* TEXT LOG */
router.get("/outbox", async (req, res) => {
  try {
    const { rows } = await db.query(
      "SELECT ID AS id, Username AS username, Kind AS kind, Direction AS direction, Body AS body, Status AS status, Error AS error, CreatedAt AS createdat FROM SmsLog ORDER BY ID DESC LIMIT 40"
    );
    res.json(rows);
  } catch (e) { fail(res, e); }
});

/* TEST AIDS: fake a player's text reply, and run due invites/reminders now */
router.post("/simulate-reply", async (req, res) => {
  try {
    const { rows } = await db.query("SELECT PhoneNumber AS phone FROM Users WHERE UID = $1", [req.body.uid]);
    if (!rows[0]?.phone) return res.status(400).json({ error: "Player has no phone number" });
    await notify.handleReply(rows[0].phone, String(req.body.text || ""));
    res.json({ ok: true });
  } catch (e) { fail(res, e); }
});

router.post("/run-scheduler", async (_req, res) => {
  try {
    res.json({ invites: await notify.sendDueInvites(), reminders: await notify.sendDueReminders() });
  } catch (e) { fail(res, e); }
});

module.exports = router;
