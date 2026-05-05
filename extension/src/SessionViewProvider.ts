import * as vscode from "vscode";
import fetch from "node-fetch";

export class SessionViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "sessionView";
  private _view?: vscode.WebviewView;
  private _interval?: NodeJS.Timeout;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  resolveWebviewView(webviewView: vscode.WebviewView) {
    this._view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = this.getHtml();
    this.startFetching();

    // Listen for messages from the webview (Chat)
    webviewView.webview.onDidReceiveMessage(async (msg) => {
      if (msg.type === "ASK_OPENCLAW") {
        try {
          const res = await fetch("http://localhost:3001/ask", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ projectId: "vaibhav-test-project", question: msg.question })
          });
          const data = await res.json();
          webviewView.webview.postMessage({ type: "ASK_RESPONSE", answer: data.answer });
        } catch (e: any) {
          webviewView.webview.postMessage({ type: "ASK_RESPONSE", answer: "Error: Could not connect to OpenClaw backend." });
        }
      }
    });

    webviewView.onDidDispose(() => this.stopFetching());
  }

  private startFetching() {
    this.stopFetching();
    this._interval = setInterval(() => this.fetchAndUpdate(), 4000);
    this.fetchAndUpdate();
  }

  private stopFetching() {
    if (this._interval) clearInterval(this._interval);
  }

  private async fetchAndUpdate() {
    if (!this._view) return;
    try {
      const res = await fetch("http://localhost:3001/debug/session");
      const data = await res.json();
      this._view.webview.postMessage({ type: "SESSION_UPDATE", data });
    } catch (e) {
      this._view.webview.postMessage({ type: "SESSION_UPDATE", data: { error: true } });
    }
  }

  private getHtml() {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <style>
          body { font-family: var(--vscode-font-family); margin: 0; padding: 12px; font-size: 13px; }
          .section { margin-bottom: 20px; }
          .title { font-weight: bold; margin-bottom: 8px; opacity: 0.8; text-transform: uppercase; font-size: 11px; }
          .event { margin-bottom: 6px; padding: 4px; background: rgba(128,128,128,0.1); border-radius: 4px; }
          .type { font-weight: bold; margin-right: 6px; font-size: 10px; }
          .FILE_CHANGE { color: #2563eb; }
          .ERROR { color: #dc2626; }
          .TERMINAL { color: #16a34a; }
          .GIT { color: #9333ea; }
          .meta { color: #888; font-size: 10px; display: block; margin-top: 2px; }
          
          /* Chat Styles */
          #chat-container { border-top: 1px solid rgba(128,128,128,0.3); padding-top: 12px; }
          #chat-input { width: 100%; box-sizing: border-box; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); padding: 6px; border-radius: 4px; margin-bottom: 8px; }
          #ask-btn { width: 100%; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 6px; cursor: pointer; border-radius: 4px; }
          #ask-btn:hover { background: var(--vscode-button-hoverBackground); }
          #answer { margin-top: 12px; padding: 8px; background: rgba(37, 99, 235, 0.1); border-left: 2px solid #2563eb; border-radius: 4px; display: none; line-height: 1.4; }
        </style>
      </head>
      <body>
        <div class="section">
          <div class="title">Active Session</div>
          <div id="session"></div>
        </div>

        <div id="chat-container" class="section">
          <div class="title">Ask OpenClaw</div>
          <input type="text" id="chat-input" placeholder="e.g. What is the auth error?" />
          <button id="ask-btn">Search History</button>
          <div id="answer"></div>
        </div>

        <script>
          const vscode = acquireVsCodeApi();
          const chatInput = document.getElementById('chat-input');
          const askBtn = document.getElementById('ask-btn');
          const answerDiv = document.getElementById('answer');

          askBtn.addEventListener('click', () => {
            const question = chatInput.value;
            if (!question) return;
            answerDiv.style.display = 'block';
            answerDiv.innerHTML = '<i>Searching history...</i>';
            vscode.postMessage({ type: 'ASK_OPENCLAW', question });
          });

          chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') askBtn.click();
          });

          function formatTime(ts) {
            if (!ts) return '';
            const d = new Date(ts);
            return d.toLocaleTimeString('en-US', { hour12: false });
          }

          function render(data) {
            const root = document.getElementById('session');
            if (!data || data.error) {
              root.innerHTML = '<div style="color:#888">Could not load session</div>';
              return;
            }
            if (data.message) {
              root.innerHTML = '<div style="color:#888">No active session</div>';
              return;
            }
            let html = '';
            html += '<div><b>ID:</b> ' + data.sessionId + ' | ' + (data.events?.length || 0) + ' events</div>';
            
            if (!data.events || data.events.length === 0) {
              html += '<div style="color:#888; margin-top:8px;">No activity yet</div>';
            } else {
              html += '<div style="margin-top:8px; max-height: 300px; overflow-y: auto;">';
              for (let i = data.events.length - 1; i >= 0; i--) {
                const ev = data.events[i];
                html += '<div class="event">' +
                  '<span class="type ' + ev.type + '">[' + ev.type + ']</span> ' +
                  (ev.message || ev.diff || '') +
                  '<span class="meta">' + formatTime(ev.timestamp) + '</span>' +
                  '</div>';
              }
              html += '</div>';
            }
            root.innerHTML = html;
          }

          window.addEventListener('message', (event) => {
            const { type, data, answer } = event.data;
            if (type === 'SESSION_UPDATE') render(data);
            if (type === 'ASK_RESPONSE') {
              answerDiv.style.display = 'block';
              answerDiv.innerText = answer;
            }
          });
        </script>
      </body>
      </html>
    `;
  }
}
