

import * as vscode from "vscode";
import WebSocket from "ws";
import { execSync } from 'child_process';

// --- 1. Global WebSocket ---
let ws: WebSocket;
// Debounce and deduplication
let debounceTimer: NodeJS.Timeout | undefined;
let lastFile = "";
let lastTime = 0;

// Event batching
let eventQueue: any[] = [];


// --- 2. Activate function ---
let sessionStarted = false;
export function activate(context: vscode.ExtensionContext) {
  console.log("Extension activated");
  // --- SESSION START ---
  if (!sessionStarted) {
    sessionStarted = true;
    console.log("Triggering session start...");
    const http = require('http');
    const postData = JSON.stringify({ project: vscode.workspace.workspaceFolders?.[0]?.name || "unknown", timestamp: Date.now() });
    const req = http.request({ hostname: 'localhost', port: 3001, path: '/session/start', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) } }, (res: any) => { console.log('Session started'); });
    req.write(postData);
    req.end();
  }

  // Connect WebSocket
  ws = new WebSocket("ws://localhost:3002");

  ws.onopen = () => {
    console.log("WS connected");
  };
  // --- 3. FILE CHANGE LISTENER (debounced, deduped, filtered, batched) ---
  vscode.workspace.onDidChangeTextDocument((event) => {
    // Extract diff summary before debouncing
    const changes = event.contentChanges.map(change => {
      const line = change.range.start.line;
      let lineText = "";
      try {
        lineText = event.document.lineAt(line).text.trim();
      } catch (e) {}
      if (!lineText) {
          return `Line ${line + 1} edited (empty/deleted)`;
      }
      return `Line ${line + 1}: ${lineText.substring(0, 100)}${lineText.length > 100 ? '...' : ''}`;
    }).join(' | ');

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const filePath = event.document.fileName;

      // Smart file filtering
      if (
        filePath.includes("node_modules") ||
        filePath.includes(".git") ||
        filePath.includes("dist") ||
        filePath.includes("build")
      ) {
        return;
      }

      // Deduplication
      if (lastFile === filePath && Date.now() - lastTime < 1000) {
        return;
      }
      lastFile = filePath;
      lastTime = Date.now();

      // Push to event queue
      eventQueue.push({
        type: "file:change",
        filePath,
        language: event.document.languageId,
        project: vscode.workspace.workspaceFolders?.[0]?.name || "unknown",
        timestamp: Date.now(),
        diff: changes
      });
      console.log("Queued file:change event for", filePath);
    }, 500);
  });

  // --- 4. GIT ACTIVITY (ON SAVE, batched) ---
  vscode.workspace.onDidSaveTextDocument((doc) => {
    console.log("File saved:", doc.fileName);
    // Smart file filtering
    if (
      doc.fileName.includes("node_modules") ||
      doc.fileName.includes(".git") ||
      doc.fileName.includes("dist") ||
      doc.fileName.includes("build")
    ) {
      return;
    }
    eventQueue.push({
      type: "git:activity",
      filePath: doc.fileName,
      timestamp: Date.now()
    });
    console.log("Queued git:activity event for", doc.fileName);
  });

  // --- 5. BATCH SENDER ---
  setInterval(() => {
    if (eventQueue.length > 0 && ws.readyState === WebSocket.OPEN) {
      console.log("Sending batch via WS:", eventQueue.length);
      ws.send(
        JSON.stringify({
          type: "batch",
          events: eventQueue
        })
      );
      console.log("Batch sent successfully");
      eventQueue = [];
    }
  }, 2000);
}


// --- 5. DEACTIVATE FUNCTION ---
export function deactivate() {
  console.log("Extension deactivated");
  const projectName = vscode.workspace.workspaceFolders?.[0]?.name || 'unknown';
  try {
    execSync(`node -e "const h=require('http');const d=JSON.stringify({project:'${projectName}'});const r=h.request({hostname:'localhost',port:3001,path:'/session/end-by-project',method:'POST',headers:{'Content-Type':'application/json','Content-Length':d.length}});r.write(d);r.end();"`, { timeout: 2000 });
  } catch (e) {
    // swallow errors — best effort cleanup
  }
}