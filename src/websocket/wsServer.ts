import { WebSocketServer, WebSocket } from "ws";
import { registerRealtimeClient } from "../realtime";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key";

/**
 * WS Server on Port 3002 handles:
 * 1. Extension pulse (legacy)
 * 2. Sidebar real-time updates (via registerRealtimeClient)
 */
if (process.env.NODE_ENV !== 'test') {
  const wss = new WebSocketServer({ port: 3002 });

  wss.on("connection", (ws: WebSocket) => {
    console.log("[WS] New client connected to port 3002");
    
    // Register this client with our global broadcast manager
    registerRealtimeClient(ws);

    ws.on("message", (data) => {
      // Basic heartbeat or status logging if needed
      // Most logic is now in registerRealtimeClient's inner listener
    });

    ws.on("error", (err) => {
      console.error("[WS] Connection error:", err);
    });
  });

  console.log("WebSocket server running on port 3002");
}