import { Router, Request, Response } from "express";
import { getAllScores } from "../services/stalenessService";

const router = Router();

router.get("/all", (req: Request, res: Response) => {
  try {
    const scores = getAllScores();
    res.json(scores);
  } catch (err) {
    console.error("Staleness error:", err);
    res.status(500).json({ error: "Failed to get staleness scores" });
  }
});

export default router;
