# ContextSwitch 🧠

**Instantly resume your coding flow after interruptions.**

ContextSwitch is an AI-powered developer companion that tracks your coding sessions, captures key technical context, and generates "Resumption Briefs" to help you pick up exactly where you left off.

## ✨ Features

- **Session Awareness**: Automatically tracks file edits, git activity, and terminal output.
- **AI Reconstruction**: Uses LLMs to analyze your recent activity and generate a 30-second brief of your current state, goal, and next steps.
- **Brain Dumps**: Quick notes that you can jot down before stepping away—AI integrates these as high-priority context.
- **Secure by Design**: Full multi-user authentication. Your coding data is yours alone, scoped strictly to your account.
- **Real-time Insights**: View your current session status and project health directly in the VS Code sidebar.

## 🚀 Getting Started

1. **Install the Extension**: Find "ContextSwitch" in the VS Code Marketplace.
2. **Login**: Click the "Login" button in the ContextSwitch sidebar.
3. **Start Coding**: The extension automatically detects your project and starts tracking activity.
4. **Pause/Resume**: When you return from a break, check the sidebar for your **Resumption Brief**.

## 🛠 Configuration

ContextSwitch requires a connection to the ContextSwitch Backend. By default, it connects to `http://localhost:3001`.

```json
{
  "contextswitch.backendUrl": "http://localhost:3001"
}
```

## 🔒 Privacy & Security

ContextSwitch takes your privacy seriously:
- Data is encrypted and scoped to your user account.
- You can delete any session or event data at any time.
- All AI analysis is performed using enterprise-grade models with strict data privacy policies.

---

*Built for developers who value their flow.*
[Repository](https://github.com/ANURAGVIVEK0919/Context-Switch) | [Report Bug](https://github.com/ANURAGVIVEK0919/Context-Switch/issues)
