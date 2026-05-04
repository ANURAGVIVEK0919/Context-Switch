# 🚀 ContextSwitch: Intelligent Developer Dashboard

> **Bridging the gap between code changes and high-level project context.**

ContextSwitch is a state-of-the-art developer productivity tool designed for modern engineering workflows. It tracks your granular development activity in VS Code and uses AI to reconstruct the "why" behind your "what," providing a beautiful, data-driven dashboard of your progress, file heatmaps, and session summaries.

---

## ✨ Key Features

- **🧠 AI Session Reconstruction**: Automatically generates summaries of your coding sessions using Groq AI.
- **📊 Real-time Dashboard**: A sleek, dark-mode dashboard built with React and Tailwind CSS.
- **🔥 File Heatmaps**: Visualize which files are being modified most and which are becoming stale.
- **🔌 VS Code Integration**: A lightweight extension that streams activity events via WebSockets.
- **📅 Session History**: Track your productivity over time with a detailed session log.
- **💾 Persistent Memory**: Automatically captures key project milestones and auto-snapshots.

---

## 📂 Project Structure

The project is organized as a monorepo:

| Component | Path | Technology | Description |
| :--- | :--- | :--- | :--- |
| **Backend** | `/` | Node.js, Express, SQLite | The core engine handling storage and AI. |
| **Ingestion** | `/src/websocket` | WebSockets (ws) | Receives real-time events from VS Code. |
| **Frontend** | `/frontend-v2` | React, Vite, Tailwind | The visual dashboard UI. |
| **Extension** | `/extension` | VS Code Extension API | The activity tracker plugin. |

---

## 🛠️ Prerequisites

- **Node.js**: `v18.x` or higher
- **npm**: `v9.x` or higher
- **VS Code**: Latest version
- **Groq API Key**: Required for AI summaries ([Get a free key](https://console.groq.com/))

---

## 🚀 Installation & Setup

### 1. Backend (The Brain)

1.  **Install dependencies**:
    ```bash
    npm install
    ```
2.  **Environment Setup**:
    - Copy `.env.example` to `.env`
    - Add your `GROQ_API_KEY` to the `.env` file.
3.  **Start the Backend**:
    We have combined the servers, so you only need one command:
    ```bash
    npm run dev
    ```
    *(This starts the HTTP API on port 3001 and the WebSocket listener on port 3002 automatically.)*

### 2. Frontend (The Dashboard)

1.  **Navigate & Install**:
    ```bash
    cd frontend-v2
    npm install
    ```
2.  **Launch Dashboard**:
    ```bash
    npm run dev
    ```
    *Access the UI at `http://localhost:5173`.*

### 3. VS Code Extension (The Tracker)

We have provided a pre-compiled `.vsix` package for easy installation.

1.  **Install the Extension**:
    - Open VS Code.
    - Go to the Extensions view (`Ctrl+Shift+X`).
    - Click the `...` menu at the top right of the Extensions view.
    - Select **Install from VSIX...**
    - Browse to `extension/contextswitch-extension-0.0.1.vsix` and select it.
2.  **Run from Source (Development)**:
    If you are editing the extension code, you can run it directly:
    ```bash
    cd extension
    npm install
    ```
    Open the `extension` folder in VS Code and press `F5` to open the Extension Development Host.

---

## 📋 API Documentation

The backend provides several REST endpoints for data access:

- `GET /session/active`: Retrieve the current active coding session.
- `GET /dashboard/stats`: Get project-wide productivity statistics.
- `GET /staleness/scores`: Retrieve file heatmaps and staleness data.
- `POST /braindump`: Save a manual developer note to the current context.

---

## 🛠️ Configuration

Customize behavior in your `.env` file:

- `PORT`: API server port (default 3001).
- `WS_PORT`: Ingestion server port (default 3002).
- `GROQ_API_KEY`: Your Groq AI credentials.

---

## 📜 License

Developed as part of the **Samsung Prism** program.
