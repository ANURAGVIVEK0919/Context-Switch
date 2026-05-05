// testSessionSidebar.js
// This script tests the /debug/session API endpoint for the VS Code extension sidebar
// Run: node testSessionSidebar.js

const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/debug/session',
  method: 'GET',
  headers: {
    'Content-Type': 'application/json'
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      if (json.sessionId && Array.isArray(json.events)) {
        console.log('✅ Sidebar API test passed!');
        console.log('Session ID:', json.sessionId);
        console.log('Events count:', json.events.length);
        if (json.events.length > 0) {
          console.log('First event:', json.events[0]);
        }
      } else if (json.message === 'No active session') {
        console.log('ℹ️  No active session (API responded correctly)');
      } else {
        console.error('❌ Sidebar API test failed: Unexpected response:', json);
        process.exit(1);
      }
    } catch (e) {
      console.error('❌ Sidebar API test failed: Invalid JSON response');
      process.exit(1);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Sidebar API test failed:', error.message);
  process.exit(1);
});

req.end();
