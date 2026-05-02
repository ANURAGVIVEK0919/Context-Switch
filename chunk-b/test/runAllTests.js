// runAllTests.js
// Run wsTest.js then apiTest.js with delay
const { exec } = require('child_process');
const path = require('path');

function runScript(script, cb) {
  const scriptPath = path.join(__dirname, script);
  exec(`node "${scriptPath}"`, (error, stdout, stderr) => {
    if (stdout) process.stdout.write(stdout);
    if (stderr) process.stderr.write(stderr);
    if (error) {
      console.error(`Error running ${script}:`, error);
    }
    if (cb) cb();
  });
}

runScript('wsTest.js', () => {
  setTimeout(() => {
    runScript('apiTest.js', () => {
      console.log('All tests completed');
    });
  }, 3000);
});
