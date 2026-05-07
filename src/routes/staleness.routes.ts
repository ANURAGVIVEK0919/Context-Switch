import { Router, Request, Response } from "express";
import db from "../db";
import { getAllScores } from "../services/stalenessService";

const router = Router();

// GET /staleness — list all staleness scores
router.get("/", (req: Request, res: Response) => {
  try {
    const scores = getAllScores();
    res.json({ success: true, data: scores });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /staleness/all — keep backward compat alias
router.get("/all", (req: Request, res: Response) => {
  try {
    const scores = getAllScores();
    res.json({ success: true, data: scores });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /staleness/:filePath — get staleness for a specific file (URL-encoded)
router.get("/:filePath", (req: Request, res: Response) => {
  try {
    const filePath = decodeURIComponent(req.params.filePath);
    const row = db.prepare(`SELECT * FROM staleness_scores WHERE filePath = ?`).get(filePath);
    if (!row) return res.status(404).json({ success: false, error: "File not found in staleness records" });
    res.json({ success: true, data: row });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /staleness/:filePath — manually override score, edit_count or last_seen
router.put("/:filePath", (req: Request, res: Response) => {
  try {
    const filePath = decodeURIComponent(req.params.filePath);
    const existing = db.prepare(`SELECT * FROM staleness_scores WHERE filePath = ?`).get(filePath);
    if (!existing) return res.status(404).json({ success: false, error: "File not found in staleness records" });
    const { score, edit_count, last_seen } = req.body;
    db.prepare(`
      UPDATE staleness_scores SET
        score      = COALESCE(?, score),
        edit_count = COALESCE(?, edit_count),
        last_seen  = COALESCE(?, last_seen)
      WHERE filePath = ?
    `).run(score ?? null, edit_count ?? null, last_seen ?? null, filePath);
    const updated = db.prepare(`SELECT * FROM staleness_scores WHERE filePath = ?`).get(filePath);
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /staleness/:filePath — remove a file's staleness record
router.delete("/:filePath", (req: Request, res: Response) => {
  try {
    const filePath = decodeURIComponent(req.params.filePath);
    const existing = db.prepare(`SELECT * FROM staleness_scores WHERE filePath = ?`).get(filePath);
    if (!existing) return res.status(404).json({ success: false, error: "File not found in staleness records" });
    db.prepare(`DELETE FROM staleness_scores WHERE filePath = ?`).run(filePath);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
