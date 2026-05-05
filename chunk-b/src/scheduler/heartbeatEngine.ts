import { generateMorningBrief, generateEveningNudge, checkStaleProjectAlerts, generateWeeklyReport } from "../services/heartbeatService";

export const startHeartbeatEngine = () => {
  console.log("🚀 Surface 3 Heartbeat Engine Started");

  // Run a check every minute to see if it's time for a notification
  setInterval(async () => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();

    // 🌅 Morning Brief: Daily 08:00
    if (hours === 8 && minutes === 0) {
      console.log("Triggering Morning Brief...");
      await generateMorningBrief();
    }

    // 🌙 Evening Nudge: Daily 21:00
    if (hours === 21 && minutes === 0) {
      console.log("Triggering Evening Nudge...");
      await generateEveningNudge();
    }

    // 📊 Weekly Report: Sunday 10:00
    if (now.getDay() === 0 && hours === 10 && minutes === 0) {
      console.log("Triggering Weekly Report...");
      await generateWeeklyReport();
    }

    // ⚠️ Stale Project Alert: Daily 12:00
    if (hours === 12 && minutes === 0) {
      console.log("Triggering Stale Project Alerts...");
      await checkStaleProjectAlerts();
    }

  }, 60000); // Check every minute
};
