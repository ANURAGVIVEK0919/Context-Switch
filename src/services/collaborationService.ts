import db from "../db";

/**
 * Check if a user has access to a project.
 * A user has access if:
 * 1. They are the creator of at least one event/session in that project.
 * 2. They are explicitly added as a project_member.
 */
export function hasProjectAccess(userId: number, project: string): boolean {
    // 1. Check project_members table
    const member = db.prepare('SELECT id FROM project_members WHERE project = ? AND user_id = ?').get(project, userId);
    if (member) return true;

    // 2. Check if they have any sessions for this project (Legacy/Creator check)
    const session = db.prepare('SELECT id FROM sessions WHERE project = ? AND user_id = ? LIMIT 1').get(project, userId);
    if (session) return true;

    return false;
}

/**
 * Invite a user to a project.
 */
export function inviteUser(project: string, email: string, role: string = 'viewer'): boolean {
    const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as { id: number } | undefined;
    if (!user) return false;

    try {
        db.prepare('INSERT OR IGNORE INTO project_members (project, user_id, role) VALUES (?, ?, ?)')
          .run(project, user.id, role);
        return true;
    } catch (err) {
        return false;
    }
}

/**
 * Get all members of a project.
 */
export function getProjectMembers(project: string) {
    return db.prepare(`
        SELECT pm.*, u.email 
        FROM project_members pm
        JOIN users u ON pm.user_id = u.id
        WHERE pm.project = ?
    `).all(project);
}
