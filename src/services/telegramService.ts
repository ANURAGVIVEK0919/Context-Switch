import dotenv from 'dotenv';
dotenv.config();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const CHAT_ID   = process.env.TELEGRAM_CHAT_ID   || '';

/**
 * Send a plain or HTML-formatted message to the configured Telegram chat.
 * Silently no-ops if BOT_TOKEN / CHAT_ID are not set in .env.
 */
export async function sendTelegramMessage(message: string, targetChatId?: string): Promise<void> {
    const finalChatId = targetChatId || CHAT_ID;
    if (!BOT_TOKEN || !finalChatId) {
        console.log('[Telegram] Skipping send — BOT_TOKEN or target chat ID not configured.');
        return;
    }
    try {
        const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id:    finalChatId,
                text:       message,
                parse_mode: 'HTML'
            })
        });
        if (!res.ok) {
            const body = await res.text();
            console.warn('[Telegram] sendMessage failed:', res.status, body);
        }
    } catch (err: any) {
        console.warn('[Telegram] sendMessage error (non-fatal):', err.message);
    }
}
