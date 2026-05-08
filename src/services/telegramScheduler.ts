import db from '../db';
import { sendTelegramMessage } from './telegramService';
import { sendDailyDigest } from './slackService';

let schedulerStarted = false;

// ── Idle alert thresholds ──────────────────────────────────────────────────
const IDLE_WARN_MS   = 45 * 60 * 1000;  // 45 minutes idle → warn
const IDLE_ALERT_MS  = 90 * 60 * 1000;  // 90 minutes idle → alert
const CHECK_INTERVAL = 5 * 60 * 1000;   // check every 5 minutes

/**
 * Called by wsServer / session ingest every time a new event arrives.
 * Resets the idle countdown for a specific user.
 */
export function updateLastEventTs(userId: number): void {
    const now = Date.now();
    db.prepare(`
        UPDATE users SET 
            last_event_ts = ?, 
            idle_warn_sent = 0, 
            idle_alert_sent = 0 
        WHERE id = ?
    `).run(now, userId);
}

/**
 * Starts the proactive scheduler:
 * Loops through all users with a linked Telegram account and checks idleness.
 */
export function startScheduler(): void {
    if (schedulerStarted) return;
    schedulerStarted = true;
    console.log('[Scheduler] Unified Multi-user Scheduler started.');

    let lastBriefDay = -1;

    setInterval(async () => {
        const now = new Date();
        const nowMs = now.getTime();
        
        // 1. Check for Daily Morning Brief (9 AM)
        if (now.getHours() === 9 && now.getDate() !== lastBriefDay) {
            lastBriefDay = now.getDate();
            console.log('[Scheduler] Triggering daily morning briefs...');
            await triggerDailyBriefs();
        }

        // 2. Existing Telegram Idle Logic
        const users = db.prepare('SELECT id, email, telegram_chat_id, last_event_ts, idle_warn_sent, idle_alert_sent FROM users WHERE telegram_chat_id IS NOT NULL').all() as any[];

        for (const user of users) {
            if (!user.last_event_ts) continue;

            const idleMs = nowMs - user.last_event_ts;

            if (idleMs >= IDLE_ALERT_MS && !user.idle_alert_sent) {
                db.prepare('UPDATE users SET idle_alert_sent = 1 WHERE id = ?').run(user.id);
                await sendTelegramMessage(
                    `😴 <b>Idle Alert</b>\nNo coding activity detected for <b>90+ minutes</b>.\n\nNeed a hand getting back into the flow? Check your latest ContextSwitch brief!`,
                    user.telegram_chat_id
                );
                console.log(`[Telegram] Sent Idle Alert to user ${user.id} (${user.email})`);

            } else if (idleMs >= IDLE_WARN_MS && !user.idle_warn_sent) {
                db.prepare('UPDATE users SET idle_warn_sent = 1 WHERE id = ?').run(user.id);
                await sendTelegramMessage(
                    `💤 <b>Heads Up</b>\nYou've been idle for <b>45 minutes</b>. Still in the zone? Just a friendly check-in from ContextSwitch.`,
                    user.telegram_chat_id
                );
                console.log(`[Telegram] Sent Idle Warn to user ${user.id} (${user.email})`);
            }
        }
    }, CHECK_INTERVAL);
}

async function triggerDailyBriefs() {
    try {
        const users = db.prepare('SELECT id, email FROM users').all() as { id: number, email: string }[];
        for (const user of users) {
            const projects = db.prepare(`
                SELECT DISTINCT project FROM sessions 
                WHERE user_id = ? AND start_ts > ?
            `).all(user.id, Date.now() - (24 * 60 * 60 * 1000)) as { project: string }[];
            
            for (const { project } of projects) {
                // In a production app, we would call the AI here. 
                // For now, we send a direct "Resume" link.
                const message = `Good morning! ☕️ You were working on *${project}* yesterday. Ready to dive back in?\n\nView your timeline: http://localhost:5173/sessions?project=${encodeURIComponent(project)}`;
                await sendDailyDigest(user.id, project, message);
            }
        }
    } catch (err) {
        console.error('[Scheduler] Briefing error:', err);
    }
}
