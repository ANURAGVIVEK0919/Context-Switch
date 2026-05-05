import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

interface TelegramResponse {
  ok: boolean;
  description?: string;
}

export const sendTelegramMessage = async (text: string) => {
  if (!TOKEN || !CHAT_ID) {
    console.error("Telegram credentials missing in .env (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID)");
    return false;
  }

  const url = `https://api.telegram.org/bot${TOKEN}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text,
        parse_mode: "HTML"
      })
    });
    const data = await res.json() as TelegramResponse;
    if (!data.ok) throw new Error(data.description);
    return true;
  } catch (err) {
    console.error("Telegram Send Failed:", err);
    return false;
  }
};
