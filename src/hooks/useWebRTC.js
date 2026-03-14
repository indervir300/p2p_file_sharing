import { useRef, useCallback } from 'react';

const CHUNK_SIZE = 64 * 1024;

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
];

function makeTransferId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function useWebRTC({
  onSignal,
  onProgress,
  onFileMeta,
  onFileReceived,
  onConnected,
  onTransferError,
  onChatMessage,
  onTyping,
  onReaction,       // ← NEW: ({ msgId, emoji, fromPeer })
  onStats,
  onStateChange,
  encryptChunk,
  decryptChunk,
  wsSend,
}) {
  const pcRef             = useRef(null);
  const dcRef             = useRef(null);
  const recvBuffers       = useRef([]);
  const recvSize          = useRef(0);
  const fileMeta          = useRef(null);
  const startTime         = useRef(null);
  const sendingRef        = useRef(false);
  const pendingCandidates = useRef([]);
  const isRelayMode       = useRef(false);

  // Stats
  const statsIntervalRef  = useRef(null);
  const lastBytesRef      = useRef({ sent: 0, received: 0, time: 0 });
  const onStatsRef        = useRef(onStats);
  onStatsRef.current      = onStats;

  // ── Resumable transfer refs ────────────────────────────────────────
  // Sender side
  const pendingTransferRef = useRef(null);
  // { transferId, buffer: ArrayBuffer, totalSize, ackedOffset, file }

  // Receiver side
  const recvTransferRef = useRef(null);
  // { transferId, receivedBytes }

  // Signal to abort current sendFile loop (for mid-transfer relay switch)
  const abortSendRef = useRef(false);

  // ── Internal send-back (receiver → sender control messages) ───────
  // Used for ACKs and resume requests
  const sendControl = useCallback((payload) => {
    if (isRelayMode.current) {
      wsSend?.({ type: 'relay', payload });
    } else {
      const dc = dcRef.current;
      if (dc?.readyState === 'open') dc.send(JSON.stringify(payload));
    }
  }, [wsSend]);

  // ── Stats polling ──────────────────────────────────────────────────
  const startStatsPolling = useCallback(() => {
    if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
    lastBytesRef.current = { sent: 0, received: 0, time: 0 };

    statsIntervalRef.current = setInterval(async () => {
      const pc = pcRef.current;
      if (!pc) return;

      if (isRelayMode.current) {
        onStatsRef.current?.({ rtt: null, bandwidth: null, sentPerSec: 0, recvPerSec: 0, mode: 'relay' });
        return;
      }

      try {
        const stats = await pc.getStats();
        let rtt = null, bandwidth = null, bytesSent = 0, bytesReceived = 0;

        stats.forEach((report) => {
          if (report.type === 'candidate-pair' && report.nominated) {
            if (report.currentRoundTripTime != null)    rtt       = Math.round(report.currentRoundTripTime * 1000);
            if (report.availableOutgoingBitrate != null) bandwidth = Math.round(report.availableOutgoingBitrate / 1024);
          }
          if (report.type === 'transport') {
            bytesSent     = report.bytesSent     || 0;
            bytesReceived = report.bytesReceived || 0;
          }
        });

        const now     = Date.now();
        const last    = lastBytesRef.current;
        const elapsed = last.time > 0 ? (now - last.time) / 1000 : 1;
        const sentPerSec = last.time > 0 ? Math.max(0, (bytesSent - last.sent) / elapsed)         : 0;
        const recvPerSec = last.time > 0 ? Math.max(0, (bytesReceived - last.received) / elapsed) : 0;

        lastBytesRef.current = { sent: bytesSent, received: bytesReceived, time: now };
        onStatsRef.current?.({ rtt, bandwidth, sentPerSec, recvPerSec, mode: 'direct' });
      } catch { /* unavailable */ }
    }, 1000);
  }, []);

  const stopStatsPolling = useCallback(() => {
    clearInterval(statsIntervalRef.current);
    statsIntervalRef.current = null;
    lastBytesRef.current = { sent: 0, received: 0, time: 0 };
  }, []);

  // ── Core send-buffer function (used by sendFile + resume) ──────────
  const sendBuffer = useCallback(async ({ transferId, buffer, fromOffset = 0, totalSize, isMeta, metaPayload }) => {
    const dc = dcRef.current;

    if (isMeta) {
      const payload = { ...metaPayload, transferId, fromOffset };
      if (isRelayMode.current) {
        wsSend?.({ type: 'relay', payload });
      } else {
        if (!dc || dc.readyState !== 'open') return false;
        dc.send(JSON.stringify(payload));
      }
    }

    let offset = fromOffset;
    startTime.current = fromOffset === 0 ? Date.now() : startTime.current;

    while (offset < buffer.byteLength) {
      // Abort signal — relay switched mid-transfer
      if (abortSendRef.current) {
        abortSendRef.current = false;
        return false; // caller will resume via relay
      }

      if (isRelayMode.current) {
        const rawChunk = buffer.slice(offset, offset + CHUNK_SIZE);
        let encoded;
        if (encryptChunk) {
          const encrypted = await encryptChunk(rawChunk);
          encoded = btoa(String.fromCharCode(...new Uint8Array(encrypted)));
        } else {
          encoded = btoa(String.fromCharCode(...new Uint8Array(rawChunk)));
        }
        wsSend?.({ type: 'relay', payload: { kind: 'chunk', transferId, data: encoded, encrypted: !!encryptChunk } });
      } else {
        const dc2 = dcRef.current;
        if (!dc2 || dc2.readyState !== 'open') {
          // DC died — store progress and wait for resume-request
          if (pendingTransferRef.current) {
            pendingTransferRef.current.ackedOffset = offset;
          }
          return false;
        }

        if (dc2.bufferedAmount > 16 * 1024 * 1024) {
          dc2.bufferedAmountLowThreshold = 8 * 1024 * 1024;
          await new Promise((resolve) => {
            dc2.onbufferedamountlow = () => { dc2.onbufferedamountlow = null; resolve(); };
          });
        }

        const chunk = buffer.slice(offset, offset + CHUNK_SIZE);
        if (encryptChunk) {
          dc2.send(await encryptChunk(chunk));
        } else {
          dc2.send(chunk);
        }
      }

      offset += CHUNK_SIZE;
      const sent    = Math.min(offset, buffer.byteLength);
      const percent = Math.min(99, Math.round((sent / buffer.byteLength) * 100));
      const elapsed = (Date.now() - startTime.current) / 1000;
      const speed   = elapsed > 0 ? (sent - fromOffset) / elapsed : 0;
      onProgress?.({ percent, speed, sent, total: totalSize });

      // Yield every 10 chunks to keep UI responsive
      if (Math.floor(offset / CHUNK_SIZE) % 10 === 0) {
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    return true; // completed successfully
  }, [encryptChunk, wsSend, onProgress]);

  // ── Shared chunk receiver ──────────────────────────────────────────
  const processIncomingChunk = useCallback(async (rawChunk, isBase64 = false) => {
    const meta = fileMeta.current;
    if (!meta) return;

    let chunk = isBase64
      ? Uint8Array.from(atob(rawChunk), (c) => c.charCodeAt(0)).buffer
      : rawChunk;

    if (meta.encrypted) {
      if (!decryptChunk) { onTransferError?.('Missing decryption key.'); return; }
      try { chunk = await decryptChunk(chunk); }
      catch { onTransferError?.('Could not decrypt chunk.'); return; }
    }

    recvBuffers.current.push(chunk);
    recvSize.current += chunk.byteLength;

    // Update receiver-side resume tracking
    if (recvTransferRef.current) {
      recvTransferRef.current.receivedBytes = recvSize.current;
    }

    // Send ACK every 16 chunks so sender knows safe resume point
    const chunkCount = Math.floor(recvSize.current / CHUNK_SIZE);
    if (chunkCount > 0 && chunkCount % 16 === 0 && recvTransferRef.current) {
      sendControl({
        kind: 'transfer-ack',
        transferId: recvTransferRef.current.transferId,
        offset: recvSize.current,
      });
    }

    const percent = Math.min(99, Math.round((recvSize.current / meta.size) * 100));
    const elapsed = (Date.now() - startTime.current) / 1000;
    const speed   = elapsed > 0 ? recvSize.current / elapsed : 0;
    onProgress?.({ percent, speed, received: Math.min(recvSize.current, meta.size), total: meta.size });
  }, [decryptChunk, onTransferError, onProgress, sendControl]);

  const processTransferDone = useCallback(() => {
    const meta = fileMeta.current;
    if (!meta) return;

    if (recvSize.current !== meta.size) {
      onTransferError?.('Transfer integrity check failed. Please retry.');
      recvBuffers.current = [];
      recvSize.current    = 0;
      fileMeta.current    = null;
      recvTransferRef.current = null;
      return;
    }

    const blob = new Blob(recvBuffers.current, { type: meta.type || 'application/octet-stream' });
    onProgress?.({ percent: 100, speed: 0, received: meta.size, total: meta.size });
    onFileReceived?.({ blob, name: meta.name, size: meta.size });

    recvBuffers.current = [];
    recvSize.current    = 0;
    fileMeta.current    = null;
    recvTransferRef.current = null;
  }, [onTransferError, onProgress, onFileReceived]);

  // ── Handle all incoming control/data messages (shared logic) ──────
  const processMessage = useCallback(async (message) => {
    const { kind } = message;

    if (kind === 'typing')   { onTyping?.(); return; }

    if (kind === 'reaction') {
      onReaction?.({ msgId: message.msgId, emoji: message.emoji, fromPeer: true });
      return;
    }

    if (kind === 'chat') {
      onChatMessage?.({ text: message.text, timestamp: message.timestamp, id: message.id });
      return;
    }

    // ── Resumable: incoming ACK (sender receives this) ──────────────
    if (kind === 'transfer-ack') {
      if (pendingTransferRef.current?.transferId === message.transferId) {
        pendingTransferRef.current.ackedOffset = message.offset;
      }
      return;
    }

    // ── Resumable: peer requests resume from offset ─────────────────
    if (kind === 'resume-request') {
      const pending = pendingTransferRef.current;
      if (pending?.transferId === message.transferId && pending?.buffer) {
        // Re-send meta then resume from acked offset
        const resumeFrom = message.offset;
        onProgress?.({ percent: Math.round((resumeFrom / pending.totalSize) * 100), speed: 0, sent: resumeFrom, total: pending.totalSize });
        const done = await sendBuffer({
          transferId:  pending.transferId,
          buffer:      pending.buffer,
          fromOffset:  resumeFrom,
          totalSize:   pending.totalSize,
          isMeta:      true,
          metaPayload: pending.metaPayload,
        });
        if (done) {
          const transport = isRelayMode.current ? wsSend?.({ type: 'relay', payload: { kind: 'done', transferId: pending.transferId } }) : dcRef.current?.send(JSON.stringify({ kind: 'done', transferId: pending.transferId }));
          onProgress?.({ percent: 100, speed: 0, sent: pending.totalSize, total: pending.totalSize });
          pendingTransferRef.current = null;
        }
      }
      return;
    }

    if (kind === 'meta') {
      const isResume = !!message.fromOffset;
      if (isResume && recvTransferRef.current?.transferId === message.transferId) {
        // Already have some data — continue receiving from fromOffset
        startTime.current = Date.now();
        return;
      }
      // Fresh transfer
      fileMeta.current = { name: message.name, size: message.size, type: message.type, encrypted: !!message.encrypted };
      recvBuffers.current = [];
      recvSize.current    = 0;
      startTime.current   = Date.now();
      recvTransferRef.current = { transferId: message.transferId, receivedBytes: 0 };
      onFileMeta?.({ name: message.name, size: message.size, type: message.type });
      return;
    }

    if (kind === 'done') { processTransferDone(); }
  }, [onTyping, onReaction, onChatMessage, onProgress, onFileMeta, processTransferDone, sendBuffer, wsSend]);

  // ── DataChannel setup ──────────────────────────────────────────────
  const setupDataChannel = useCallback((dc) => {
    dc.binaryType = 'arraybuffer';

    dc.onopen = () => {
      console.log('DataChannel OPEN');
      onConnected?.();
      startStatsPolling();

      // If receiver has incomplete transfer, request resume
      if (recvTransferRef.current) {
        sendControl({
          kind: 'resume-request',
          transferId: recvTransferRef.current.transferId,
          offset:     recvTransferRef.current.receivedBytes,
        });
      }
    };

    dc.onerror  = (err) => console.error('DataChannel Error:', err);
    dc.onclose  = () => { console.log('DataChannel CLOSED'); stopStatsPolling(); };

    dc.onmessage = async ({ data }) => {
      if (typeof data === 'string') {
        let message;
        try { message = JSON.parse(data); } catch { return; }
        await processMessage(message);
      } else {
        await processIncomingChunk(data, false);
      }
    };
  }, [onConnected, startStatsPolling, stopStatsPolling, processMessage, processIncomingChunk, sendControl]);

  // ── WS Relay incoming ──────────────────────────────────────────────
  const handleRelayMessage = useCallback(async (payload) => {
    if (!payload?.kind) return;

    if (payload.kind === 'relay-connected') {
      if (!isRelayMode.current) {
        isRelayMode.current = true;
        abortSendRef.current = true; // signal sendBuffer loop to stop
        onStateChange?.('relay');
        onConnected?.();
        startStatsPolling();

        // If receiver has incomplete transfer, request resume via relay
        if (recvTransferRef.current) {
          wsSend?.({ type: 'relay', payload: {
            kind: 'resume-request',
            transferId: recvTransferRef.current.transferId,
            offset:     recvTransferRef.current.receivedBytes,
          }});
        }
      }
      return;
    }

    if (payload.kind === 'chunk') {
      await processIncomingChunk(payload.data, true);
      return;
    }

    await processMessage(payload);
  }, [onStateChange, onConnected, startStatsPolling, processMessage, processIncomingChunk, wsSend]);

  // ── Peer Connection ────────────────────────────────────────────────
  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) onSignal({ type: 'ice-candidate', payload: candidate });
    };

    pc.oniceconnectionstatechange = () => {
      console.log('ICE State:', pc.iceConnectionState);
      onStateChange?.(pc.iceConnectionState);

      if (pc.iceConnectionState === 'failed') {
        isRelayMode.current  = true;
        abortSendRef.current = true;
        onStateChange?.('relay');
        wsSend?.({ type: 'relay', payload: { kind: 'relay-connected' } });
        onConnected?.();
        startStatsPolling();
      }

      if (pc.iceConnectionState === 'disconnected') {
        setTimeout(() => {
          if (pc.iceConnectionState !== 'connected' && pc.iceConnectionState !== 'completed') {
            isRelayMode.current  = true;
            abortSendRef.current = true;
            onStateChange?.('relay');
            wsSend?.({ type: 'relay', payload: { kind: 'relay-connected' } });
            onConnected?.();
            startStatsPolling();
          }
        }, 4000);
      }
    };

    pc.onconnectionstatechange = () => console.log('Peer Connection State:', pc.connectionState);
    pcRef.current = pc;
    return pc;
  }, [onSignal, onStateChange, onConnected, wsSend, startStatsPolling]);

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
    pc.ondatachannel = ({ channel }) => { dcRef.current = channel; setupDataChannel(channel); };
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    while (pendingCandidates.current.length > 0) {
      await pc.addIceCandidate(new RTCIceCandidate(pendingCandidates.current.shift())).catch((e) => console.warn(e));
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
      await pc.addIceCandidate(new RTCIceCandidate(pendingCandidates.current.shift())).catch((e) => console.warn(e));
    }
  }, []);

  const handleIceCandidate = useCallback(async (candidate) => {
    const pc = pcRef.current;
    if (pc && pc.remoteDescription?.type) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch((e) => console.warn(e));
    } else {
      pendingCandidates.current.push(candidate);
    }
  }, []);

  // ── Typing ─────────────────────────────────────────────────────────
  const sendTyping = useCallback(() => {
    if (isRelayMode.current) { wsSend?.({ type: 'relay', payload: { kind: 'typing' } }); return; }
    const dc = dcRef.current;
    if (dc?.readyState === 'open') dc.send(JSON.stringify({ kind: 'typing' }));
  }, [wsSend]);

  // ── Chat ───────────────────────────────────────────────────────────
  const sendChatMessage = useCallback((text) => {
    const id = makeTransferId();
    const payload = { kind: 'chat', text, timestamp: Date.now(), id };
    if (isRelayMode.current) { wsSend?.({ type: 'relay', payload }); return true; }
    const dc = dcRef.current;
    if (!dc || dc.readyState !== 'open') return false;
    dc.send(JSON.stringify(payload));
    return true;
  }, [wsSend]);

  // ── Reaction ───────────────────────────────────────────────────────
  const sendReaction = useCallback((msgId, emoji) => {
    const payload = { kind: 'reaction', msgId, emoji };
    if (isRelayMode.current) { wsSend?.({ type: 'relay', payload }); return; }
    const dc = dcRef.current;
    if (dc?.readyState === 'open') dc.send(JSON.stringify(payload));
  }, [wsSend]);

  // ── File send ──────────────────────────────────────────────────────
  const sendFile = useCallback(async (file) => {
    if (sendingRef.current) return;
    sendingRef.current = true;

    const transferId   = makeTransferId();
    const metaPayload  = { kind: 'meta', version: 2, name: file.name, size: file.size, type: file.type, encrypted: !!encryptChunk };

    try {
      const buffer = await file.arrayBuffer();
      pendingTransferRef.current = { transferId, buffer, totalSize: file.size, ackedOffset: 0, metaPayload, file };
      abortSendRef.current = false;

      const done = await sendBuffer({
        transferId,
        buffer,
        fromOffset:  0,
        totalSize:   file.size,
        isMeta:      true,
        metaPayload,
      });

      if (done) {
        // Send done signal
        const donePayload = JSON.stringify({ kind: 'done', transferId });
        if (isRelayMode.current) {
          wsSend?.({ type: 'relay', payload: { kind: 'done', transferId } });
        } else {
          dcRef.current?.send(donePayload);
        }
        onProgress?.({ percent: 100, speed: 0, sent: file.size, total: file.size });
        pendingTransferRef.current = null;
      }
      // If !done: aborted mid-way — pendingTransferRef stays alive for resume-request
    } finally {
      sendingRef.current = false;
    }
  }, [encryptChunk, wsSend, onProgress, sendBuffer]);

  // ── Connection info ────────────────────────────────────────────────
  const getConnectionInfo = useCallback(async () => {
    if (isRelayMode.current) return { type: 'relay', relayed: true, protocol: 'websocket' };
    const pc = pcRef.current;
    if (!pc) return null;
    try {
      const stats = await pc.getStats();
      for (const [, report] of stats) {
        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          const local  = stats.get(report.localCandidateId);
          const remote = stats.get(report.remoteCandidateId);
          return {
            type:     local?.candidateType || 'unknown',
            relayed:  local?.candidateType === 'relay' || remote?.candidateType === 'relay',
            protocol: local?.protocol || 'unknown',
          };
        }
      }
    } catch { /* unavailable */ }
    return null;
  }, []);

  // ── Cleanup ────────────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    stopStatsPolling();
    abortSendRef.current    = true;
    dcRef.current?.close();
    pcRef.current?.close();
    dcRef.current           = null;
    pcRef.current           = null;
    recvBuffers.current     = [];
    recvSize.current        = 0;
    fileMeta.current        = null;
    isRelayMode.current     = false;
    pendingTransferRef.current = null;
    recvTransferRef.current = null;
  }, [stopStatsPolling]);

  return {
    createOffer,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    sendFile,
    sendChatMessage,
    sendTyping,
    sendReaction,          // ← NEW
    getConnectionInfo,
    cleanup,
    handleRelayMessage,
  };
}
