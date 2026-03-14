import { useRef, useCallback } from 'react';

const CHUNK_SIZE = 64 * 1024; // 64 KB

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  // OpenRelay TURN servers
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

export function useWebRTC({ onSignal, onProgress, onFileMeta, onFileReceived, onConnected, onTransferError, onChatMessage, onStateChange, encryptChunk, decryptChunk }) {
  const pcRef = useRef(null);
  const dcRef = useRef(null);
  const recvBuffers = useRef([]);
  const recvSize = useRef(0);
  const fileMeta = useRef(null);
  const startTime = useRef(null);
  const sendingRef = useRef(false);

  const pendingCandidates = useRef([]);
  
  const setupDataChannel = useCallback((dc) => {
    dc.binaryType = 'arraybuffer';

    dc.onopen = () => {
      console.log('DataChannel OPEN');
      onConnected?.();
    };
    
    dc.onerror = (err) => console.error('DataChannel Error:', err);
    dc.onclose = () => console.log('DataChannel CLOSED');

    dc.onmessage = async ({ data }) => {
      // ... (existing logic remains same)
      if (typeof data === 'string') {
        let message;
        try {
          message = JSON.parse(data);
        } catch {
          return;
        }

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
          const meta = fileMeta.current;
          if (!meta) return;

          if (recvSize.current !== meta.size) {
            onTransferError?.('Transfer integrity check failed. Please retry with the private link (code + key).');
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
        }
      } else {
        const meta = fileMeta.current;
        if (!meta) return;

        // Decrypt chunk if encryption is enabled
        let chunk = data;
        if (meta.encrypted) {
          if (!decryptChunk) {
            onTransferError?.('Missing decryption key. Ask sender for private link or enter key manually.');
            return;
          }
          try {
            chunk = await decryptChunk(data);
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
        onProgress?.({ percent, speed, received: Math.min(recvSize.current, meta.size), total: meta.size });
      }
    };
  }, [onConnected, onProgress, onFileMeta, onFileReceived, onTransferError, onChatMessage, decryptChunk]);

  const sendChatMessage = useCallback((text) => {
    const dc = dcRef.current;
    if (!dc || dc.readyState !== 'open') return false;
    const id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    dc.send(JSON.stringify({ kind: 'chat', text, timestamp: Date.now(), id }));
    return true;
  }, []);

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) onSignal({ type: 'ice-candidate', payload: candidate });
    };

    pc.oniceconnectionstatechange = () => {
      console.log('ICE Connection State:', pc.iceConnectionState);
      onStateChange?.(pc.iceConnectionState);
      if (pc.iceConnectionState === 'failed') {
        onTransferError?.('Network connection failed. This often happens on mobile data or restrictive corporate networks.');
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('Peer Connection State:', pc.connectionState);
      onStateChange?.(pc.connectionState);
    };

    pcRef.current = pc;
    return pc;
  }, [onSignal, onTransferError]);

  const createOffer = useCallback(async () => {
    const pc = createPeerConnection();
    const dc = pc.createDataChannel('fileTransfer', {
      ordered: true,
    });
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
    
    // Process any candidates that arrived before the offer
    while (pendingCandidates.current.length > 0) {
      const cand = pendingCandidates.current.shift();
      await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(e => console.warn('Delayed ICE failure:', e));
    }
    
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    onSignal({ type: 'answer', payload: answer });
  }, [createPeerConnection, setupDataChannel, onSignal]);

  const handleAnswer = useCallback(async (answer) => {
    const pc = pcRef.current;
    if (!pc) return;
    await pc.setRemoteDescription(new RTCSessionDescription(answer));
    
    // Process any candidates that arrived before the answer
    while (pendingCandidates.current.length > 0) {
      const cand = pendingCandidates.current.shift();
      await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(e => console.warn('Delayed ICE failure:', e));
    }
  }, []);

  const handleIceCandidate = useCallback(async (candidate) => {
    const pc = pcRef.current;
    if (pc && pc.remoteDescription && pc.remoteDescription.type) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => console.warn('ICE failure:', e));
    } else {
      pendingCandidates.current.push(candidate);
    }
  }, []);

  const sendFile = useCallback(async (file) => {
    const dc = dcRef.current;
    if (!dc || dc.readyState !== 'open' || sendingRef.current) return;

    sendingRef.current = true;

    // Send metadata first (unencrypted control message)
    dc.send(JSON.stringify({
      kind: 'meta',
      version: 2,
      name: file.name,
      size: file.size,
      type: file.type,
      encrypted: !!encryptChunk,
    }));

    try {
      const buffer = await file.arrayBuffer();
      let offset = 0;
      const totalSize = buffer.byteLength;
      startTime.current = Date.now();

      while (offset < totalSize) {
        // Back-pressure control for large files
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
          const encrypted = await encryptChunk(chunk);
          dc.send(encrypted);
        } else {
          dc.send(chunk);
        }

        offset += CHUNK_SIZE;
        const sent = Math.min(offset, totalSize);
        const percent = Math.min(99, Math.round((sent / totalSize) * 100));
        const elapsed = (Date.now() - startTime.current) / 1000;
        const speed = elapsed > 0 ? sent / elapsed : 0;
        onProgress?.({ percent, speed, sent, total: totalSize });
      }

      dc.send(JSON.stringify({ kind: 'done' }));
      onProgress?.({ percent: 100, speed: 0, sent: totalSize, total: totalSize });
    } finally {
      sendingRef.current = false;
    }
  }, [onProgress, encryptChunk]);

  /** Get connection type info (direct vs relayed) */
  const getConnectionInfo = useCallback(async () => {
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
            relayed: localCandidate?.candidateType === 'relay' || remoteCandidate?.candidateType === 'relay',
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
  }, []);

  return { createOffer, handleOffer, handleAnswer, handleIceCandidate, sendFile, sendChatMessage, getConnectionInfo, cleanup };
}
