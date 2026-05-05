const WebSocket = require('ws');
const fetch = globalThis.fetch || require('node-fetch');

const API_BASE = 'http://localhost:3001';
const WS_URL = 'ws://localhost:3002';
const PROJECT_NAME = 'vaibhav-test-project';

async function runTests() {
  console.log("🚀 Starting Vaibhav Features Test...\n");
  let sessionId = null;

  try {
    // 1. Start Session
    console.log("[Step 1] Starting test session...");
    const res1 = await fetch(`${API_BASE}/session/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project: PROJECT_NAME })
    });
    const data1 = await res1.json();
    sessionId = data1.session.sessionId;
    console.log(`✅ Session Started: ${sessionId}`);

    // 2. Send the new Rich Context Events via WebSocket
    console.log("[Step 2] Sending Rich Context Events...");
    await new Promise((resolve, reject) => {
      const ws = new WebSocket(WS_URL);
      
      ws.on('open', () => {
        const eventsBatch = [
          {
            type: "git:commit",
            filePath: "src/auth.ts",
            project: PROJECT_NAME,
            timestamp: Date.now(),
            message: "fix: null pointer in auth.ts",
            branch: "feature/login"
          },
          {
            type: "diagnostic:error",
            filePath: "/src/auth.ts",
            project: PROJECT_NAME,
            timestamp: Date.now(),
            diff: "Cannot read property 'id' of undefined",
            severity: "error"
          },
          {
            type: "terminal:command",
            filePath: "terminal",
            project: PROJECT_NAME,
            timestamp: Date.now(),
            diff: "npm run dev"
          },
          {
            type: "file:change",
            filePath: "/src/readme.md",
            language: "markdown",
            project: PROJECT_NAME,
            timestamp: Date.now(),
            diff: "Opened file for reading"
          }
        ];

        ws.send(JSON.stringify({
          type: "batch",
          events: eventsBatch
        }));
        
        console.log("✅ Batch events sent successfully.");
        
        // Close WS after sending
        setTimeout(() => {
           ws.close();
           resolve();
        }, 500);
      });

      ws.on('error', (err) => {
        console.error("❌ WebSocket error", err.message);
        reject(err);
      });
    });

    // Wait a bit for db insertions
    await new Promise(r => setTimeout(r, 1000));

    // 3. Test OpenClaw Handoff Endpoint
    console.log("[Step 3] Fetching OpenClaw Analysis (/reconstruct)...");
    const res3 = await fetch(`${API_BASE}/reconstruct/${PROJECT_NAME}?queryType=handoff`);
    const data3 = await res3.json();
    
    if (res3.ok && data3.brief && data3.confidence) {
      console.log("✅ OpenClaw Response received successfully!");
      console.log("Confidence:", data3.confidence);
      console.log("Brief:", data3.brief);
      
      if (data3.pastSessionResults && data3.pastSessionResults.length > 0) {
        console.log("\n📜 Past Session History:");
        data3.pastSessionResults.forEach((res, i) => {
          console.log(`[Session ${data3.pastSessionResults.length - i}] ${res.summary.substring(0, 100)}...`);
        });
      }

      if (data3.next_steps) {
        console.log("\nNext Steps:", data3.next_steps.length);
      }
    } else {
      console.log("❌ OpenClaw Response failed or missing fields:", data3);
    }

    // 4. End Session
    console.log("[Step 4] Ending test session...");
    await fetch(`${API_BASE}/session/end`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId })
    });
    console.log("✅ Session Ended.");

    console.log("\n🎉 Vaibhav Features Test Completed!");
  } catch (err) {
    console.error("❌ Test failed with error:", err);
  }
}

runTests();
