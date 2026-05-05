const WebSocket = require('ws');
const fetch = globalThis.fetch || require('node-fetch');

const API_BASE = 'http://localhost:3001';
const WS_URL = 'ws://localhost:3002';

async function runTests() {
  console.log("🚀 Starting Integration Tests...\n");
  let sessionId = null;

  try {
    // 1. POST /session/start
    console.log("[Step 1] POST /session/start");
    const res1 = await fetch(`${API_BASE}/session/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project: "integration-test" })
    });
    const data1 = await res1.json();
    if (res1.ok && data1.session && data1.session.sessionId) {
      sessionId = data1.session.sessionId;
      console.log("✅ PASS", data1, "\n");
    } else {
      console.log("❌ FAIL", data1, "\n");
    }

    // 2. Open WebSocket and send file:change event
    console.log("[Step 2] WebSocket ws://localhost:3002");
    await new Promise((resolve, reject) => {
      const ws = new WebSocket(WS_URL);
      
      ws.on('open', () => {
        const msg = {
          type: "file:change",
          filePath: "src/test.ts",
          language: "typescript",
          project: "integration-test",
          timestamp: Date.now()
        };
        ws.send(JSON.stringify(msg));
        console.log("✅ PASS - WebSocket opened and message sent\n");
        ws.close();
        resolve();
      });

      ws.on('error', (err) => {
        console.log("❌ FAIL - WebSocket error", err.message, "\n");
        reject(err);
      });
    });

    // 3. Wait 1 second, then GET /dashboard/stats
    console.log("[Step 3] GET /dashboard/stats (Waiting 1s...)");
    await new Promise(r => setTimeout(r, 1000));
    const res3 = await fetch(`${API_BASE}/dashboard/stats`);
    const data3 = await res3.json();
    if (res3.ok && data3.totalEvents > 0) {
      console.log("✅ PASS", data3, "\n");
    } else {
      console.log("❌ FAIL - Expected totalEvents > 0", data3, "\n");
    }

    // 4. GET /context/enhanced?project=integration-test
    console.log("[Step 4] GET /context/enhanced?project=integration-test");
    const res4 = await fetch(`${API_BASE}/context/enhanced?project=integration-test`);
    const data4 = await res4.json();
    if (res4.ok) {
      console.log("✅ PASS", data4, "\n");
    } else {
      console.log("❌ FAIL", data4, "\n");
    }

    // 5. POST /ai/reason
    console.log("[Step 5] POST /ai/reason");
    const res5 = await fetch(`${API_BASE}/ai/reason`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: "integration-test", brief: "test context" })
    });
    const data5 = await res5.json();
    if (res5.ok && data5.summary !== undefined && data5.confidence !== undefined && data5.next_steps !== undefined) {
      console.log("✅ PASS", data5, "\n");
    } else {
      console.log("❌ FAIL", data5, "\n");
    }

    // 5.5. POST /braindump (seed context for reconstruct)
    console.log("[Step 5.5] POST /braindump");
    const res5_5 = await fetch(`${API_BASE}/braindump`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: "working on integration test", sessionId, project: "integration-test" })
    });
    const data5_5 = await res5_5.json();
    if (res5_5.ok) {
      console.log("✅ PASS", data5_5, "\n");
    } else {
      console.log("❌ FAIL", data5_5, "\n");
    }

    // 6. GET /reconstruct/integration-test
    console.log("[Step 6] GET /reconstruct/integration-test");
    const res6 = await fetch(`${API_BASE}/reconstruct/integration-test`);
    const data6 = await res6.json();
    if (res6.ok) {
      console.log("✅ PASS", data6, "\n");
    } else {
      console.log("❌ FAIL", data6, "\n");
    }

    // 7. POST /session/end
    console.log("[Step 7] POST /session/end");
    const res7 = await fetch(`${API_BASE}/session/end`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId })
    });
    const data7 = await res7.json();
    if (res7.ok) {
      console.log("✅ PASS", data7, "\n");
    } else {
      console.log("❌ FAIL", data7, "\n");
    }

    // 8. GET /session/history?limit=5
    console.log("[Step 8] GET /session/history?limit=5");
    const res8 = await fetch(`${API_BASE}/session/history?limit=5`);
    const data8 = await res8.json();
    
    // History usually returns array directly or inside an object
    let found = false;
    const historyArray = Array.isArray(data8) ? data8 : (data8.sessions || data8.history || []);
    
    found = historyArray.some(s => s.id === sessionId && (s.status === 'ended' || s.end_ts !== null));
    
    if (found) {
      console.log("✅ PASS", data8, "\n");
    } else {
      console.log("❌ FAIL - Session not found or not ended", data8, "\n");
    }

    console.log("🎉 Integration Tests Completed!");
  } catch (err) {
    console.error("❌ Test failed with error:", err);
  }
}

runTests();
