// Purpose: Main backend server
// Input: HTTP requests from extension
// Output: Mock responses (DB later)
import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import express, { Request, Response, NextFunction } from "express";
import cors from "cors";


import eventsRoutes from "./routes/events.routes";
import braindumpRoutes from "./routes/braindump.routes";
import debugRoutes from "./routes/debug.routes";

import contextRoutes from "./routes/context.routes";
import aiRoutes from "./routes/ai.routes";
import memoryRoutes from "./routes/memory.routes";
import stalenessRoutes from "./routes/staleness.routes";
import sessionRoutes from "./routes/session.routes";
import reconstructRoutes from "./routes/reconstruct.routes";
import askRoutes from "./routes/ask.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import { startHeartbeatEngine } from "./scheduler/heartbeatEngine";
import { startTelegramPolling } from "./services/telegramInbound";

import "./websocket/wsServer";
const app = express();

app.use(cors());
app.use(express.json()); // MUST be before any routes

// Mount events route
app.use("/", eventsRoutes);

// Mount braindump route
app.use("/braindump", braindumpRoutes);

// Mount context route
app.use("/context", contextRoutes);

// Mount AI route
app.use("/ai", aiRoutes);

// Mount memory route
app.use("/memory", memoryRoutes);

// Mount staleness route
app.use("/staleness", stalenessRoutes);

// Mount debug route
app.use("/debug", debugRoutes);

// Mount session route
app.use("/session", sessionRoutes);

// Mount reconstruct route
app.use("/reconstruct", reconstructRoutes);

// Mount ask route
app.use("/ask", askRoutes);

// Mount dashboard route
app.use("/dashboard", dashboardRoutes);

// middleware example
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// health route
app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok" });
});

// start server
app.listen(3001, () => {
  console.log("Server started on 3001");
  // Start Surface 3 Proactive Engine
  startHeartbeatEngine();
  // Start Telegram Inbound Interaction
  startTelegramPolling();
});