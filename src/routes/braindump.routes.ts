import { Router } from "express";
import db from "../db";
import { saveMemoryNode } from "../services/memoryService";

const router = Router();

// GET /braindump?limit=20&project=xxx
router.get("/", (req, res) => {
  try {
    const limit = req.query.limit ? Math.min(Number(req.query.limit), 100) : 20;
    const project = req.query.project as string | undefined;

    let rows;
    if (project) {
      // braindumps table doesn't have project yet — join via sessions is complex, just return all for now
      rows = db.prepare(`SELECT * FROM braindumps ORDER BY ts DESC LIMIT ?`).all(limit);
    } else {
      rows = db.prepare(`SELECT * FROM braindumps ORDER BY ts DESC LIMIT ?`).all(limit);
    }
    return res.json({ success: true, braindumps: rows, count: rows.length });
  } catch (err) {
    return res.status(500).json({ error: "DB error" });
  }
});

// POST /braindump
router.post("/", (req, res) => {
  const { content, sessionId, project } = req.body;

  if (!content || typeof content !== "string" || content.trim() === "") {
    return res.status(400).json({ error: "Content required" });
  }

  const timestamp = Date.now();
  try {
    db.prepare("INSERT INTO braindumps (content, ts) VALUES (?, ?)").run(content.trim(), timestamp);
    saveMemoryNode(content, "braindump", project || "default", sessionId);
    return res.json({ success: true, ts: timestamp });
  } catch (err) {
    return res.status(500).json({ error: "DB error" });
  }
});

export default router;
