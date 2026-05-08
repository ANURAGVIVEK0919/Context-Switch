import { Router, Request, Response } from "express";
import { aiReason } from "../services/aiService";
import { buildContextFromMemory } from "../services/memoryService";
import { authMiddleware, AuthRequest } from "../middleware/auth.middleware";

const router = Router();

router.post("/reason", authMiddleware, async (req: Request, res: Response) => {
  const authReq = req as unknown as AuthRequest;
  try {
    const { projectId, brief } = authReq.body;
    const userId = authReq.user?.id;

    if (!projectId) {
      return res.status(400).json({ error: "projectId is required" });
    }
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const memoryContext = buildContextFromMemory(projectId, userId);
    const reasoning = await aiReason(memoryContext, brief || "Provide next steps.");
    res.json(reasoning);
  } catch (err) {
    console.error("AI reason error:", err);
    res.status(500).json({ error: "Failed to generate reasoning" });
  }
});

export default router;
