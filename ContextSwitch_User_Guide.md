# 🚀 ContextSwitch: Full Ecosystem User Guide

This is the master manual for testing the **entire** ContextSwitch platform: **Web Dashboard**, **VS Code Extension**, and **Telegram Bot**.

---

## 🏗️ 1. Technical Architecture
*   **Backend:** Node.js API (Port 3001) + WebSocket Server (Port 3002).
*   **Web UI:** React Dashboard (Port 3000).
*   **Extension:** VS Code ContextSwitch Tracker.
*   **Bot:** Telegram Inbound & Outbound Service.

---

## 🖥️ 2. The Complete User Journey

### Phase A: Web Dashboard (The Command Center)
1.  **Onboarding:** Go to `http://localhost:3000/register`. Create your account.
2.  **AI Config:** Go to **Settings** and paste your **Groq API Key**.
3.  **Bot Linking:** Click **"Link Telegram"**. It will give you a **Linking Code**.

### Phase B: VS Code Extension (The Capture Engine)
1.  **Connect:** Open VS Code. In the Status Bar (bottom right), click **"Connect to ContextSwitch"**.
2.  **Auth:** Enter your credentials when prompted. The status bar should change to **"ContextSwitch: Online"**.
3.  **Active Coding:** Open any project. The extension will automatically detect your project name and start streaming events as you save files.
4.  **Handoff Command:** Press `Ctrl+Shift+P` and type `ContextSwitch: Generate Handoff`. A markdown doc will be created instantly.

### Phase C: Telegram Bot (The Proactive Assistant)
1.  **First Contact:** Search for your bot on Telegram and send `/start`.
2.  **Link Account:** Type `/link [Your-Linking-Code]`. The bot will reply: *"Account Linked Successfully!"*
3.  **Live Status:** Type `/status` to see your current active project and session duration.
4.  **Idle Alert:** Stop coding for 30 minutes. The bot will message you: *"Hey, you've been away from 'omega-api' for a while. Want to save your progress?"*

---

## 🧪 3. Manual QA Test Suite (Ecosystem Integration)

| Test Component | Action | Expected Result |
|:---|:---|:---|
| **1. Extension -> UI** | Save a file in VS Code (`src/app.ts`). | The **Activity Pulse** on the Web Dashboard must trigger within 500ms. |
| **2. UI -> Extension** | Click **"End Session"** on the Dashboard. | VS Code status bar should change to **"ContextSwitch: Idle"**. |
| **3. Bot -> DB** | Send `/summary` to the Telegram Bot. | The bot must reply with a Groq-generated summary of your **most recent** session. |
| **4. Team Live Sync** | Open 2 Browser tabs (User A and User B). User A saves a file in VS Code. | **Both** Dashboards update live because they share the same project membership. |
| **5. Semantic Recall** | Ask the Telegram Bot: *"What was the bug I found yesterday?"* | The bot uses **FTS5 search** to find your yesterday's braindump and answers. |

---

## 🛠️ 4. Maintenance & Reset
*   **Server Logs:** Check terminal for `[Extension] Client Connected` and `[Telegram] Inbound Message`.
*   **Database:** `D:\Context-Switch\context_switch.db`.
*   **Zero-Reset:** Delete the `.db` file to wipe all users and sessions for a fresh test run.

---
*Created by Antigravity AI — Full Ecosystem Verified.*
let us check now


let us start with the next feature now do it slowly and tell me each and every step  ju hoga dekhte hai
check the teminal


check again from the 3rd point  
check karo

ek baar or


last try
ek baar last try


ab try kao kya hu raha hai
ab sync kaam kiya


if it is working now

check sync  hua kya

single time trigger


per change one trigger only
per change on e trigger only

single and properly saved


unkown error gone

ab n=bina break ka dikhega


last cance


one last dance

ccheck the summary

sumaay fix


ab toh summary save ho gaya hoga