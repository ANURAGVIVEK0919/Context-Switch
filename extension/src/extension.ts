

import * as vscode from "vscode";
import { execSync } from 'child_process';
<<<<<<< Updated upstream
=======
import axios from 'axios';
import { SessionViewProvider } from "./SessionViewProvider";
>>>>>>> Stashed changes

// --- Globals ---
// Per-file debounce timers — prevents one file's edits from cancelling another's
const debounceTimers = new Map<string, NodeJS.Timeout>();
// Per-file save dedup
const lastSaveTimes = new Map<string, number>();
// Event queue — flushed via HTTP every 3s
let eventQueue: any[] = [];

let sessionStarted = false;

function getProject(): string {
  return vscode.workspace.workspaceFolders?.[0]?.name || "unknown";
}

export function activate(context: vscode.ExtensionContext) {
  console.log("[ContextSwitch] Extension activated for project:", getProject());

  // Register sidebar view provider FIRST
  const sessionProvider = new SessionViewProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(SessionViewProvider.viewType, sessionProvider, {
      webviewOptions: { retainContextWhenHidden: true }
    })
  );

  // --- SESSION START ---
  if (!sessionStarted) {
    sessionStarted = true;
    axios.post("http://127.0.0.1:3001/session/start", {
      project: getProject(),
      timestamp: Date.now()
    }).then(() => {
      console.log("[ContextSwitch] Session started for:", getProject());
    }).catch((e) => {
      console.warn("[ContextSwitch] Session start failed (non-fatal):", e.message);
    });
  }

  // WebSocket for real-time UI broadcasts (non-critical)
  try {
    const ws = new (require('ws'))('ws://127.0.0.1:3002');
    ws.on('open', () => console.log('[ContextSwitch] WS connected'));
    ws.on('error', () => {}); // Swallow errors silently
  } catch (e) {}

<<<<<<< Updated upstream
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
=======
  // --- LIVE CHANGE LISTENER (per-file debounce, 1.5s) ---
  vscode.workspace.onDidChangeTextDocument((event: vscode.TextDocumentChangeEvent) => {
    const filePath = event.document.fileName;
    const project = getProject();
>>>>>>> Stashed changes

    // Filter noise
    if (
      filePath.includes("node_modules") ||
      filePath.includes(".git") ||
      filePath.includes("dist/") ||
      filePath.includes("\\dist\\") ||
      filePath.includes("out/") ||
      event.contentChanges.length === 0
    ) return;

    // Per-file debounce — each file has its own timer
    const existing = debounceTimers.get(filePath);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      debounceTimers.delete(filePath);
      const change = event.contentChanges[0];
      let summary = "Code edited";
      if (change) {
        const lineNum = change.range.start.line;
        try {
          const lineText = event.document.lineAt(lineNum).text.trim();
          if (lineText) summary = `L${lineNum + 1}: ${lineText.substring(0, 60)}`;
        } catch (e) {}
      }

      eventQueue.push({
        type: "file:change",
        filePath,
        language: event.document.languageId,
        project,
        timestamp: Date.now(),
        diff: summary
      });
      console.log("[ContextSwitch] Queued file:change for", filePath.split(/[\\/]/).pop());
    }, 1500);

    debounceTimers.set(filePath, timer);
  });

<<<<<<< Updated upstream
  // --- 4. GIT ACTIVITY (ON SAVE, batched) ---
  vscode.workspace.onDidSaveTextDocument((doc) => {
    console.log("File saved:", doc.fileName);
    // Smart file filtering
=======
  // --- SAVE LISTENER ---
  vscode.workspace.onDidSaveTextDocument((doc: vscode.TextDocument) => {
    const filePath = doc.fileName;
    const project = getProject();

>>>>>>> Stashed changes
    if (
      filePath.includes("node_modules") ||
      filePath.includes(".git") ||
      filePath.includes("dist/") ||
      filePath.includes("\\dist\\")
    ) return;

    // Cancel any pending change debounce for this file (save supersedes it)
    const pending = debounceTimers.get(filePath);
    if (pending) {
      clearTimeout(pending);
      debounceTimers.delete(filePath);
    }
<<<<<<< Updated upstream
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
=======

    // Per-file dedup for rapid saves
    const lastSave = lastSaveTimes.get(filePath) || 0;
    if (Date.now() - lastSave < 1000) return;
    lastSaveTimes.set(filePath, Date.now());

    // Capture git context (best effort, non-blocking)
    let gitBranch = "";
    try {
      const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (cwd) gitBranch = execSync('git rev-parse --abbrev-ref HEAD', { cwd, timeout: 1000 }).toString().trim();
    } catch (e) {}

    eventQueue.push({
      type: "file:save",
      filePath,
      language: doc.languageId,
      project,
      timestamp: Date.now(),
      diff: "File saved",
      gitBranch: gitBranch || undefined
    });
    console.log("[ContextSwitch] Queued file:save for", filePath.split(/[\\/]/).pop());
  });

  // --- DIAGNOSTIC ERRORS ---
  vscode.languages.onDidChangeDiagnostics((e: vscode.DiagnosticChangeEvent) => {
    const project = getProject();
    e.uris.forEach((uri: vscode.Uri) => {
      if (uri.fsPath.includes("node_modules")) return;
      const diagnostics = vscode.languages.getDiagnostics(uri);
      diagnostics.forEach((diag: vscode.Diagnostic) => {
        if (diag.severity === vscode.DiagnosticSeverity.Error) {
          eventQueue.push({
            type: "diagnostic:error",
            filePath: uri.fsPath,
            project, // ← was missing before, caused silent drop
            diff: diag.message,
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
        project: getProject(), // ← was missing before
        diff: e.execution?.commandLine?.value || "command run",
        timestamp: Date.now()
      });
    });
  }

  // --- BATCH SENDER (HTTP, every 3s) ---
  setInterval(async () => {
    if (eventQueue.length === 0) return;
    const batch = [...eventQueue];
    eventQueue = [];
    try {
      await axios.post("http://127.0.0.1:3001/session/events/ingest", { events: batch });
      console.log(`[ContextSwitch] Ingested ${batch.length} events`);
    } catch (e: any) {
      console.error("[ContextSwitch] Ingest failed, re-queuing:", e.message);
      eventQueue = [...batch, ...eventQueue]; // Re-queue on failure
    }
  }, 3000);

  // --- COMMANDS ---
  context.subscriptions.push(
    vscode.commands.registerCommand('contextswitch.runOpenClaw', async () => {
      const project = getProject();
      vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: "OpenClaw: Analyzing...", cancellable: false }, async () => {
        try {
          const response = await axios.get(`http://127.0.0.1:3001/reconstruct/${project}?queryType=handoff`);
          const panel = vscode.window.createWebviewPanel('openClawView', 'OpenClaw Analysis', vscode.ViewColumn.Beside, { enableScripts: true });
          panel.webview.html = getOpenClawHtml(response.data);
        } catch {
          vscode.window.showErrorMessage("OpenClaw connection failed. Is the backend running?");
        }
      });
    }),
    vscode.commands.registerCommand("contextswitch.openSidebar", async () => {
      await vscode.commands.executeCommand("workbench.view.extension.contextswitch");
    })
  );
>>>>>>> Stashed changes
}

export function deactivate() {
  const project = getProject();
  console.log("[ContextSwitch] Deactivating, ending session for:", project);
  try {
<<<<<<< Updated upstream
    execSync(`node -e "const h=require('http');const d=JSON.stringify({project:'${projectName}'});const r=h.request({hostname:'localhost',port:3001,path:'/session/end-by-project',method:'POST',headers:{'Content-Type':'application/json','Content-Length':d.length}});r.write(d);r.end();"`, { timeout: 2000 });
  } catch (e) {
    // swallow errors — best effort cleanup
  }
}
=======
    execSync(
      `node -e "const h=require('http');const d=JSON.stringify({project:'${project}'});const r=h.request({hostname:'127.0.0.1',port:3001,path:'/session/end-by-project',method:'POST',headers:{'Content-Type':'application/json','Content-Length':d.length}});r.write(d);r.end();"`,
      { timeout: 2000 }
    );
  } catch (e) {}
}

function getOpenClawHtml(data: any) {
  const nextStepsHtml = data.next_steps
    ? data.next_steps.map((s: string) => `<li>${s}</li>`).join('')
    : '';
  return `<!DOCTYPE html><html><head><style>
    body{font-family:var(--vscode-font-family);padding:20px;line-height:1.6}
    .confidence{color:var(--vscode-testing-iconPassed);font-weight:bold}
    .card{background:var(--vscode-editorWidget-background);padding:15px;border-radius:6px;border:1px solid var(--vscode-widget-border);margin-bottom:20px}
    h2{color:var(--vscode-textLink-foreground)}
  </style></head><body>
    <h1>OpenClaw Intelligence</h1>
    <p class="confidence">Confidence: ${data.confidence}%</p>
    <div class="card"><h2>Context Brief</h2><p>${data.brief}</p></div>
    <div class="card"><h2>Next Steps</h2><ul>${nextStepsHtml}</ul></div>
  </body></html>`;
}
>>>>>>> Stashed changes
