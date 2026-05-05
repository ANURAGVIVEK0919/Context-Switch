const fetch = globalThis.fetch || require('node-fetch');

async function triggerSurface3() {
  const baseUrl = 'http://localhost:3001';

  console.log("🚀 TESTING SURFACE 3 (TELEGRAM HEARTBEAT)\n");

  console.log("[Test 1] Simulating Morning Brief Trigger...");
  // We'll add a temporary debug route or just call the service directly if we were in TS.
  // Since we are in JS, let's add a debug endpoint to server.ts to trigger these.
  
  try {
    const res = await fetch(`${baseUrl}/debug/heartbeat/morning`);
    const data = await res.json();
    if (data.success) {
      console.log("✅ Morning Brief sent to Telegram!\n");
    } else {
      console.error("❌ Failed to send Morning Brief. Check server logs.\n");
    }

    console.log("[Test 2] Simulating Stale Project Alert...");
    const res2 = await fetch(`${baseUrl}/debug/heartbeat/stale`);
    const data2 = await res2.json();
    if (data2.success) {
      console.log("✅ Stale Alert sent to Telegram!\n");
    } else {
      console.error("❌ Failed to send Stale Alert.\n");
    }

  } catch (err) {
    console.error("❌ Test failed. Is the server running on 3001?");
  }
}

triggerSurface3();
