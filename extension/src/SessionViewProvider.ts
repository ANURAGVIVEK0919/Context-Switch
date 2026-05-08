import * as vscode from "vscode";
import axios from "axios";

export class SessionViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "sessionView";
  private _view?: vscode.WebviewView;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _context: vscode.ExtensionContext
  ) { }

  resolveWebviewView(webviewView: vscode.WebviewView) {
    this._view = webviewView;
    webviewView.webview.options = { enableScripts: true };

    webviewView.webview.onDidReceiveMessage(async (msg) => {
      const token = await this._context.secrets.get("contextswitch.token");
      
      if (msg.type === "READY") {
        if (token) this.fetchAndUpdate(token);
        else webviewView.webview.postMessage({ type: "AUTH_REQUIRED" });
      }
      
      if (msg.type === "LOGIN") {
        try {
          const res = await axios.post("http://localhost:3001/auth/login", { email: msg.email, password: msg.password });
          await this._context.secrets.store("contextswitch.token", res.data.token);
          this.fetchAndUpdate(res.data.token);
        } catch (e: any) {
          webviewView.webview.postMessage({ type: "LOGIN_ERROR", error: e.response?.data?.error || "Login failed" });
        }
      }

      if (msg.type === "LOGOUT") {
        await this._context.secrets.delete("contextswitch.token");
        webviewView.webview.postMessage({ type: "AUTH_REQUIRED" });
      }

      if (msg.type === "REFRESH") {
        if (token) this.fetchAndUpdate(token);
      }

      if (msg.type === "END_SESSION") {
        try {
          const project = vscode.workspace.workspaceFolders?.[0]?.name || "unknown";
          await axios.post("http://localhost:3001/session/end-by-project", { project }, {
            headers: { Authorization: `Bearer ${token}` }
          });
          vscode.window.showInformationMessage("✅ Session ended. AI summary generated.");
          setTimeout(() => this.fetchAndUpdate(token || ""), 1000);
        } catch (e) {
          vscode.window.showErrorMessage("Failed to end session.");
        }
      }
    });

    webviewView.webview.html = this.getHtml();
  }

  private async fetchAndUpdate(token: string) {
    if (!this._view) return;
    try {
      const res = await axios.get(`http://localhost:3001/session/debug/session`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      this._view.webview.postMessage({ type: "SESSION_UPDATE", data: res.data, token });
    } catch (e) {
      console.error("[SessionViewProvider] Fetch failed");
    }
  }

  private getHtml() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    :root {
      --bg: var(--vscode-sideBar-background);
      --surface: var(--vscode-editor-background);
      --accent: #2dd4bf;
      --text: var(--vscode-sideBar-foreground);
      --text-dim: var(--vscode-descriptionForeground);
      --border: var(--vscode-panel-border);
    }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: var(--bg); color: var(--text); padding: 12px; font-size: 12px; margin: 0; }
    .status-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 12px; margin-bottom: 16px; }
    .status-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
    .indicator { display: flex; align-items: center; gap: 8px; font-weight: 700; }
    .pulse { width: 8px; height: 8px; border-radius: 50%; background: #555; }
    .pulse.active { background: var(--accent); box-shadow: 0 0 10px var(--accent); animation: pulse 2s infinite; }
    @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.4; } 100% { opacity: 1; } }
    
    .timeline { display: flex; flex-direction: column; gap: 8px; }
    .tl-item { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; transition: all 0.2s ease; }
    .tl-header { padding: 10px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; }
    .tl-header:hover { background: rgba(255,255,255,0.03); }
    .tl-title { font-weight: 700; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px; }
    .tl-meta { font-size: 9px; color: var(--text-dim); }
    
    .tl-content { display: none; padding: 0 10px 10px 10px; border-top: 1px solid var(--border); background: rgba(0,0,0,0.1); }
    .tl-item.expanded .tl-content { display: block; }
    .diff-box { font-family: 'JetBrains Mono', 'Courier New', monospace; font-size: 10px; color: var(--accent); white-space: pre-wrap; word-break: break-all; margin-top: 8px; }
    
    .btn { background: var(--accent); color: #000; border: none; padding: 8px; border-radius: 6px; width: 100%; cursor: pointer; font-weight: 700; margin-top: 8px; font-size: 11px; }
    .btn-ghost { background: transparent; border: 1px solid var(--border); color: var(--text); }
    input { width: 100%; background: var(--surface); color: var(--text); border: 1px solid var(--border); padding: 8px; border-radius: 4px; margin-bottom: 8px; box-sizing: border-box; }
    
    #auth-view, #main-view { display: none; }
    .visible { display: block !important; }
  </style>
</head>
<body>
  <div id="auth-view">
    <h3 style="color:var(--accent); margin-top:0">Welcome</h3>
    <p style="color:var(--text-dim)">Sign in to sync your context.</p>
    <input type="email" id="email" value="admin@example.com" placeholder="Email">
    <input type="password" id="password" value="admin123" placeholder="Password">
    <button class="btn" onclick="login()">Sign In</button>
  </div>

  <div id="main-view">
    <div class="status-card">
      <div class="status-header">
        <div class="indicator">
          <div id="pulse-dot" class="pulse"></div>
          <span id="status-label">Ready</span>
        </div>
        <span style="font-size:9px; color:var(--text-dim); cursor:pointer" onclick="logout()">Sign Out</span>
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px">
        <div style="text-align:center"><div id="stat-saves" style="font-size:18px; font-weight:700">0</div><div style="font-size:9px; color:var(--text-dim)">Saves</div></div>
        <div style="text-align:center"><div id="stat-files" style="font-size:18px; font-weight:700">0</div><div style="font-size:9px; color:var(--text-dim)">Files</div></div>
      </div>
    </div>

    <div id="summary-box" class="status-card" style="display:none; border-color:var(--accent); background:rgba(45,212,191,0.05)">
      <div style="font-size:10px; font-weight:700; color:var(--accent); margin-bottom:4px">SESSION SUMMARY</div>
      <div id="summary-text" style="font-size:11px; line-height:1.4"></div>
    </div>

    <button class="btn" onclick="endSession()">End & Summarize</button>
    <button class="btn btn-ghost" onclick="refresh()">Refresh Feed</button>

    <div class="timeline" id="timeline"></div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    let socket;

    function login() {
      vscode.postMessage({ type: 'LOGIN', email: document.getElementById('email').value, password: document.getElementById('password').value });
    }
    function logout() { vscode.postMessage({ type: 'LOGOUT' }); }
    function endSession() { vscode.postMessage({ type: 'END_SESSION' }); }
    function refresh() { vscode.postMessage({ type: 'REFRESH' }); }

    function toggleExpand(el) {
      el.closest('.tl-item').classList.toggle('expanded');
    }

    function connectWS(token) {
      if (socket) socket.close();
      socket = new WebSocket('ws://localhost:3002');
      socket.onopen = () => socket.send(JSON.stringify({ type: 'auth', token }));
      socket.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === 'events_updated' || msg.type === 'session_summary_ready') {
          vscode.postMessage({ type: 'REFRESH' });
        }
      };
      socket.onclose = () => setTimeout(() => connectWS(token), 3000);
    }

    window.addEventListener('message', event => {
      const msg = event.data;
      if (msg.type === 'AUTH_REQUIRED') {
        document.getElementById('auth-view').className = 'visible';
        document.getElementById('main-view').className = '';
      }
      if (msg.type === 'SESSION_UPDATE') {
        document.getElementById('auth-view').className = '';
        document.getElementById('main-view').className = 'visible';
        
        const d = msg.data;
        document.getElementById('status-label').innerText = d.status === 'active' ? (d.project || 'Tracking') : 'Idle';
        document.getElementById('pulse-dot').className = d.status === 'active' ? 'pulse active' : 'pulse';
        
        const summaryBox = document.getElementById('summary-box');
        if (d.ai_summary) {
          summaryBox.style.display = 'block';
          document.getElementById('summary-text').innerText = d.ai_summary;
        } else {
          summaryBox.style.display = 'none';
        }

        const events = d.events || [];
        document.getElementById('stat-saves').innerText = events.filter(e => e.type === 'file:save').length;
        document.getElementById('stat-files').innerText = new Set(events.map(e => e.filePath)).size;

        document.getElementById('timeline').innerHTML = events.map(ev => {
          const file = ev.filePath ? ev.filePath.split(/[\\\\/]/).pop() : 'Task';
          const time = new Date(ev.ts).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', second:'2-digit'});
          const diffHtml = ev.diff ? '<div class="diff-box">' + ev.diff + '</div>' : '<div class="diff-box" style="color:var(--text-dim)">No diff available</div>';
          
          return \`
            <div class="tl-item">
              <div class="tl-header" onclick="toggleExpand(this)">
                <div>
                  <div class="tl-title">\${file}</div>
                  <div class="tl-meta">\${ev.type} • \${time}</div>
                </div>
                <div style="font-size:14px; color:var(--text-dim)">+</div>
              </div>
              <div class="tl-content">
                \${diffHtml}
              </div>
            </div>
          \`;
        }).join('') || '<div style="text-align:center; padding:20px; color:var(--text-dim)">No activity yet</div>';

        if (msg.token && (!socket || socket.readyState !== WebSocket.OPEN)) {
          connectWS(msg.token);
        }
      }
    });

    vscode.postMessage({ type: 'READY' });
  </script>
</body>
</html>`;
  }
}
