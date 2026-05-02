import express from "express";
import db from "../db/db";

const router = express.Router();

// GET /events - fetch all events ordered by timestamp descending
router.get("/events", (req, res) => {
  const events = db.prepare("SELECT * FROM events ORDER BY timestamp DESC").all();
  res.json(events);
});

export default router;