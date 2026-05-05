const fetch = globalThis.fetch || require('node-fetch');

async function testAsk() {
  const projectId = 'vaibhav-test-project';
  const question = 'What is the main error I have been seeing in auth.ts?';
  
  console.log(`🚀 Asking OpenClaw: "${question}"...\n`);

  try {
    const res = await fetch('http://localhost:3001/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, question })
    });

    const data = await res.json();

    if (res.ok) {
      console.log("🤖 OpenClaw Answer:");
      console.log("-------------------");
      console.log(data.answer);
      console.log("-------------------");
      console.log(`(Sources found: ${data.sourcesFound})`);
    } else {
      console.error("❌ Failed to get answer:", data.error);
      if (data.details) console.error("   Details:", data.details);
      if (data.stack) console.error("   Stack:", data.stack.split('\n')[0]); // Just the first line of stack
    }
  } catch (err) {
    console.error("❌ Test failed:", err.message);
  }
}

testAsk();
