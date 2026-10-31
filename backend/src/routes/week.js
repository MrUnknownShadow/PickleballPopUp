const express = require("express");
const { requireAdmin } = require("../auth");
const av = require("../availability");
const { getSettings, saveSettings } = require("../settings");
const { handleReply } = require("../notify");
const db = require("../db");

const fail = (res, e) => {
  if (e.status === 400) return res.status(400).json({ error: e.message });
  console.error(e); res.status(500).json({ error: "Server error" });
};
const weekOf = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || "")) ? v : av.weekStartFor());

/* ADMIN: /api/admin/week */
const admin = express.Router();
admin.use(requireAdmin);

admin.get("/", async (req, res) => { try { res.json(await av.getWeek(weekOf(req.query.weekStart))); } catch (e) { fail(res, e); } });

admin.post("/blast", async (req, res) => { try { res.json(await av.sendBlast(weekOf(req.body.weekStart))); } catch (e) { fail(res, e); } });

admin.post("/confirm", async (req, res) => {
  try { res.json(await av.confirmWeek(weekOf(req.body.weekStart), req.body.days || {}, req.admin.username)); } catch (e) { fail(res, e); }
});

admin.post("/set-days", async (req, res) => {
  try {
    const { uid, days } = req.body;
    if (!Number.isInteger(uid) || !Array.isArray(days)) return res.status(400).json({ error: "uid and days are required" });
    await av.setDays(weekOf(req.body.weekStart), uid, days.filter(Number.isInteger));
    res.json({ ok: true });
  } catch (e) { fail(res, e); }
});

// Test tool: act as if a player texted this reply (works without a text provider).
admin.post("/simulate-reply", async (req, res) => {
  try {
    const { uid, text } = req.body;
    const { rows } = await db.query("SELECT PhoneNumber AS phone FROM Users WHERE UID = $1", [uid]);
    if (!rows[0]?.phone) return res.status(400).json({ error: "That player has no phone number" });
    await handleReply(rows[0].phone, String(text || ""));
    res.json({ ok: true });
  } catch (e) { fail(res, e); }
});

admin.get("/settings", async (_req, res) => { try { res.json(await getSettings()); } catch (e) { fail(res, e); } });
admin.put("/settings", async (req, res) => { try { res.json(await saveSettings(req.body || {})); } catch (e) { fail(res, e); } });

/* PUBLIC: /api/schedule. Anyone with the link sees who plays which day (usernames only), no sign-in needed.
   A signed-in player (Bearer token) also gets their own days marked. */
const schedule = express.Router();
schedule.get("/", async (req, res) => {
  try {
    const week = weekOf(req.query.weekStart);
    const token = (req.get("authorization") || "").replace(/^Bearer /, "");
    const viewer = token ? (await db.query("SELECT UID AS uid FROM Sessions WHERE Token = $1", [token])).rows[0]?.uid : null;
    res.json({ current: await av.getSchedule(week, viewer), next: await av.getSchedule(require("../tz").addDays(week, 7), viewer) });
  } catch (e) { fail(res, e); }
});

module.exports = { admin, schedule };
