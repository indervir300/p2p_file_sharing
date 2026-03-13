import { useRef, useCallback } from 'react';

const CHUNK_SIZE = 64 * 1024; // 64 KB

const ICE_SERVERS = [
  // Google STUN
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  // Free TURN servers from OpenRelay (metered.ca) — 100% free, no signup
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
  {
    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

export function useWebRTC({ onSignal, onProgress, onFileReceived, onConnected, encryptChunk, decryptChunk }) {
  const pcRef = useRef(null);
  const dcRef = useRef(null);
  const recvBuffers = useRef([]);
  const recvSize = useRef(0);
  const fileMeta = useRef(null);
  const startTime = useRef(null);

  const setupDataChannel = useCallback((dc) => {
    dc.binaryType = 'arraybuffer';

    dc.onopen = () => onConnected?.();

    dc.onmessage = async ({ data }) => {
      if (typeof data === 'string') {
        // First message = file metadata JSON
        fileMeta.current = JSON.parse(data);
        recvBuffers.current = [];
        recvSize.current = 0;
        startTime.current = Date.now();
      } else {
        // Decrypt chunk if encryption is enabled
        let chunk = data;
        if (decryptChunk) {
          try {
            chunk = await decryptChunk(data);
          } catch {
            // If decryption fails, use raw data (non-encrypted transfer)
            chunk = data;
          }
        }

        recvBuffers.current.push(chunk);
        recvSize.current += chunk.byteLength;
        const meta = fileMeta.current;
        if (meta) {
          const percent = Math.min(100, Math.round((recvSize.current / meta.size) * 100));
          const elapsed = (Date.now() - startTime.current) / 1000;
          const speed = elapsed > 0 ? recvSize.current / elapsed : 0;
          onProgress?.({ percent, speed, received: recvSize.current, total: meta.size });

          if (recvSize.current >= meta.size) {
            const blob = new Blob(recvBuffers.current, { type: meta.type });
            onFileReceived?.({ blob, name: meta.name, size: meta.size });
            recvBuffers.current = [];
            recvSize.current = 0;
            fileMeta.current = null;
          }
        }
      }
    };
  }, [onConnected, onProgress, onFileReceived, decryptChunk]);

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) onSignal({ type: 'ice-candidate', payload: candidate });
    };
    pcRef.current = pc;
    return pc;
  }, [onSignal]);

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
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    onSignal({ type: 'answer', payload: answer });
  }, [createPeerConnection, setupDataChannel, onSignal]);

  const handleAnswer = useCallback(async (answer) => {
    await pcRef.current?.setRemoteDescription(new RTCSessionDescription(answer));
  }, []);

  const handleIceCandidate = useCallback(async (candidate) => {
    await pcRef.current?.addIceCandidate(new RTCIceCandidate(candidate));
  }, []);

  const sendFile = useCallback(async (file) => {
    const dc = dcRef.current;
    if (!dc || dc.readyState !== 'open') return;

    // Send metadata first (unencrypted — just file name/size/type)
    dc.send(JSON.stringify({ name: file.name, size: file.size, type: file.type }));

    const buffer = await file.arrayBuffer();
    let offset = 0;
    const totalSize = buffer.byteLength;
    startTime.current = Date.now();

    const sendNext = async () => {
      while (offset < totalSize) {
        // Back-pressure control for large files
        if (dc.bufferedAmount > 16 * 1024 * 1024) {
          dc.bufferedAmountLowThreshold = 8 * 1024 * 1024;
          dc.onbufferedamountlow = () => {
            dc.onbufferedamountlow = null;
            sendNext();
          };
          return;
        }

        const chunk = buffer.slice(offset, offset + CHUNK_SIZE);

        // Encrypt chunk if encryption is enabled
        if (encryptChunk) {
          const encrypted = await encryptChunk(chunk);
          dc.send(encrypted);
        } else {
          dc.send(chunk);
        }

        offset += CHUNK_SIZE;
        const percent = Math.min(100, Math.round((offset / totalSize) * 100));
        const elapsed = (Date.now() - startTime.current) / 1000;
        const speed = elapsed > 0 ? Math.min(offset, totalSize) / elapsed : 0;
        onProgress?.({ percent, speed, sent: Math.min(offset, totalSize), total: totalSize });
      }
    };

    await sendNext();
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

  return { createOffer, handleOffer, handleAnswer, handleIceCandidate, sendFile, getConnectionInfo, cleanup };
}
