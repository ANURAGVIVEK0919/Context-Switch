// apiTest.js
// Test API event retrieval

const API_URL = 'http://localhost:3001/events';

async function runApiTest() {
  try {
    const res = await fetch(API_URL);
    if (!res.ok) {
      console.error('API request failed:', res.status, res.statusText);
      return;
    }
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      console.log('No events found');
    } else {
      console.log('Events present in DB:', data.length);
      data.forEach((event, idx) => {
        console.log(`[${idx + 1}]`, event);
      });
    }
  } catch (err) {
    console.error('API test error:', err);
  }
}

if (require.main === module) {
  runApiTest();
}
