import { Router, Request, Response } from "express";
import { authMiddleware, AuthRequest } from "../middleware/auth.middleware";
import { inviteUser, getProjectMembers } from "../services/collaborationService";

const router = Router();

// POST /project/invite
router.post("/invite", authMiddleware, async (req: Request, res: Response) => {
    const authReq = req as unknown as AuthRequest;
    const { project, email, role } = authReq.body;
    
    if (!project || !email) {
        return res.status(400).json({ error: "Project and Email are required" });
    }

    const success = inviteUser(project, email, role || 'viewer');
    if (success) {
        res.json({ success: true, message: `User ${email} invited to project ${project}` });
    } else {
        res.status(404).json({ error: "User not found or already a member" });
    }
});

// GET /project/:projectId/members
router.get("/:projectId/members", authMiddleware, async (req: Request, res: Response) => {
    const members = getProjectMembers(req.params.projectId);
    res.json({ success: true, members });
});

export default router;
