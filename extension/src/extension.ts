

import * as vscode from "vscode";
import WebSocket from "ws";
import { execSync } from 'child_process';
import fetch from 'node-fetch';

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

    let branch = "unknown";
    let message = "unknown";
    try {
        const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (cwd) {
            branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd }).toString().trim();
            message = execSync('git log -1 --pretty=%B', { cwd }).toString().trim();
        }
    } catch (e) {}

    eventQueue.push({
      type: "git:commit",
      filePath: doc.fileName,
      message,
      branch,
      timestamp: Date.now()
    });
    console.log("Queued git:commit event for", doc.fileName);
  });

  // --- DIAGNOSTIC ERRORS ---
  vscode.languages.onDidChangeDiagnostics((e) => {
      e.uris.forEach(uri => {
          if (uri.fsPath.includes("node_modules")) return;
          const diagnostics = vscode.languages.getDiagnostics(uri);
          diagnostics.forEach(diag => {
              if (diag.severity === vscode.DiagnosticSeverity.Error) {
                  eventQueue.push({
                      type: "diagnostic:error",
                      filePath: uri.fsPath,
                      diff: diag.message,
                      severity: "error",
                      timestamp: Date.now()
                  });
              }
          });
      });
  });

  // --- TERMINAL COMMANDS ---
  if ((vscode.window as any).onDidEndTerminalShellExecution) {
      (vscode.window as any).onDidEndTerminalShellExecution((e: any) => {
          eventQueue.push({
              type: "terminal:command",
              filePath: "terminal",
              diff: e.execution.commandLine.value,
              timestamp: Date.now()
          });
      });
  } else {
      vscode.window.onDidCloseTerminal((terminal) => {
          eventQueue.push({
              type: "terminal:command",
              filePath: "terminal",
              diff: `Terminal closed: ${terminal.name}`,
              timestamp: Date.now()
          });
      });
  }

  // --- FILE OPEN EVENT ---
  vscode.workspace.onDidOpenTextDocument((doc) => {
      if (
          doc.fileName.includes("node_modules") ||
          doc.fileName.includes(".git") ||
          doc.fileName.includes("dist") ||
          doc.fileName.includes("build")
      ) {
          return;
      }
      eventQueue.push({
          type: "file:change",
          filePath: doc.fileName,
          language: doc.languageId,
          diff: "Opened file for reading",
          timestamp: Date.now()
      });
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

  // --- OPENCLAW COMMAND ---
  let openClawDisposable = vscode.commands.registerCommand('contextswitch.runOpenClaw', async () => {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) {
          vscode.window.showErrorMessage("No workspace open.");
          return;
      }
      
      const projectName = workspaceFolders[0].name;

      vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification,
          title: "OpenClaw: Analyzing workspace context...",
          cancellable: false
      }, async (progress) => {
          try {
              const response = await fetch(`http://localhost:3001/reconstruct/${projectName}?queryType=handoff`);
              const data = await response.json() as any;

              const panel = vscode.window.createWebviewPanel(
                  'openClawView',
                  'OpenClaw Analysis',
                  vscode.ViewColumn.Beside,
                  { enableScripts: true }
              );

              panel.webview.html = getWebviewContent(data);

          } catch (error) {
              vscode.window.showErrorMessage("OpenClaw connection failed. Is the backend running?");
          }
      });
  });
  context.subscriptions.push(openClawDisposable);
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

// Helper function to generate nice HTML
function getWebviewContent(data: any) {
    const nextStepsHtml = data.next_steps 
        ? data.next_steps.map((step: string) => `<li>${step}</li>`).join('') 
        : '';

    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <style>
                body { font-family: var(--vscode-font-family); padding: 20px; line-height: 1.6; }
                .confidence { color: var(--vscode-testing-iconPassed); font-weight: bold; }
                .card { background: var(--vscode-editorWidget-background); padding: 15px; border-radius: 6px; border: 1px solid var(--vscode-widget-border); margin-bottom: 20px; }
                h2 { color: var(--vscode-textLink-foreground); }
            </style>
        </head>
        <body>
            <h1>OpenClaw Intelligence</h1>
            <p class="confidence">Confidence Score: ${data.confidence}%</p>
            
            <div class="card">
                <h2>Context Brief</h2>
                <p>${data.brief}</p>
            </div>

            <div class="card">
                <h2>Recommended Next Steps</h2>
                <ul>${nextStepsHtml}</ul>
            </div>
        </body>
        </html>
    `;
}