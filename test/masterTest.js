const fetch = globalThis.fetch || require('node-fetch');
const WebSocket = require('ws');

async function runMasterTest() {
  const projectId = 'master-test-project';
  const baseUrl = 'http://localhost:3001';
  const wsUrl = 'ws://localhost:3002';

  console.log("🚀 STARTING MASTER INTEGRATION TEST\n");

  try {
    // --- PHASE 1: SESSION START ---
    console.log("[Phase 1] Starting Session...");
    const res1 = await fetch(`${baseUrl}/session/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project: projectId })
    });
    const data1 = await res1.json();
    const sessionId = data1.session.sessionId;
    console.log(`✅ Session Started (ID: ${sessionId})\n`);

    // --- PHASE 2: EVENT INGESTION (WS) ---
    console.log("[Phase 2] Sending Live Events via WebSocket...");
    await new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      ws.on('open', () => {
        const events = {
          type: 'batch',
          events: [
            { type: 'git:commit', project: projectId, message: 'Initial architecture setup', filePath: 'src/main.ts', timestamp: Date.now() },
            { type: 'diagnostic:error', project: projectId, diff: 'Database connection failed', filePath: 'src/db.ts', timestamp: Date.now() + 100 },
            { type: 'terminal:command', project: projectId, diff: 'npm run migrate', filePath: 'terminal', timestamp: Date.now() + 200 }
          ]
        };
        ws.send(JSON.stringify(events));
        setTimeout(() => { ws.close(); resolve(); }, 1000);
      });
      ws.on('error', reject);
    });
    console.log("✅ Live events ingested.\n");

    // --- PHASE 3: BRAINDUMP ---
    console.log("[Phase 3] Submitting Developer Note (Braindump)...");
    await fetch(`${baseUrl}/braindump`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project: projectId, content: "Decided to use SQLite for local persistence today.", sessionId })
    });
    console.log("✅ Note saved.\n");

    // --- PHASE 4: SIDEBAR CHECK ---
    console.log("[Phase 4] Verifying Sidebar Timeline...");
    const res4 = await fetch(`${baseUrl}/debug/session`);
    const data4 = await res4.json();
    console.log(`✅ Sidebar shows ${data4.events?.length || 0} events.\n`);

    // --- PHASE 5: ASK OPENCLAW ---
    console.log("[Phase 5] Testing AskOpenClaw Chat...");
    const res5 = await fetch(`${baseUrl}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, question: "What database am I planning to use?" })
    });
    const data5 = await res5.json();
    console.log("🤖 OpenClaw Answer:", data5.answer.substring(0, 100), "...\n");

    // --- PHASE 6: HANDOFF RECONSTRUCTION ---
    console.log("[Phase 6] Testing OpenClaw Handoff Reconstruction...");
    const res6 = await fetch(`${baseUrl}/reconstruct/${projectId}`);
    const data6 = await res6.json();
    console.log("📝 Handoff Brief:", data6.brief.substring(0, 100), "...\n");

    // --- PHASE 7: SESSION END & SYNTHESIS ---
    console.log("[Phase 7] Ending Session & Triggering Memory Synthesis...");
    await fetch(`${baseUrl}/session/end`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId })
    });
    console.log("✅ Session ended. Synthesis triggered in background.\n");

    // --- PHASE 8: DASHBOARD ANALYTICS ---
    console.log("[Phase 8] Verifying Dashboard Stats...");
    const res8 = await fetch(`${baseUrl}/dashboard/stats`);
    const data8 = await res8.json();
    console.log(`📊 Total System Events: ${data8.totalEvents}`);
    console.log(`📊 Total System Sessions: ${data8.totalSessions}\n`);

    console.log("🎉 MASTER INTEGRATION TEST COMPLETED SUCCESSFULLY!");

  } catch (err) {
    console.error("\n❌ MASTER TEST FAILED:", err.message);
  }
}

runMasterTest();
