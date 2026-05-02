// Purpose: Reconstruct routes for ContextSwitch backend
// Input: GET /:projectId
// Output: { projectId, brief, confidence }

import { Router } from "express";

const router = Router();

router.get("/:projectId", (req, res) => {
  const { projectId } = req.params;
  res.json({
    projectId,
    brief: "No context yet",
    confidence: 0
  });
});

export default router;
