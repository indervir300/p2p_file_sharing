import { useEffect, useRef, useCallback, useState } from 'react';

const MAX_RETRIES = 3;
const BASE_DELAY = 1000; // 1 second

export function useSignaling(onMessage) {
  const wsRef = useRef(null);
  const onMessageRef = useRef(onMessage);
  const retryCount = useRef(0);
  const retryTimer = useRef(null);
  const [wsState, setWsState] = useState('connecting'); // connecting | connected | disconnected

  onMessageRef.current = onMessage;

  const connect = useCallback(() => {
    let url = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080';
    
    // Auto-upgrade to wss if we are on an https page and not on localhost
    if (typeof window !== 'undefined' && window.location.protocol === 'https:' && !url.includes('localhost')) {
      url = url.replace('ws://', 'wss://');
    }

    setWsState('connecting');

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      retryCount.current = 0;
      setWsState('connected');
    };

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        onMessageRef.current?.(data);
      } catch { /* ignore malformed messages */ }
    };

    ws.onerror = (err) => {
      console.error('WebSocket Error:', err);
    };

    ws.onclose = () => {
      setWsState('disconnected');
      wsRef.current = null;

      // Auto-reconnect with exponential backoff
      if (retryCount.current < MAX_RETRIES) {
        const delay = BASE_DELAY * Math.pow(2, retryCount.current);
        retryCount.current += 1;
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
