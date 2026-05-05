import db from "../db/db";
import { sendTelegramMessage } from "./telegramService";
import { generateContextSummary } from "./aiService";

export const generateMorningBrief = async () => {
  try {
    // 1. Find the most stale project
    const now = Date.now();
    const projects = db.prepare(`
      SELECT project, MAX(startTime) as lastActive
      FROM sessions
      GROUP BY project
      ORDER BY lastActive ASC
    `).all() as any[];

    if (projects.length === 0) return "No project activity found yet.";

    const mostStale = projects[0];
    const daysSince = Math.floor((now - mostStale.lastActive) / (1000 * 60 * 60 * 24));

    // 2. Fetch last session and last braindump for this project
    const lastSession = db.prepare(`SELECT * FROM sessions WHERE project = ? ORDER BY startTime DESC LIMIT 1`).get(mostStale.project) as any;
    const lastNote = db.prepare(`SELECT content FROM braindumps ORDER BY timestamp DESC LIMIT 1`).get() as any;

    // 3. Construct Message
    let message = `<b>🌅 Morning Brief</b>\n\n`;
    message += `You have <b>${projects.length}</b> active projects.\n\n`;
    message += `⚠️ <b>Most Stale:</b> ${mostStale.project} (${daysSince} days)\n`;
    message += `📝 <b>Last Work:</b> ${lastNote ? lastNote.content : "No notes found"}\n`;
    message += `\n<i>Tap into VS Code to pick up where you left off.</i>`;

    await sendTelegramMessage(message);
    return true;
  } catch (err) {
    console.error("Morning Brief Failed:", err);
    return false;
  }
};

export const generateEveningNudge = async () => {
  try {
    const today = new Date();
    today.setHours(0,0,0,0);
    
    // Check if any session was started today
    const sessionToday = db.prepare(`SELECT id FROM sessions WHERE startTime >= ?`).get(today.getTime());

    if (!sessionToday) {
      const lastSession = db.prepare(`SELECT project FROM sessions ORDER BY startTime DESC LIMIT 1`).get() as any;
      let message = `<b>🌙 Evening Nudge</b>\n\n`;
      message += `You haven't coded today! 😴\n\n`;
      if (lastSession) {
        message += `<b>Last Project:</b> ${lastSession.project}\n`;
      }
      message += `Don't let the context slip away. Want to log a quick brain dump?`;
      await sendTelegramMessage(message);
    }
  } catch (err) {
    console.error("Evening Nudge Failed:", err);
  }
};

export const checkStaleProjectAlerts = async () => {
  try {
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const staleProjects = db.prepare(`
      SELECT project, MAX(startTime) as lastActive
      FROM sessions
      GROUP BY project
      HAVING lastActive < ?
    `).all(sevenDaysAgo) as any[];

    for (const project of staleProjects) {
      let message = `<b>⚠️ Stale Project Alert</b>\n\n`;
      message += `Project <b>${project.project}</b> is going stale (> 7 days inactive).\n`;
      const lastNote = db.prepare(`SELECT content FROM braindumps ORDER BY timestamp DESC LIMIT 1`).get() as any;
      if (lastNote) {
        message += `\n<b>Last Note:</b>\n"${lastNote.content}"`;
      }
      await sendTelegramMessage(message);
    }
  } catch (err) {
    console.error("Stale Alert Failed:", err);
  }
};

export const generateWeeklyReport = async () => {
  try {
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    
    // 1. Get Weekly Stats
    const stats = db.prepare(`
      SELECT COUNT(*) as sessions, COUNT(DISTINCT project) as projects, MAX(endTime - startTime) as longest
      FROM sessions
      WHERE startTime > ?
    `).get(sevenDaysAgo) as any;

    const mostActive = db.prepare(`
      SELECT project, COUNT(*) as count
      FROM sessions
      WHERE startTime > ?
      GROUP BY project
      ORDER BY count DESC
      LIMIT 1
    `).get(sevenDaysAgo) as any;

    // 2. Format Message
    let message = `<b>📊 Weekly Summary</b>\n\n`;
    message += `<b>Sessions:</b> ${stats.sessions}\n`;
    message += `<b>Projects worked on:</b> ${stats.projects}\n`;
    if (mostActive) {
      message += `<b>Most active:</b> ${mostActive.project}\n`;
    }
    if (stats.longest) {
      const durationMins = Math.floor(stats.longest / 60000);
      message += `<b>Longest session:</b> ${durationMins}m\n`;
    }
    message += `\nGreat job this week! 🚀`;

    await sendTelegramMessage(message);
    return true;
  } catch (err) {
    console.error("Weekly Report Failed:", err);
    return false;
  }
};
