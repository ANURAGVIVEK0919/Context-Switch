import * as vscode from "vscode";
import axios from "axios";
import { SessionViewProvider } from "./SessionViewProvider";

let eventQueue: any[] = [];
let sessionStarted = false;
// Temporarily store changes until save
const changeAggregator = new Map<string, {added: string[], removed: string[]}>();

export async function activate(context: vscode.ExtensionContext) {
  console.log("[ContextSwitch] Activating...");

  const sessionViewProvider = new SessionViewProvider(context.extensionUri, context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(SessionViewProvider.viewType, sessionViewProvider)
  );

  const getProject = () => vscode.workspace.workspaceFolders?.[0]?.name || "unknown";

  const startSession = async () => {
    const token = await context.secrets.get("contextswitch.token");
    if (!token) return;
    try {
      await axios.post("http://localhost:3001/session/start", {
        project: getProject()
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      sessionStarted = true;
      console.log("[ContextSwitch] Session Started");
    } catch (e) {
      console.error("[ContextSwitch] Failed to start session");
    }
  };

  const syncNow = async () => {
    if (eventQueue.length === 0) return;
    const token = await context.secrets.get("contextswitch.token");
    if (!token) return;

    // Auto-start if not started
    if (!sessionStarted) await startSession();

    const batch = [...eventQueue];
    eventQueue = [];

    try {
      await axios.post("http://localhost:3001/session/ingest", 
        { events: batch },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log(`[ContextSwitch] Synced ${batch.length} events to server`);
    } catch (e: any) {
      console.error("[ContextSwitch] Sync error, re-queuing...");
      eventQueue = [...batch, ...eventQueue];
    }
  };

  // --- Aggregate changes in memory (No network, no sidebar update yet) ---
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      const filePath = event.document.uri.fsPath;
      if (event.contentChanges.length === 0 || filePath.includes(".git")) return;

      if (!changeAggregator.has(filePath)) {
        changeAggregator.set(filePath, {added: [], removed: []});
      }

      const store = changeAggregator.get(filePath)!;
      event.contentChanges.forEach(change => {
        if (change.text) {
          store.added.push(change.text);
        } else if (change.rangeLength > 0) {
          store.removed.push("(removed text)");
        }
      });
    })
  );

  // --- Push single card ONLY on Save ---
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((doc) => {
      const filePath = doc.uri.fsPath;
      const store = changeAggregator.get(filePath);
      
      if (!store || (store.added.length === 0 && store.removed.length === 0)) {
         // Still push a save event even if no text changed (e.g. formatting)
         eventQueue.push({
            type: "file:save",
            filePath,
            language: doc.languageId,
            project: getProject(),
            timestamp: Date.now(),
            diff: "File saved (no significant text changes)"
         });
      } else {
          const addedText = store.added.join("").substring(0, 200);
          const diffSummary = `Added: ${addedText}${store.removed.length > 0 ? ` | Removed: ${store.removed.length} snippets` : ""}`;
          
          eventQueue.push({
            type: "file:save",
            filePath,
            language: doc.languageId,
            project: getProject(),
            timestamp: Date.now(),
            diff: diffSummary
          });
      }

      // Reset for next save
      changeAggregator.delete(filePath);
      syncNow(); 
    })
  );

  // --- Periodic sync for background tasks ---
  setInterval(syncNow, 10000); 
}

export function deactivate() {}
