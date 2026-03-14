import { useRef, useCallback } from 'react';

const CHUNK_SIZE = 64 * 1024; // 64 KB

// Only STUN — no dead/external TURN servers needed
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
];

export function useWebRTC({
  onSignal,
  onProgress,
  onFileMeta,
  onFileReceived,
  onConnected,
  onTransferError,
  onChatMessage,
  onStateChange,
  encryptChunk,
  decryptChunk,
  wsSend,             // signaling send fn passed from page.js for relay fallback
}) {
  const pcRef = useRef(null);
  const dcRef = useRef(null);
  const recvBuffers = useRef([]);
  const recvSize = useRef(0);
  const fileMeta = useRef(null);
  const startTime = useRef(null);
  const sendingRef = useRef(false);
  const pendingCandidates = useRef([]);
  const isRelayMode = useRef(false);

  // ── Shared receive logic (DataChannel + WS relay both use this) ────────
  const processIncomingChunk = useCallback(async (rawChunk, isBase64 = false) => {
    const meta = fileMeta.current;
    if (!meta) return;

    let chunk = isBase64
      ? Uint8Array.from(atob(rawChunk), (c) => c.charCodeAt(0)).buffer
      : rawChunk;

    if (meta.encrypted) {
      if (!decryptChunk) {
        onTransferError?.('Missing decryption key. Ask sender for the private link or enter key manually.');
        return;
      }
      try {
        chunk = await decryptChunk(chunk);
      } catch {
        onTransferError?.('Could not decrypt file chunk. Key is missing or incorrect.');
        return;
      }
    }

    recvBuffers.current.push(chunk);
    recvSize.current += chunk.byteLength;

    const percent = Math.min(99, Math.round((recvSize.current / meta.size) * 100));
    const elapsed = (Date.now() - startTime.current) / 1000;
    const speed = elapsed > 0 ? recvSize.current / elapsed : 0;
    onProgress?.({
      percent,
      speed,
      received: Math.min(recvSize.current, meta.size),
      total: meta.size,
    });
  }, [decryptChunk, onTransferError, onProgress]);

  const processTransferDone = useCallback(() => {
    const meta = fileMeta.current;
    if (!meta) return;

    if (recvSize.current !== meta.size) {
      onTransferError?.('Transfer integrity check failed. Please retry.');
      recvBuffers.current = [];
      recvSize.current = 0;
      fileMeta.current = null;
      return;
    }

    const blob = new Blob(recvBuffers.current, { type: meta.type || 'application/octet-stream' });
    onProgress?.({ percent: 100, speed: 0, received: meta.size, total: meta.size });
    onFileReceived?.({ blob, name: meta.name, size: meta.size });

    recvBuffers.current = [];
    recvSize.current = 0;
    fileMeta.current = null;
  }, [onTransferError, onProgress, onFileReceived]);

  // ── DataChannel setup ──────────────────────────────────────────────────
  const setupDataChannel = useCallback((dc) => {
    dc.binaryType = 'arraybuffer';

    dc.onopen = () => {
      console.log('DataChannel OPEN');
      onConnected?.();
    };

    dc.onerror = (err) => console.error('DataChannel Error:', err);
    dc.onclose = () => console.log('DataChannel CLOSED');

    dc.onmessage = async ({ data }) => {
      if (typeof data === 'string') {
        let message;
        try { message = JSON.parse(data); } catch { return; }

        if (message.kind === 'chat') {
          onChatMessage?.({ text: message.text, timestamp: message.timestamp, id: message.id });
          return;
        }

        if (message.kind === 'meta') {
          fileMeta.current = {
            name: message.name,
            size: message.size,
            type: message.type,
            encrypted: !!message.encrypted,
          };
          recvBuffers.current = [];
          recvSize.current = 0;
          startTime.current = Date.now();
          onFileMeta?.({ name: message.name, size: message.size, type: message.type });
          return;
        }

        if (message.kind === 'done') {
          processTransferDone();
        }
      } else {
        await processIncomingChunk(data, false);
      }
    };
  }, [onConnected, onFileMeta, onChatMessage, processIncomingChunk, processTransferDone]);

  // ── WS Relay: incoming relay messages routed here from page.js ─────────
  const handleRelayMessage = useCallback(async (payload) => {
    if (!payload?.kind) return;

    if (payload.kind === 'relay-connected') {
      // Peer signaled it's switching to relay too
      if (!isRelayMode.current) {
        isRelayMode.current = true;
        onStateChange?.('relay');
        onConnected?.();
      }
      return;
    }

    if (payload.kind === 'chat') {
      onChatMessage?.({ text: payload.text, timestamp: payload.timestamp, id: payload.id });
      return;
    }

    if (payload.kind === 'meta') {
      fileMeta.current = {
        name: payload.name,
        size: payload.size,
        type: payload.type,
        encrypted: !!payload.encrypted,
      };
      recvBuffers.current = [];
      recvSize.current = 0;
      startTime.current = Date.now();
      onFileMeta?.({ name: payload.name, size: payload.size, type: payload.type });
      return;
    }

    if (payload.kind === 'chunk') {
      await processIncomingChunk(payload.data, true); // base64 string
      return;
    }

    if (payload.kind === 'done') {
      processTransferDone();
    }
  }, [onChatMessage, onFileMeta, onStateChange, onConnected, processIncomingChunk, processTransferDone]);

  // ── Peer Connection ────────────────────────────────────────────────────
  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) onSignal({ type: 'ice-candidate', payload: candidate });
    };

    pc.oniceconnectionstatechange = () => {
      console.log('ICE State:', pc.iceConnectionState);
      onStateChange?.(pc.iceConnectionState);

      if (pc.iceConnectionState === 'failed') {
        console.warn('ICE failed — switching to WebSocket relay');
        isRelayMode.current = true;
        onStateChange?.('relay');
        // Tell the other peer to also switch to relay
        wsSend?.({ type: 'relay', payload: { kind: 'relay-connected' } });
        onConnected?.();
      }

      if (pc.iceConnectionState === 'disconnected') {
        // Wait 4 seconds before forcing relay to allow recovery
        setTimeout(() => {
          if (
            pc.iceConnectionState !== 'connected' &&
            pc.iceConnectionState !== 'completed'
          ) {
            console.warn('ICE disconnected too long — switching to WebSocket relay');
            isRelayMode.current = true;
            onStateChange?.('relay');
            wsSend?.({ type: 'relay', payload: { kind: 'relay-connected' } });
            onConnected?.();
          }
        }, 4000);
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('Peer Connection State:', pc.connectionState);
    };

    pcRef.current = pc;
    return pc;
  }, [onSignal, onStateChange, onConnected, wsSend]);

  const createOffer = useCallback(async () => {
    const pc = createPeerConnection();
    const dc = pc.createDataChannel('fileTransfer', { ordered: true });
    dcRef.current = dc;
    setupDataChannel(dc);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    onSignal({ type: 'offer', payload: offer });
  }, [createPeerConnection, setupDataChannel, onSignal]);

  const handleOffer = useCallback(async (offer) => {
    const pc = createPeerConnection();
    pc.ondatachannel = ({ channel }) => {
      dcRef.current = channel;
      setupDataChannel(channel);
    };
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    while (pendingCandidates.current.length > 0) {
      const cand = pendingCandidates.current.shift();
      await pc.addIceCandidate(new RTCIceCandidate(cand)).catch((e) =>
        console.warn('Delayed ICE failure:', e)
      );
    }
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    onSignal({ type: 'answer', payload: answer });
  }, [createPeerConnection, setupDataChannel, onSignal]);

  const handleAnswer = useCallback(async (answer) => {
    const pc = pcRef.current;
    if (!pc) return;
    await pc.setRemoteDescription(new RTCSessionDescription(answer));
    while (pendingCandidates.current.length > 0) {
      const cand = pendingCandidates.current.shift();
      await pc.addIceCandidate(new RTCIceCandidate(cand)).catch((e) =>
        console.warn('Delayed ICE failure:', e)
      );
    }
  }, []);

  const handleIceCandidate = useCallback(async (candidate) => {
    const pc = pcRef.current;
    if (pc && pc.remoteDescription?.type) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch((e) =>
        console.warn('ICE failure:', e)
      );
    } else {
      pendingCandidates.current.push(candidate);
    }
  }, []);

  // ── Send chat: auto-routes via DataChannel or WS relay ────────────────
  const sendChatMessage = useCallback((text) => {
    const id =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    if (isRelayMode.current) {
      wsSend?.({ type: 'relay', payload: { kind: 'chat', text, timestamp: Date.now(), id } });
      return true;
    }

    const dc = dcRef.current;
    if (!dc || dc.readyState !== 'open') return false;
    dc.send(JSON.stringify({ kind: 'chat', text, timestamp: Date.now(), id }));
    return true;
  }, [wsSend]);

  // ── Send file: auto-routes via DataChannel or WS relay ────────────────
  const sendFile = useCallback(async (file) => {
    if (sendingRef.current) return;
    sendingRef.current = true;

    const metaPayload = {
      kind: 'meta',
      version: 2,
      name: file.name,
      size: file.size,
      type: file.type,
      encrypted: !!encryptChunk,
    };

    try {
      if (isRelayMode.current) {
        // ── WS Relay path ──────────────────────────────────────────────
        wsSend?.({ type: 'relay', payload: metaPayload });

        const buffer = await file.arrayBuffer();
        let offset = 0;
        startTime.current = Date.now();
        let chunkIndex = 0;

        while (offset < buffer.byteLength) {
          const rawChunk = buffer.slice(offset, offset + CHUNK_SIZE);

          let encoded;
          if (encryptChunk) {
            const encrypted = await encryptChunk(rawChunk);
            encoded = btoa(String.fromCharCode(...new Uint8Array(encrypted)));
          } else {
            encoded = btoa(String.fromCharCode(...new Uint8Array(rawChunk)));
          }

          wsSend?.({
            type: 'relay',
            payload: { kind: 'chunk', data: encoded, encrypted: !!encryptChunk },
          });

          offset += CHUNK_SIZE;
          chunkIndex++;

          const sent = Math.min(offset, buffer.byteLength);
          const percent = Math.min(99, Math.round((sent / buffer.byteLength) * 100));
          const elapsed = (Date.now() - startTime.current) / 1000;
          const speed = elapsed > 0 ? sent / elapsed : 0;
          onProgress?.({ percent, speed, sent, total: buffer.byteLength });

          // Yield every 10 chunks to keep the UI responsive
          if (chunkIndex % 10 === 0) {
            await new Promise((r) => setTimeout(r, 0));
          }
        }

        wsSend?.({ type: 'relay', payload: { kind: 'done' } });
        onProgress?.({ percent: 100, speed: 0, sent: file.size, total: file.size });

      } else {
        // ── WebRTC DataChannel path ────────────────────────────────────
        const dc = dcRef.current;
        if (!dc || dc.readyState !== 'open') return;

        dc.send(JSON.stringify(metaPayload));

        const buffer = await file.arrayBuffer();
        let offset = 0;
        startTime.current = Date.now();

        while (offset < buffer.byteLength) {
          // Back-pressure for large files
          if (dc.bufferedAmount > 16 * 1024 * 1024) {
            dc.bufferedAmountLowThreshold = 8 * 1024 * 1024;
            await new Promise((resolve) => {
              dc.onbufferedamountlow = () => {
                dc.onbufferedamountlow = null;
                resolve();
              };
            });
          }

          const chunk = buffer.slice(offset, offset + CHUNK_SIZE);
          if (encryptChunk) {
            dc.send(await encryptChunk(chunk));
          } else {
            dc.send(chunk);
          }

          offset += CHUNK_SIZE;
          const sent = Math.min(offset, buffer.byteLength);
          const percent = Math.min(99, Math.round((sent / buffer.byteLength) * 100));
          const elapsed = (Date.now() - startTime.current) / 1000;
          const speed = elapsed > 0 ? sent / elapsed : 0;
          onProgress?.({ percent, speed, sent, total: buffer.byteLength });
        }

        dc.send(JSON.stringify({ kind: 'done' }));
        onProgress?.({ percent: 100, speed: 0, sent: file.size, total: file.size });
      }
    } finally {
      sendingRef.current = false;
    }
  }, [onProgress, encryptChunk, wsSend]);

  // ── Connection info ────────────────────────────────────────────────────
  const getConnectionInfo = useCallback(async () => {
    if (isRelayMode.current) {
      return { type: 'relay', relayed: true, protocol: 'websocket' };
    }
    const pc = pcRef.current;
    if (!pc) return null;
    try {
      const stats = await pc.getStats();
      for (const [, report] of stats) {
        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          const localCandidate = stats.get(report.localCandidateId);
          const remoteCandidate = stats.get(report.remoteCandidateId);
          return {
            type: localCandidate?.candidateType || 'unknown',
            relayed:
              localCandidate?.candidateType === 'relay' ||
              remoteCandidate?.candidateType === 'relay',
            protocol: localCandidate?.protocol || 'unknown',
          };
        }
      }
    } catch { /* stats not available */ }
    return null;
  }, []);

  const cleanup = useCallback(() => {
    dcRef.current?.close();
    pcRef.current?.close();
    dcRef.current = null;
    pcRef.current = null;
    recvBuffers.current = [];
    recvSize.current = 0;
    fileMeta.current = null;
    isRelayMode.current = false;
  }, []);

  return {
    createOffer,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    sendFile,
    sendChatMessage,
    getConnectionInfo,
    cleanup,
    handleRelayMessage,   // consumed by page.js
  };
}
