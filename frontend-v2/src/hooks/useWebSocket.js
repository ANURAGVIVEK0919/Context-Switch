import { useEffect, useRef, useState } from 'react';

export default function useWebSocket(url, onMessage) {
  const onMessageRef = useRef(onMessage);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);
  const [lastEventAt, setLastEventAt] = useState(0);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    if (!url) return undefined;

    let socket;
    let retryTimer;
    let closed = false;

    const connect = () => {
      socket = new WebSocket(url);

      socket.onopen = () => {
        if (closed) return;
        setIsConnected(true);
        const token = localStorage.getItem('token');
        if (token) {
          socket.send(JSON.stringify({ type: 'auth', token }));
        }
      };

      socket.onmessage = event => {
        try {
          const payload = JSON.parse(event.data);
          setLastMessage(payload);
          if (payload?.type === 'events_updated') {
            setLastEventAt(Date.now());
          }
          if (onMessageRef.current) {
            onMessageRef.current(payload);
          }
        } catch (err) {
          // ignore malformed payloads
        }
      };

      socket.onclose = () => {
        if (closed) return;
        setIsConnected(false);
        retryTimer = window.setTimeout(connect, 3000);
      };

      socket.onerror = () => {
        // keep silent; onclose will trigger reconnect
      };
    };

    connect();

    return () => {
      closed = true;
      setIsConnected(false);
      if (retryTimer) window.clearTimeout(retryTimer);
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };
  }, [url]);

  return { isConnected, lastMessage, lastEventAt };
}
