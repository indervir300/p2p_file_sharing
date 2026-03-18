import { useEffect, useRef, useCallback, useState } from 'react';

const MAX_RETRIES = 8;       // enough to survive Render cold-start (~60s)
const BASE_DELAY = 2000;     // 2s base → retries at 2, 4, 8, 16, 32, 64... seconds

export function useSignaling(onMessage, onConnectionChange) {
  const wsRef = useRef(null);
  const onMessageRef = useRef(onMessage);
  const onConnectionChangeRef = useRef(onConnectionChange);
  const retryCount = useRef(0);
  const retryTimer = useRef(null);
  const [wsState, setWsState] = useState('connecting');

  onMessageRef.current = onMessage;
  onConnectionChangeRef.current = onConnectionChange;

  const connect = useCallback(() => {
    let url = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080';

    if (
      typeof window !== 'undefined' &&
      window.location.protocol === 'https:' &&
      !url.includes('localhost')
    ) {
      url = url.replace('ws://', 'wss://');
    }

    setWsState('connecting');
    onConnectionChangeRef.current?.('connecting');

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      retryCount.current = 0;
      setWsState('connected');
      onConnectionChangeRef.current?.('connected');
    };

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        onMessageRef.current?.(data);
      } catch { /* ignore malformed messages */ }
    };

    ws.onerror = (err) => {
      console.error('WebSocket Error:', err);
      onConnectionChangeRef.current?.('error');
    };

    ws.onclose = () => {
      setWsState('disconnected');
      onConnectionChangeRef.current?.('disconnected');
      wsRef.current = null;

      // Notify disconnect to message handler
      onMessageRef.current?.({ type: 'disconnected' });

      if (retryCount.current < MAX_RETRIES) {
        const delay = BASE_DELAY * Math.pow(2, retryCount.current);
        retryCount.current += 1;
        console.log(`WS reconnecting in ${delay}ms (attempt ${retryCount.current}/${MAX_RETRIES})`);
        onConnectionChangeRef.current?.('reconnecting');
        retryTimer.current = setTimeout(connect, delay);
      }
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(retryTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((data) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }, []);

  const reconnect = useCallback(() => {
    retryCount.current = 0;
    clearTimeout(retryTimer.current);
    wsRef.current?.close();
    connect();
  }, [connect]);

  return { send, wsState, reconnect };
}
