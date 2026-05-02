// wsTest.js
// Test WebSocket event and batch handling
const WebSocket = require('ws');

const WS_URL = 'ws://localhost:3002';

function sendRapidEvents(ws, count = 10) {
  for (let i = 0; i < count; i++) {
    ws.send(JSON.stringify({
      type: 'file:change',
      filePath: `test/file${i}.js`,
      language: 'javascript',
      project: 'test-project',
      timestamp: Date.now()
    }));
  }
  console.log(`Sent ${count} rapid file:change events.`);
}

function sendBatchEvent(ws) {
  const batch = [];
  for (let i = 0; i < 5; i++) {
    batch.push({
      type: 'file:change',
      filePath: `batch/file${i}.js`,
      language: 'javascript',
      project: 'test-project',
      timestamp: Date.now()
    });
  }
  ws.send(JSON.stringify({
    type: 'batch',
    events: batch
  }));
  console.log('Sent 1 batch event with 5 file:change events.');
}

function runWsTest() {
  const ws = new WebSocket(WS_URL);
  ws.on('open', () => {
    console.log('WebSocket connected.');
    sendRapidEvents(ws);
    setTimeout(() => {
      sendBatchEvent(ws);
      setTimeout(() => {
        ws.close();
        console.log('WebSocket test completed.');
      }, 500);
    }, 500);
  });
  ws.on('error', (err) => {
    console.error('WebSocket error:', err);
  });
}

if (require.main === module) {
  runWsTest();
}
