import dotenv from 'dotenv';
import db from '../db';
import { aiReason } from './aiService';
import { buildContextFromMemory } from './memoryService';
import { sendTelegramMessage } from './telegramService';
dotenv.config();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';

let offset = 0;
let polling = false;

/**
 * Handles incoming Telegram messages (e.g., user asking questions via bot).
 * Currently a stub — extend to handle /start, questions, commands etc.
 */
export function startTelegramPolling(): void {
    if (!BOT_TOKEN) {
        console.log('[Telegram] Inbound polling disabled — TELEGRAM_BOT_TOKEN not set.');
        return;
    }
    if (polling) return;
    polling = true;
    console.log('[Telegram] Inbound polling started.');
    pollLoop();
}

async function pollLoop(): Promise<void> {
    while (polling) {
        try {
            const res = await fetch(
                `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=${offset}&timeout=20`
            );
            if (!res.ok) { await sleep(5000); continue; }
            const data: any = await res.json();
            if (data.ok && Array.isArray(data.result)) {
                for (const update of data.result) {
                    offset = update.update_id + 1;
                    await handleUpdate(update);
                }
            }
        } catch {
            await sleep(5000);
        }
    }
}

async function handleUpdate(update: any): Promise<void> {
    const msg = update.message;
    if (!msg || !msg.text) return;
    const text: string = msg.text.trim();
    const chatId: number = msg.chat.id;

    console.log(`[Telegram] Inbound from ${chatId}: ${text}`);

    if (text.startsWith('/link ')) {
        const email = text.split(' ')[1];
        if (!email) {
            await sendTelegramMessage('Usage: /link your@email.com', String(chatId));
            return;
        }
        try {
            const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as any;
            if (!user) {
                await sendTelegramMessage('❌ User not found in ContextSwitch. Please register via the VS Code extension first.', String(chatId));
                return;
            }
            db.prepare('UPDATE users SET telegram_chat_id = ? WHERE id = ?').run(String(chatId), user.id);
            await sendTelegramMessage(`✅ Successfully linked! You will now receive session updates for <b>${email}</b>.`, String(chatId));
        } catch (err) {
            await sendTelegramMessage('❌ Error linking account.', String(chatId));
        }
        return;
    }

    if (text.startsWith('/start')) {
        await sendTelegramMessage('Welcome to ContextSwitch! Use <code>/link your@email.com</code> to start receiving updates.', String(chatId));
        return;
    }

    // Handle questions
    if (text.endsWith('?')) {
        const user = db.prepare('SELECT id FROM users WHERE telegram_chat_id = ?').get(String(chatId)) as any;
        if (!user) {
            await sendTelegramMessage('Please link your account first using <code>/link your@email.com</code>', String(chatId));
            return;
        }

        await sendTelegramMessage('⏳ <i>ContextSwitch is thinking...</i>', String(chatId));
        try {
            // Get most recent project for this user
            const lastSession = db.prepare('SELECT project FROM sessions WHERE user_id = ? ORDER BY start_ts DESC LIMIT 1').get(user.id) as any;
            const project = lastSession?.project || 'default';
            
            const context = buildContextFromMemory(project, user.id); 
            const aiData = await aiReason(context, text);
            await sendTelegramMessage(`🤖 <b>AI Answer:</b>\n\n${aiData.summary}`, String(chatId));
        } catch (err) {
            await sendTelegramMessage('❌ Sorry, I encountered an error while processing your request.', String(chatId));
        }
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function stopTelegramPolling(): void {
    polling = false;
}
