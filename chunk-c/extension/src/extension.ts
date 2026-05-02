
import fetch from "node-fetch";
import * as vscode from "vscode";
import WebSocket from "ws";



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
    fetch("http://localhost:3001/session/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project: vscode.workspace.workspaceFolders?.[0]?.name || "unknown",
        timestamp: Date.now()
      })
    })
      .then(() => {
        console.log("Session started");
      })
      .catch((err) => {
        console.error("Session start failed:", err);
      });
  }

  // Connect WebSocket
  ws = new WebSocket("ws://localhost:3002");

  ws.onopen = () => {
    console.log("WS connected");
  };

  // --- 3. FILE CHANGE LISTENER (debounced, deduped, filtered, batched) ---
  vscode.workspace.onDidChangeTextDocument((event) => {
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
        timestamp: Date.now()
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
      console.log("Sending batch:", eventQueue.length);
      ws.send(
        JSON.stringify({
          type: "batch",
          events: eventQueue
        })
      );
      console.log("Batch sent:", eventQueue.length);
      eventQueue = [];
    }
  }, 2000);
}


// --- 5. DEACTIVATE FUNCTION ---
export function deactivate() {
  console.log("Extension deactivated");
  fetch("http://localhost:3001/session/end", {
    method: "POST"
  })
    .then(() => {
      console.log("Session ended");
    })
    .catch((err) => {
      console.error("Session end failed:", err);
    });
}