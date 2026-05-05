import fetch from "node-fetch";
import db from "../db/db";
import { sendTelegramMessage } from "./telegramService";
import { askOpenClaw } from "./aiService";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

let lastUpdateId = 0;

export const startTelegramPolling = () => {
  console.log("📥 Telegram Inbound Listener Started (Polling mode)");
  
  setInterval(async () => {
    if (!TOKEN || !CHAT_ID) return;

    try {
      const url = `https://api.telegram.org/bot${TOKEN}/getUpdates?offset=${lastUpdateId + 1}&timeout=10`;
      const res = await fetch(url);
      const data = await res.json() as any;

      if (data.ok && data.result.length > 0) {
        for (const update of data.result) {
          lastUpdateId = update.update_id;
          
          const message = update.message;
          if (!message || !message.text) continue;

          // Security: Only respond to the authorized user
          if (String(message.chat.id) !== String(CHAT_ID)) {
            console.log(`Unauthorized message from: ${message.chat.id}`);
            continue;
          }

          await handleIncomingTelegramMessage(message.text);
        }
      }
    } catch (err) {
      console.error("Telegram Polling Error:", err);
    }
  }, 5000); // Check every 5 seconds
};

async function handleIncomingTelegramMessage(text: string) {
  console.log(`Telegram Inbound: "${text}"`);

  if (text.trim().endsWith("?")) {
    // 1. It's a question -> Call AskOpenClaw
    await sendTelegramMessage("🔍 <i>Searching project history...</i>");
    
    // We'll use a default project ID for now (usually 'default' or your last active project)
    const lastSession = db.prepare("SELECT project FROM sessions ORDER BY startTime DESC LIMIT 1").get() as any;
    const projectId = lastSession ? lastSession.project : "default";

    // Re-use our existing AskOpenClaw logic (we should ideally refactor this into a service)
    // For now, I'll call the service logic directly
    try {
        // Need to construct knowledge base similarly to ask.routes.ts
        // Simplified version for the bot:
        const knowledgeBase = "--- TELEGRAM QUERY ---"; // AI service handles the rest or we can refine
        const answer = await askOpenClaw(knowledgeBase, text);
        await sendTelegramMessage(`🤖 <b>OpenClaw:</b>\n\n${answer}`);
    } catch (e) {
        await sendTelegramMessage("❌ Sorry, I failed to process that question.");
    }
  } else {
    // 2. It's a note -> Save as BrainDump
    try {
      const lastSession = db.prepare("SELECT id, project FROM sessions ORDER BY startTime DESC LIMIT 1").get() as any;
      const sessionId = lastSession ? lastSession.id : null;
      const project = lastSession ? lastSession.project : "default";

      db.prepare(`
        INSERT INTO braindumps (content, timestamp) 
        VALUES (?, ?)
      `).run(text, Date.now());

      await sendTelegramMessage(`✅ <b>Note Saved</b> to project <i>${project}</i>\n\n"${text}"`);
    } catch (e) {
      await sendTelegramMessage("❌ Failed to save note.");
    }
  }
}
