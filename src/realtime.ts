import WebSocket from 'ws';

type RealtimePayload = {
  type: string;
  count?: number;
};

const clients = new Set<WebSocket>();

export function registerRealtimeClient(ws: WebSocket) {
  clients.add(ws);
  ws.on('close', () => clients.delete(ws));
  ws.on('error', () => clients.delete(ws));
}

export function broadcastRealtimeUpdate(payload: RealtimePayload) {
  const message = JSON.stringify(payload);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}
