# 🚀 ContextSwitch: Intelligent Developer Memory & Handoff System

> **Bridging the gap between granular code changes and high-level architectural intent.**

ContextSwitch is an AI-powered monorepo designed to act as a "Project Second Brain." By capturing every granular event (Git, Files, Terminal, Errors) and synthesizing them using **Llama 3.3 (Groq AI)**, it provides developers with a persistent, searchable, and proactive memory of their entire project lifecycle.

---

## 🛠️ System Architecture

1.  **Event Ingestion**: VS Code extension streams real-time activity via WebSockets.
2.  **Knowledge Synthesis**: Sessions are automatically summarized into long-term "Memory Nodes."
3.  **Hybrid Retrieval**: Combines keyword search with temporal context for high-accuracy AI reasoning.
4.  **Proactive Pulse**: A heartbeat engine sends context-aware briefings to Telegram.

---

## ✨ Feature Usage & Workflows

### 1. VS Code Sidebar (Real-time Flow)
*   **Timeline**: Automatically refreshes every 4s to show your latest coding activity.
*   **Ask OpenClaw**: Type questions about your project history in the sidebar chat box.
*   **Trigger**: Open the ContextSwitch icon in the activity bar.

### 2. OpenClaw Handoff (Deep Context)
*   **Purpose**: Used when returning to a project after a break or switching tasks.
*   **Output**: Generates a "Catch-up Brief" including current goals, recent hurdles, and long-term history.
*   **Usage**: Accessed via the Dashboard or the `/reconstruct` API.

### 3. Surface 3 (Telegram Heartbeat)
*   **Morning Brief (08:00)**: Tells you what to work on today based on your stalest projects.
*   **Evening Nudge (21:00)**: Reminds you to log notes if you haven't coded today.
*   **Interactive Bot**: 
    *   Send a **note** (e.g., "Updated the API docs") to save it as a BrainDump.
    *   Send a **question** (e.g., "What was the fix for the bug?") for instant AI answers.

---

## 📋 API Reference

### 🟢 Session Management (`/session`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/session/start` | Initialize a new tracking session for a project. |
| `POST` | `/session/end` | Close a session and trigger AI Memory Synthesis. |
| `GET` | `/session/history` | Retrieve all past work blocks and event counts. |
| `GET` | `/session/current` | Get the currently active session details. |
| `GET` | `/:id/events` | Fetch all raw events captured during a specific session. |

### 🧠 AI & Reasoning (`/ask`, `/reconstruct`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/ask` | Ask a natural language question about project history. |
| `GET` | `/reconstruct/:id` | Generate a deep handoff brief for a specific project. |
| `GET` | `/ai/summarize` | Manually trigger a summary of the current context. |

### 📈 Dashboard & Analytics (`/dashboard`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/dashboard/stats` | High-level metrics (total sessions, events, projects). |
| `GET` | `/dashboard/timeline` | Hourly event distribution for activity charting. |
| `GET` | `/dashboard/staleness` | Focus scores and inactivity tracking for all files. |

### 📝 Notes & Brain Dumps (`/braindump`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/braindump` | Fetch all manual developer notes. |
| `POST` | `/braindump` | Save a new note (Content, Project, SessionId). |

### 🛠️ Debug & Interaction (`/debug`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/debug/heartbeat/morning` | Manually trigger the Morning Brief notification. |
| `GET` | `/debug/heartbeat/stale` | Manually trigger Stale Project alerts. |
| `GET` | `/debug/heartbeat/weekly` | Manually trigger the Weekly Summary. |

---

## ⚙️ Configuration (.env)

The system requires several keys to operate at full capacity:

```env
GROQ_API_KEY=gsk_...         # Required for Llama 3.3 Reasoning
TELEGRAM_BOT_TOKEN=...      # For Surface 3 Notifications
TELEGRAM_CHAT_ID=...        # Your unique ID from @userinfobot
PORT=3001                   # HTTP API Port
WS_PORT=3002                # WebSocket Event Port
```

---

## 🧪 Automated Testing

Verify the end-to-end pipeline using these scripts:

1.  **Full Lifecycle**: `node test/masterTest.js`
2.  **AI Chat Logic**: `node test/testAskOpenClaw.js`
3.  **Telegram Delivery**: `node test/testSurface3.js`

---

## 📜 Project Credits

Developed for the **Samsung Prism** program.
**Core Contributors**: Anurag Vivek & Vaibhav.
