const fs=require('fs'); 
const path='C:/Users/HP/.vscode/extensions/undefined_publisher.contextswitch-extension-0.0.2/out/SessionViewProvider.js'; 
let content=fs.readFileSync(path, 'utf8'); 
content=content.replace(/http:\/\/localhost/g, 'http://127.0.0.1'); 
content=content.replace(/const res = await axios_1\.default\.get\([^)]+\);/, 'const res = await axios_1.default.get(`http://127.0.0.1:3001/session/debug/session?project=${encodeURIComponent(project)}&t=${Date.now()}`, { timeout: 2000 });'); 
content=content.replace(/<script nonce="\$\{nonce\}">\n\s*const vscode = acquireVsCodeApi\(\);/, '<script nonce="${nonce}">\n  const vscode = acquireVsCodeApi();\n  document.getElementById(\'status-text\').innerText = \'Script loaded, wait...\';'); 
fs.writeFileSync(path, content);
