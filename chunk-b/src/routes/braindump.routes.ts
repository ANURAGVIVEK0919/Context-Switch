// Purpose: Braindump routes for ContextSwitch backend
// Input: POST /
// Output: { success: true }

// Purpose: Handle brain dump POST requests
// Input: JSON { content: string }
// Output: { success: true }

import { Router } from "express";
import db from "../db/db";

const router = Router();

// POST /braindump
router.post("/", (req, res) => {
  console.log("BODY RECEIVED:", req.body);
  const { content } = req.body;

  // Validate input
  if (!content || typeof content !== "string") {
    return res.status(400).json({ error: "Content required" });
  }

  const timestamp = Date.now();
  try {
    db.prepare(
      "INSERT INTO braindumps (content, timestamp) VALUES (?, ?)"
    ).run(content, timestamp);
    console.log("Brain dump saved");
    return res.json({ success: true });
  } catch (err) {
    console.error("DB error", err);
    return res.status(500).json({ error: "DB error" });
  }
});

export default router;
