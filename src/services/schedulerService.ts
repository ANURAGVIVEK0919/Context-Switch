import { sendDailyDigest } from './slackService';
import db from '../db';
import { handleReconstruct } from '../routes/reconstruct.routes';

/**
 * Simple scheduler that runs once an hour to check for daily tasks.
 */
export function startDailyScheduler() {
    console.log('[Scheduler] Daily automated brief service started.');
    
    // Check every hour
    setInterval(async () => {
        const now = new Date();
        const hours = now.getHours();
        
        // Trigger at 9:00 AM (local server time)
        if (hours === 9) {
            console.log('[Scheduler] It is 9 AM. Processing daily briefs...');
            await processDailyBriefs();
        }
    }, 1000 * 60 * 60); 
}

async function processDailyBriefs() {
    try {
        // Get all users who have Slack configured (or just all active users)
        const users = db.prepare('SELECT id, email FROM users').all() as { id: number, email: string }[];
        
        for (const user of users) {
            // Get their active projects from the last 24 hours
            const projects = db.prepare(`
                SELECT DISTINCT project FROM sessions 
                WHERE user_id = ? AND start_ts > ?
            `).all(user.id, Date.now() - (1000 * 60 * 60 * 24)) as { project: string }[];
            
            for (const { project } of projects) {
                console.log(`[Scheduler] Generating brief for User ${user.id} on Project ${project}`);
                
                // Use the reconstruct logic to get a summary
                // Note: We simulate a request object or just call a helper if we refactor handleReconstruct
                // For now, let's assume we want a simple summary
                const summary = await generateBriefSummary(user.id, project);
                
                await sendDailyDigest(user.id, project, summary);
            }
        }
    } catch (err) {
        console.error('[Scheduler] Error processing daily briefs:', err);
    }
}

async function generateBriefSummary(userId: number, project: string): Promise<string> {
    // This is a placeholder for a simplified version of the reconstruction logic
    // In a real app, you'd refactor the AI logic into a standalone service
    return `Summary for ${project}: You worked on several files including latest changes in the codebase. (Full AI summary feature pending refactor to service layer).`;
}
