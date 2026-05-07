import * as vscode from "vscode";
import axios from "axios";

export class SessionViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "sessionView";
  private _view?: vscode.WebviewView;
  private _interval?: NodeJS.Timeout;

  constructor(private readonly _extensionUri: vscode.Uri) { }

  resolveWebviewView(webviewView: vscode.WebviewView) {
    this._view = webviewView;
    webviewView.webview.options = { enableScripts: true };

    webviewView.webview.onDidReceiveMessage(async (msg) => {
      if (msg.type === "DEBUG") console.log("[Webview Debug]", msg.text);
      switch (msg.type) {
        case "READY":
          console.log("[ContextSwitch] Received READY from webview");
          this.fetchAndUpdate();
          break;

        case "ASK_OPENCLAW":
          try {
            const res = await axios.post("http://127.0.0.1:3001/ask", { projectId: msg.project || "unknown", question: msg.question });
            webviewView.webview.postMessage({ type: "ASK_RESPONSE", answer: res.data.answer });
          } catch (e) {
            webviewView.webview.postMessage({ type: "ASK_RESPONSE", answer: "Error connecting to AI backend." });
          }
          break;

        case "SAVE_BRAINDUMP":
          try {
            await axios.post("http://127.0.0.1:3001/braindump", { content: msg.content, sessionId: msg.sessionId, project: msg.project });
            const recent = await axios.get("http://127.0.0.1:3001/braindump?limit=3");
            webviewView.webview.postMessage({ type: "BRAINDUMP_SAVED", braindumps: recent.data.braindumps });
            vscode.window.showInformationMessage("💡 Brain dump saved!");
          } catch (e) {
            vscode.window.showErrorMessage("Failed to save brain dump.");
          }
          break;

        case "END_SESSION":
          try {
            await axios.post("http://127.0.0.1:3001/session/end-by-project", { project: msg.project });
            vscode.window.showInformationMessage("✅ Session ended. AI summary generating...");
            this.fetchAndUpdate();
          } catch (e) {
            vscode.window.showErrorMessage("Failed to end session.");
          }
          break;

        case "OPEN_DASHBOARD":
          vscode.env.openExternal(vscode.Uri.parse("http://127.0.0.1:5173/sessions"));
          break;

        case "COPY_PATH":
          vscode.env.clipboard.writeText(msg.path);
          vscode.window.showInformationMessage(`Copied: ${msg.path.split(/[\\/]/).pop()}`);
          break;

        case "FETCH_BRAINDUMPS":
          try {
            const res = await axios.get("http://127.0.0.1:3001/braindump?limit=3");
            webviewView.webview.postMessage({ type: "BRAINDUMP_SAVED", braindumps: res.data.braindumps });
          } catch (e) {}
          break;
      }
    });

    webviewView.onDidDispose(() => this.stopFetching());

    webviewView.webview.html = this.getHtml();
    this.startFetching();
  }

  private startFetching() {
    this.stopFetching();
    console.log("[ContextSwitch] startFetching called");
    this._interval = setInterval(() => this.fetchAndUpdate(), 5000);
    setTimeout(() => this.fetchAndUpdate(), 800);
  }

  private stopFetching() {
    if (this._interval) clearInterval(this._interval);
  }

  private async fetchAndUpdate() {
    if (!this._view) {
      console.log("[ContextSwitch] fetchAndUpdate: _view is missing");
      return;
    }
    try {
      const project = vscode.workspace.workspaceFolders?.[0]?.name || "unknown";
      console.log("[ContextSwitch] Fetching from backend for project:", project);
      const res = await axios.get(`http://127.0.0.1:3001/session/debug/session?project=${encodeURIComponent(project)}&t=${Date.now()}`);
      console.log("[ContextSwitch] Fetched session:", res.data.sessionId);
      this._view.webview.postMessage({ type: "SESSION_UPDATE", data: res.data });
      console.log("[ContextSwitch] postMessage sent");
    } catch (e: any) {
      console.log("[ContextSwitch] Fetch error:", e.message);
      this._view.webview.postMessage({ type: "SESSION_UPDATE", data: { error: true } });
    }
  }

  private getHtml() {
    const nonce = this.getNonce();
    const langColors: Record<string, string> = {};
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'nonce-${nonce}';">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: var(--vscode-sideBar-background);
      --surface: var(--vscode-editor-background);
      --surface-hover: var(--vscode-list-hoverBackground);
      --accent: #2dd4bf;
      --accent-dim: rgba(45,212,191,0.15);
      --text: var(--vscode-sideBar-foreground);
      --text-dim: var(--vscode-descriptionForeground);
      --border: var(--vscode-panel-border);
      --danger: #ef4444;
      --input-bg: var(--vscode-input-background);
    }
    * { box-sizing: border-box; }
    body { font-family: 'Inter', sans-serif; margin: 0; padding: 10px; background: var(--bg); color: var(--text); font-size: 12px; }

    /* Status bar */
    .status-bar { display: flex; align-items: center; gap: 6px; margin-bottom: 12px; padding: 6px 10px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; }
    .pulse { width: 7px; height: 7px; border-radius: 50%; background: #ef4444; flex-shrink: 0; }
    .pulse.online { background: var(--accent); box-shadow: 0 0 6px var(--accent); animation: blink 2s infinite; }
    @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.4} }
    .status-text { flex: 1; font-size: 10px; color: var(--text-dim); }
    .status-time { font-size: 9px; color: var(--text-dim); font-family: 'JetBrains Mono'; }

    /* Stats */
    .stats-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-bottom: 12px; }
    .stat { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 8px 4px; text-align: center; }
    .stat-val { font-size: 14px; font-weight: 700; color: var(--accent); }
    .stat-lbl { font-size: 9px; color: var(--text-dim); text-transform: uppercase; margin-top: 2px; }

    /* Section */
    .section { margin-bottom: 14px; }
    .sec-hdr { display: flex; align-items: center; justify-content: space-between; margin-bottom: 7px; }
    .sec-title { font-size: 9px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--text-dim); }
    .badge { background: var(--accent-dim); color: var(--accent); padding: 2px 7px; border-radius: 5px; font-size: 9px; font-weight: 700; }
    .badge.offline { background: rgba(255,255,255,.05); color: gray; }

    /* Timeline */
    .card { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
    .timeline { max-height: 240px; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 10px; }
    .tl-item { display: flex; gap: 8px; position: relative; cursor: pointer; }
    .tl-item:not(:last-child)::after { content:''; position: absolute; left: 5px; top: 13px; bottom: -10px; width: 1px; background: var(--border); }
    .dot { width: 11px; height: 11px; border-radius: 50%; border: 2px solid var(--border); background: var(--surface); flex-shrink: 0; z-index: 1; margin-top: 2px; }
    .dot.save { border-color: var(--accent); background: var(--accent); box-shadow: 0 0 6px var(--accent); }
    .dot.change { width: 7px; height: 7px; margin: 4px 0 0 2px; border-color: var(--accent); }
    .dot.error { border-color: #ef4444; background: #ef4444; }
    .dot.git { border-color: #9333ea; }
    .dot.terminal { border-color: #f59e0b; }
    .tl-body { flex: 1; min-width: 0; }
    .tl-top { display: flex; justify-content: space-between; align-items: center; }
    .tl-name { font-size: 11px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; }
    .tl-time { font-size: 9px; color: var(--text-dim); flex-shrink: 0; margin-left: 4px; }
    .tl-meta { font-size: 9px; color: var(--text-dim); display: flex; gap: 5px; align-items: center; margin-top: 1px; }
    .lang-tag { padding: 0 4px; border-radius: 3px; font-size: 8px; font-weight: 700; }
    .tl-diff { font-size: 9px; color: var(--accent); opacity: .8; font-family: 'JetBrains Mono'; margin-top: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .card-footer { padding: 8px 10px; border-top: 1px solid var(--border); background: rgba(0,0,0,.05); }

    /* Actions */
    .action-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
    .btn { background: var(--surface); border: 1px solid var(--border); border-radius: 7px; padding: 7px; color: var(--text); font-size: 10px; font-weight: 600; cursor: pointer; transition: all .2s; }
    .btn:hover { border-color: var(--accent); color: var(--accent); }
    .btn.danger:hover { border-color: var(--danger); color: var(--danger); }

    /* End session confirm */
    .confirm-row { display: none; align-items: center; gap: 6px; margin-top: 6px; }
    .confirm-row.show { display: flex; }
    .confirm-text { font-size: 10px; color: var(--text-dim); flex: 1; }
    .btn-sm { padding: 3px 8px; border-radius: 5px; font-size: 10px; font-weight: 700; border: 1px solid var(--border); cursor: pointer; background: transparent; }
    .btn-sm.ok { border-color: var(--danger); color: var(--danger); }
    .btn-sm.ok:hover { background: var(--danger); color: #fff; }
    .btn-sm.cancel { color: var(--text-dim); }

    /* Brain dump */
    .note-box { background: var(--input-bg); border: 1px solid var(--border); border-radius: 10px; padding: 10px; }
    #note-input { width: 100%; background: transparent; border: none; color: var(--text); font-size: 11px; font-family: inherit; resize: none; outline: none; min-height: 46px; }
    .note-footer { display: flex; justify-content: flex-end; margin-top: 5px; }
    #save-note { background: var(--accent); color: #000; border: none; padding: 4px 12px; border-radius: 5px; font-size: 10px; font-weight: 700; cursor: pointer; }
    .dump-history { margin-top: 8px; display: flex; flex-direction: column; gap: 5px; }
    .dump-item { font-size: 10px; color: var(--text-dim); padding: 5px 7px; background: var(--surface); border-radius: 6px; border: 1px solid var(--border); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    /* Next steps */
    .steps-list { display: flex; flex-direction: column; gap: 5px; }
    .step-item { display: flex; gap: 7px; align-items: flex-start; padding: 6px 8px; background: var(--surface); border: 1px solid var(--border); border-radius: 7px; font-size: 10px; }
    .step-num { background: var(--accent-dim); color: var(--accent); border-radius: 3px; padding: 1px 5px; font-weight: 700; font-size: 9px; flex-shrink: 0; }

    /* AI */
    .ai-box { background: var(--input-bg); border: 1px solid var(--border); border-radius: 10px; padding: 10px; }
    #ai-input { width: 100%; background: transparent; border: none; color: var(--text); font-size: 11px; outline: none; margin-bottom: 6px; }
    #ai-btn { width: 100%; background: var(--accent-dim); color: var(--accent); border: 1px solid var(--accent); padding: 5px; border-radius: 6px; font-size: 10px; font-weight: 700; cursor: pointer; }
    #ai-response { margin-top: 8px; font-size: 10px; color: var(--text-dim); display: none; border-top: 1px solid var(--border); padding-top: 7px; }

    ::-webkit-scrollbar { width: 3px; }
    ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 10px; }
  </style>
</head>
<body>

  <!-- Status Bar -->
  <div class="status-bar">
    <div id="pulse" class="pulse"></div>
    <div id="status-text" class="status-text">Connecting...</div>
    <div id="status-time" class="status-time"></div>
  </div>

  <!-- Stats -->
  <div class="stats-row">
    <div class="stat"><div id="stat-time" class="stat-val">0m</div><div class="stat-lbl">Work</div></div>
    <div class="stat"><div id="stat-saves" class="stat-val">0</div><div class="stat-lbl">Edits</div></div>
    <div class="stat"><div id="stat-files" class="stat-val">0</div><div class="stat-lbl">Files</div></div>
  </div>

  <!-- Activity -->
  <div class="section">
    <div class="sec-hdr">
      <div class="sec-title">Current Session</div>
      <div id="session-tag" class="badge offline">OFFLINE</div>
    </div>
    <div class="card">
      <div id="timeline" class="timeline">
        <div style="text-align:center;padding:20px;color:var(--text-dim)">Waiting for events...</div>
      </div>
      <div class="card-footer">
        <div class="action-grid">
          <button class="btn" onclick="openDashboard()">📊 Dashboard</button>
          <button class="btn danger" onclick="showConfirm()">⏹ End Session</button>
        </div>
        <div id="confirm-row" class="confirm-row">
          <div class="confirm-text">End and generate AI summary?</div>
          <button class="btn-sm ok" onclick="doEndSession()">Yes</button>
          <button class="btn-sm cancel" onclick="hideConfirm()">No</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Next Steps -->
  <div class="section" id="steps-section" style="display:none">
    <div class="sec-title" style="margin-bottom:7px">▶ Pick up from last session</div>
    <div id="steps-list" class="steps-list"></div>
  </div>

  <!-- Brain Dump -->
  <div class="section">
    <div class="sec-title" style="margin-bottom:7px">💡 Quick Brain Dump</div>
    <div class="note-box">
      <textarea id="note-input" placeholder="Capture a thought, bug, or next step..."></textarea>
      <div class="note-footer"><button id="save-note" onclick="saveNote()">Save</button></div>
    </div>
    <div id="dump-history" class="dump-history"></div>
  </div>

  <!-- AI Assistant -->
  <div class="section">
    <div class="sec-title" style="margin-bottom:7px">🤖 AI Assistant</div>
    <div class="ai-box">
      <input id="ai-input" type="text" placeholder="Ask about your session..." onkeydown="if(event.key==='Enter')askAi()"/>
      <button id="ai-btn" onclick="askAi()">Analyze Context</button>
      <div id="ai-response"></div>
    </div>
  </div>

<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();
  document.getElementById('status-text').innerText = 'Script loaded, wait...';
  vscode.postMessage({ type: 'DEBUG', text: 'Webview script started' });

  let currentData = null;
  let sessionStartTs = null;
  let timerInterval = null;

  const saved = vscode.getState() || {};
  if (saved.noteDraft) document.getElementById('note-input').value = saved.noteDraft;

  document.getElementById('note-input').addEventListener('input', () => {
    vscode.setState({ ...vscode.getState(), noteDraft: document.getElementById('note-input').value });
  });

  vscode.postMessage({ type: 'FETCH_BRAINDUMPS' });

  function startTimer(start_ts) {
    if (timerInterval) clearInterval(timerInterval);
    sessionStartTs = start_ts;
    updateTimer();
    timerInterval = setInterval(updateTimer, 30000);
  }

  function updateTimer() {
    if (!sessionStartTs) return;
    const diffMs = Date.now() - sessionStartTs;
    const h = Math.floor(diffMs / 3600000);
    const m = Math.floor((diffMs % 3600000) / 60000);
    document.getElementById('stat-time').innerText = (h > 0 ? h + 'h ' : '') + m + 'm';
  }

  function fmtTime(ts) {
    const d = new Date(ts);
    return d.getHours().toString().padStart(2,'0') + ':' + d.getMinutes().toString().padStart(2,'0');
  }

  const LANG_COLORS = {
    typescript:'#3178c6', javascript:'#f7df1e', python:'#3572a5',
    css:'#563d7c', html:'#e34c26', json:'#292929', markdown:'#083fa1',
    rust:'#dea584', go:'#00add8'
  };
  function langTag(lang) {
    if (!lang) return '';
    const c = LANG_COLORS[lang] || '#555';
    return '<span class="lang-tag" style="background:' + c + '22;color:' + c + '">' + lang.substring(0,3).toUpperCase() + '</span>';
  }
  function dotClass(type) {
    if (type === 'file:save') return 'save';
    if (type === 'file:change') return 'change';
    if (type === 'diagnostic:error') return 'error';
    if (type === 'git:commit' || type === 'git:activity') return 'git';
    if (type === 'terminal:command') return 'terminal';
    return '';
  }

  function render(data) {
    vscode.postMessage({ type: 'DEBUG', text: 'Render function called' });
    const pulse = document.getElementById('pulse');
    const statusText = document.getElementById('status-text');
    const statusTime = document.getElementById('status-time');
    const tag = document.getElementById('session-tag');
    const timeline = document.getElementById('timeline');

    statusTime.innerText = 'Updated ' + fmtTime(Date.now());

    if (!data || data.error || data.message) {
      vscode.postMessage({ type: 'DEBUG', text: 'Render: No data or error' });
      pulse.className = 'pulse';
      statusText.innerText = 'Backend offline or no session';
      tag.className = 'badge offline';
      tag.innerText = 'OFFLINE';
      timeline.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-dim)">No active session</div>';
      return;
    }

    vscode.postMessage({ type: 'DEBUG', text: 'Render: Success, updating DOM' });
    currentData = data;

    pulse.className = 'pulse online';
    const branch = data.gitBranch && data.gitBranch !== 'unknown' ? ' · ' + data.gitBranch : '';
    statusText.innerText = data.project + branch;
    tag.className = 'badge';
    tag.innerText = 'SESSION #' + data.sessionId;

    if (data.start_ts) startTimer(data.start_ts);

    const events = data.events || [];
    const editEvents = events.filter(e => e.type === 'file:save' || e.type === 'file:change');
    const uniqueFiles = new Set(editEvents.map(e => e.filePath).filter(Boolean)).size;
    document.getElementById('stat-saves').innerText = editEvents.length;
    document.getElementById('stat-files').innerText = uniqueFiles;

    if (events.length === 0) {
      timeline.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-dim)">No activity yet. Start coding!</div>';
    } else {
      const display = [...events].reverse().slice(0, 15);
      timeline.innerHTML = display.map(ev => {
        const name = ev.filePath ? ev.filePath.split(/[\\\\/]/).pop() : 'Terminal';
        const lang = ev.language || '';
        const dc = dotClass(ev.type);
        const diffHtml = (ev.diff && ev.type === 'file:change')
          ? '<div class="tl-diff">' + ev.diff.replace(/</g,'&lt;') + '</div>' : '';
        return '<div class="tl-item" onclick="copyPath(\'' + (ev.filePath||'').replace(/\\\\/g,'\\\\\\\\') + '\')">' +
          '<div class="dot ' + dc + '"></div>' +
          '<div class="tl-body">' +
            '<div class="tl-top"><div class="tl-name">' + name + '</div><div class="tl-time">' + fmtTime(ev.timestamp) + '</div></div>' +
            '<div class="tl-meta">' + langTag(lang) + '<span>' + ev.type.replace(':',' ').toUpperCase() + '</span></div>' +
            diffHtml +
          '</div>' +
        '</div>';
      }).join('');
    }

    if (data.nextSteps && data.nextSteps.length > 0) {
      document.getElementById('steps-section').style.display = 'block';
      document.getElementById('steps-list').innerHTML = data.nextSteps.map((s, i) =>
        '<div class="step-item"><span class="step-num">' + (i+1) + '</span>' + s + '</div>'
      ).join('');
    } else {
      document.getElementById('steps-section').style.display = 'none';
    }
  }

  function showConfirm() { document.getElementById('confirm-row').className = 'confirm-row show'; }
  function hideConfirm() { document.getElementById('confirm-row').className = 'confirm-row'; }
  function doEndSession() {
    hideConfirm();
    vscode.postMessage({ type: 'END_SESSION', project: currentData?.project });
  }
  function openDashboard() { vscode.postMessage({ type: 'OPEN_DASHBOARD' }); }
  function copyPath(p) { if (p) vscode.postMessage({ type: 'COPY_PATH', path: p }); }

  function saveNote() {
    const el = document.getElementById('note-input');
    const content = el.value.trim();
    if (!content) return;
    vscode.postMessage({ type: 'SAVE_BRAINDUMP', content, sessionId: currentData?.sessionId, project: currentData?.project });
    el.value = '';
    vscode.setState({ ...vscode.getState(), noteDraft: '' });
  }

  function renderDumps(dumps) {
    const el = document.getElementById('dump-history');
    if (!dumps || dumps.length === 0) { el.innerHTML = ''; return; }
    el.innerHTML = dumps.slice(0,3).map(d =>
      '<div class="dump-item" title="' + d.content.replace(/"/g,'&quot;') + '">' + d.content.substring(0,80) + (d.content.length>80?'…':'') + '</div>'
    ).join('');
  }

  function askAi() {
    const input = document.getElementById('ai-input');
    const resp = document.getElementById('ai-response');
    if (!input.value.trim()) return;
    resp.style.display = 'block';
    resp.innerHTML = '<i>Thinking...</i>';
    vscode.postMessage({ type: 'ASK_OPENCLAW', question: input.value, project: currentData?.project });
  }

  window.addEventListener('message', e => {
    vscode.postMessage({ type: 'DEBUG', text: 'Received message from extension: ' + e.data.type });
    const { type, data, answer, braindumps } = e.data;
    if (type === 'SESSION_UPDATE') render(data);
    if (type === 'ASK_RESPONSE') {
      const r = document.getElementById('ai-response');
      r.style.display = 'block';
      r.innerText = answer;
    }
    if (type === 'BRAINDUMP_SAVED') renderDumps(braindumps);
  });

  vscode.postMessage({ type: 'DEBUG', text: 'Sending READY' });
  vscode.postMessage({ type: 'READY' });
</script>
</body>
</html>`;
  }

  private getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }
}
