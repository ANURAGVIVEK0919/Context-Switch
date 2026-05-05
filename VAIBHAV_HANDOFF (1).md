# Handoff & Next Steps for Vaibhav (P1 - Capture Layer)

Hey Vaibhav, 

Chitranshu (P3) and Anurag (P2) have finalized the backend and frontend for the ContextSwitch dashboard. The AI synthesis, session auto-summarization, and UI are completely wired up and working. 

To make the AI summaries truly powerful, we need to send **richer context** from the VS Code extension. Right now, the extension only sends basic `file:change` and `git:activity` events. We need you to add a few more event types to the extension's WebSocket payload.

Here is exactly what you need to implement in `extension/src/extension.ts`.

---

## 1. Implement Richer Context Events

The backend `wsServer.ts` is already updated and waiting for these new event types. You just need to capture them in the extension and push them to the `eventQueue`.

### A. Git Commit Event (`git:commit`)
Instead of just sending `git:activity` on save, try to capture actual commits if possible, or enhance the save event.
**Payload Contract:**
```javascript
{
  type: "git:commit",
  filePath: "workspace", // or specific file
  message: "fix: null pointer in auth.ts", // Try to grab from git log if possible
  branch: "feature/login",
  timestamp: Date.now()
}
```

### B. Diagnostic Errors (`diagnostic:error`)
We want the AI to know what errors the developer is seeing in the IDE (the red squiggles).
**How to capture:** Use `vscode.languages.onDidChangeDiagnostics`
**Payload Contract:**
```javascript
{
  type: "diagnostic:error",
  filePath: "/src/auth.ts",
  diff: "Cannot read property 'id' of undefined", // The error message
  severity: "error",
  timestamp: Date.now()
}
```

### C. Terminal Commands (`terminal:command`)
Capture what commands the developer is running.
**How to capture:** Hook into `vscode.window.onDidCloseTerminal` or similar terminal APIs.
**Payload Contract:**
```javascript
{
  type: "terminal:command",
  filePath: "terminal", 
  diff: "npm run dev", // The command executed
  timestamp: Date.now()
}
```

### D. File Open Event (`file:open`)
When a developer opens a file to read it.
**How to capture:** `vscode.workspace.onDidOpenTextDocument`
**Payload Contract:**
```javascript
{
  type: "file:change", // You can reuse file:change but note it was opened
  filePath: doc.fileName,
  language: doc.languageId,
  diff: "Opened file for reading",
  timestamp: Date.now()
}
```

---

## 2. Integration with OpenClaw (AI Layer)

OpenClaw is the underlying AI reconstruction engine that we've built on the backend. Your goal for this integration is to bring the power of OpenClaw **directly into the IDE** so developers don't have to leave VS Code to get an AI analysis of their work.

We have exposed a dedicated REST endpoint for OpenClaw:
`GET http://localhost:3001/reconstruct/${projectName}?queryType=handoff` (or `context` / `staleness`)

### How you need to integrate this into the Extension:

**Step 1: Register the VS Code Command**
Add a new command to your `package.json` under `contributes.commands`. For example, `contextswitch.runOpenClaw`.

**Step 2: Create a Custom Webview Panel**
When the user runs the command, do NOT just show a basic popup. We want a rich sidebar or full editor panel.
You will use `vscode.window.createWebviewPanel` to open a tab titled "OpenClaw Analysis".

**Step 3: Fetch Data & Render**
The endpoint returns a structured JSON object containing:
- `brief`: The main AI summary.
- `confidence`: An integer 0-100 indicating AI confidence.
- `next_steps`: An array of actionable steps.
- `context_sources`: Shows how many files, errors, and terminal logs were analyzed.

You need to inject this JSON data into an HTML template inside your Webview.

**Detailed Implementation Example:**

```typescript
import * as vscode from 'vscode';
import fetch from 'node-fetch'; // Make sure you have this dependency

export function activate(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand('contextswitch.runOpenClaw', async () => {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage("No workspace open.");
            return;
        }
        
        const projectName = workspaceFolders[0].name;

        // 1. Show a loading progress indicator
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "OpenClaw: Analyzing workspace context...",
            cancellable: false
        }, async (progress) => {
            try {
                // 2. Call the OpenClaw backend
                const response = await fetch(\`http://localhost:3001/reconstruct/\${projectName}?queryType=handoff\`);
                const data = await response.json();

                // 3. Create the Webview Panel
                const panel = vscode.window.createWebviewPanel(
                    'openClawView',
                    'OpenClaw Analysis',
                    vscode.ViewColumn.Beside, // Open split screen
                    { enableScripts: true }
                );

                // 4. Build a rich HTML UI with the returned data
                panel.webview.html = getWebviewContent(data);

            } catch (error) {
                vscode.window.showErrorMessage("OpenClaw connection failed. Is the backend running?");
            }
        });
    });

    context.subscriptions.push(disposable);
}

// Helper function to generate nice HTML
function getWebviewContent(data: any) {
    const nextStepsHtml = data.next_steps 
        ? data.next_steps.map((step: string) => \`<li>\${step}</li>\`).join('') 
        : '';

    return \`
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
            <p class="confidence">Confidence Score: \${data.confidence}%</p>
            
            <div class="card">
                <h2>Context Brief</h2>
                <p>\${data.brief}</p>
            </div>

            <div class="card">
                <h2>Recommended Next Steps</h2>
                <ul>\${nextStepsHtml}</ul>
            </div>
        </body>
        </html>
    \`;
}
```

### Expected Flow:
1. Developer runs `ContextSwitch: Run OpenClaw` via `Ctrl+Shift+P`.
2. A split-screen panel opens.
3. The extension fetches the live AI analysis from our backend and renders a clean, VS Code-native looking report.

---

### Summary of Backend Status
- The backend SQLite database (`events` table) is already migrated to support `severity` for your diagnostic events.
- The `wsServer.ts` is fully equipped to ingest all these events. 
- Auto-summarization happens seamlessly when `POST /session/end` is called (which your extension already does on deactivate).

Once you add these event listeners to `extension.ts`, the AI will immediately start producing much higher-quality, deeply contextual summaries. Let us know when it's ready for a full end-to-end test!
