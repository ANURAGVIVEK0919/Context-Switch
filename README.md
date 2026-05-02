# ContextSwitch

## Setup Steps

1. **Install dependencies:**

```
cd chunk-b && npm install
cd ../chunk-a && npm install
cd ../chunk-c/extension && npm install
```

2. **Start backend:**

```
npm run start
```

3. **Start websocket:**

```
npm run ws
```

4. **Run VS Code extension:**

Press F5 in extension project

---

- Backend runs on port 3001
- WebSocket runs on port 3002
- Extension connects successfully
- File edits trigger logs in backend
