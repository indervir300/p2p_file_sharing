import { useRef, useCallback, useState, useEffect } from 'react';

const CHUNK_SIZE = 64 * 1024;

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
];

function makeId() {
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
  onTransferCanceled,
  onTransferPaused,   // ← NEW: called when mid-transfer connection drops
  onChatMessage,
  onTyping,
  onReaction,
  onWhiteboardEvent,
  onMessageEdit,
  onMessageDelete,
  onLinkPreview,
  onStateChange,
  onMediaError,
  onMeetingStart,
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

  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [remoteAudioMuted, setRemoteAudioMuted] = useState(false);
  const [remoteVideoOff, setRemoteVideoOff] = useState(false);
  const screenStreamRef  = useRef(null);
  const screenSenderRef  = useRef(null); // sender being used during an active screen share
  const localStreamRef   = useRef(null); // always-current mirror of localStream state

  // Keep localStreamRef in sync with state so callbacks can read it without
  // capturing a stale closure value.
  useEffect(() => { localStreamRef.current = localStream; }, [localStream]);

  // ── Resumable transfer refs ────────────────────────────────────────
  const pendingTransferRef = useRef(null); // sender side
  const recvTransferRef    = useRef(null); // receiver side
  const abortSendRef       = useRef(false);

  // ── How many chunks received since last ack ────────────────────────
  const chunksSinceAck = useRef(0);

  // ── Control message sender ─────────────────────────────────────────
  const sendControl = useCallback((payload) => {
    if (isRelayMode.current) { wsSend?.({ type: 'relay', payload }); return; }
    const dc = dcRef.current;
    if (dc?.readyState === 'open') dc.send(JSON.stringify(payload));
  }, [wsSend]);

  // ── Helpers ────────────────────────────────────────────────────────
  const sendDone = useCallback((transferId) => {
    const payload = { kind: 'done', transferId };
    isRelayMode.current
      ? wsSend?.({ type: 'relay', payload })
      : dcRef.current?.send(JSON.stringify(payload));
  }, [wsSend]);

  const resetReceiveTransfer = useCallback(() => {
    recvBuffers.current = [];
    recvSize.current = 0;
    fileMeta.current = null;
    recvTransferRef.current = null;
    chunksSinceAck.current = 0;
  }, []);

  // ── Core send-buffer ───────────────────────────────────────────────
  const sendBuffer = useCallback(async ({
    transferId, buffer, fromOffset = 0,
    totalSize, isMeta, metaPayload,
  }) => {
    if (isMeta) {
      const payload = { ...metaPayload, transferId, fromOffset };
      if (isRelayMode.current) {
        wsSend?.({ type: 'relay', payload });
      } else {
        const dc = dcRef.current;
        if (!dc || dc.readyState !== 'open') return false;
        dc.send(JSON.stringify(payload));
      }
    }

    let offset = fromOffset;
    startTime.current = fromOffset === 0
      ? Date.now()
      : (startTime.current || Date.now());

    while (offset < buffer.byteLength) {

      // ── Abort: save exact byte offset so we can resume precisely ──
      if (abortSendRef.current) {
        abortSendRef.current = false;
        if (pendingTransferRef.current) {
          // Align to last complete chunk boundary for safety
          const safeOffset = Math.floor(offset / CHUNK_SIZE) * CHUNK_SIZE;
          pendingTransferRef.current.savedOffset = safeOffset;
        }
        return false;
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
        wsSend?.({ type: 'relay', payload: {
          kind: 'chunk', transferId, data: encoded, encrypted: !!encryptChunk,
        }});
      } else {
        const dc = dcRef.current;
        if (!dc || dc.readyState !== 'open') {
          // Connection lost mid-transfer — save offset
          if (pendingTransferRef.current) {
            const safeOffset = Math.floor(offset / CHUNK_SIZE) * CHUNK_SIZE;
            pendingTransferRef.current.savedOffset = safeOffset;
          }
          return false;
        }
        if (dc.bufferedAmount > 16 * 1024 * 1024) {
          dc.bufferedAmountLowThreshold = 8 * 1024 * 1024;
          await new Promise((resolve) => {
            dc.onbufferedamountlow = () => { dc.onbufferedamountlow = null; resolve(); };
          });
        }
        const chunk = buffer.slice(offset, offset + CHUNK_SIZE);
        dc.send(encryptChunk ? await encryptChunk(chunk) : chunk);
      }

      offset += CHUNK_SIZE;
      const sent    = Math.min(offset, buffer.byteLength);
      const percent = Math.min(99, Math.round((sent / totalSize) * 100));
      const elapsed = (Date.now() - startTime.current) / 1000;
      const speed   = elapsed > 0 ? (sent - fromOffset) / elapsed : 0;
      onProgress?.({ percent, speed, sent, total: totalSize });

      if (Math.floor(offset / CHUNK_SIZE) % 10 === 0)
        await new Promise((r) => setTimeout(r, 0));
    }
    return true;
  }, [encryptChunk, wsSend, onProgress]);

  // ── Incoming chunk processor ───────────────────────────────────────
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
    chunksSinceAck.current += 1;

    if (recvTransferRef.current)
      recvTransferRef.current.receivedBytes = recvSize.current;

    // Acknowledge every 16 chunks so sender knows safe resume point
    if (chunksSinceAck.current >= 16 && recvTransferRef.current) {
      chunksSinceAck.current = 0;
      sendControl({
        kind: 'transfer-ack',
        transferId: recvTransferRef.current.transferId,
        offset: recvSize.current,
      });
    }

    const percent = Math.min(99, Math.round((recvSize.current / meta.size) * 100));
    const elapsed = (Date.now() - startTime.current) / 1000;
    const speed   = elapsed > 0 ? recvSize.current / elapsed : 0;
    onProgress?.({
      percent, speed,
      received: Math.min(recvSize.current, meta.size),
      total: meta.size,
    });
  }, [decryptChunk, onTransferError, onProgress, sendControl]);

  // ── Transfer done ──────────────────────────────────────────────────
  const processTransferDone = useCallback(() => {
    const meta = fileMeta.current;
    if (!meta) return;
    if (recvSize.current !== meta.size) {
      onTransferError?.('Transfer integrity check failed. Please retry.');
      recvBuffers.current = []; recvSize.current = 0;
      fileMeta.current = null; recvTransferRef.current = null;
      chunksSinceAck.current = 0;
      return;
    }
    const blob = new Blob(recvBuffers.current, {
      type: meta.type || 'application/octet-stream',
    });
    onProgress?.({ percent: 100, speed: 0, received: meta.size, total: meta.size });
    onFileReceived?.({ blob, name: meta.name, size: meta.size });
    recvBuffers.current = []; recvSize.current = 0;
    fileMeta.current = null; recvTransferRef.current = null;
    chunksSinceAck.current = 0;
  }, [onTransferError, onProgress, onFileReceived]);

  // ── Resume helpers ─────────────────────────────────────────────────
  // Called by RECEIVER when channel re-opens (DataChannel or relay)
  const sendResumeRequest = useCallback(() => {
    const recv = recvTransferRef.current;
    if (!recv) return;
    // Align to chunk boundary so sender re-sends full chunks
    const safeOffset = Math.floor(recv.receivedBytes / CHUNK_SIZE) * CHUNK_SIZE;
    // Truncate receiver buffer to safe boundary
    if (safeOffset < recv.receivedBytes) {
      let cumulative = 0;
      const safeBufs = [];
      for (const buf of recvBuffers.current) {
        if (cumulative + buf.byteLength <= safeOffset) {
          safeBufs.push(buf);
          cumulative += buf.byteLength;
        } else if (cumulative < safeOffset) {
          safeBufs.push(buf.slice(0, safeOffset - cumulative));
          cumulative = safeOffset;
          break;
        } else break;
      }
      recvBuffers.current = safeBufs;
      recvSize.current = safeOffset;
      recv.receivedBytes = safeOffset;
    }
    chunksSinceAck.current = 0;
    sendControl({
      kind: 'resume-request',
      transferId: recv.transferId,
      offset: safeOffset,
    });
  }, [sendControl]);

  // ── Central message processor ──────────────────────────────────────
  const processMessage = useCallback(async (message) => {
    const { kind } = message;

    if (kind?.startsWith('wb-')) { onWhiteboardEvent?.(message); return; }
    if (kind === 'typing')       { onTyping?.(); return; }
    if (kind === 'meeting-start'){ onMeetingStart?.(); return; }
    if (kind === 'media-state') {
      if (message.audioMuted !== undefined) setRemoteAudioMuted(message.audioMuted);
      // Apply videoOff first, then let screenSharing=true override it
      if (message.videoOff !== undefined) setRemoteVideoOff(message.videoOff);
      if (message.screenSharing === true) setRemoteVideoOff(false);
      return;
    }

    if (kind === 'reaction') {
      onReaction?.({ msgId: message.msgId, emoji: message.emoji, fromPeer: true });
      return;
    }

    if (kind === 'chat') {
      onChatMessage?.({
        text: message.text, timestamp: message.timestamp,
        id: message.id, replyTo: message.replyTo || null,
      });
      return;
    }

    if (kind === 'edit') { onMessageEdit?.({ id: message.id, newText: message.newText }); return; }
    if (kind === 'delete') { onMessageDelete?.({ id: message.id }); return; }
    if (kind === 'link-preview') { onLinkPreview?.({ msgId: message.msgId, preview: message.preview }); return; }

    if (kind === 'transfer-ack') {
      // Update sender's safe resume point — use receiver's offset (more accurate)
      if (pendingTransferRef.current?.transferId === message.transferId) {
        pendingTransferRef.current.ackedOffset = message.offset;
      }
      return;
    }

    if (kind === 'resume-request') {
      const pending = pendingTransferRef.current;
      if (!pending || pending.transferId !== message.transferId || !pending.buffer) return;

      // Use receiver's reported offset — it's ground truth
      const resumeFrom = message.offset;
      console.log(`[Resume] Sender resuming from byte ${resumeFrom} / ${pending.totalSize}`);

      onProgress?.({
        percent: Math.round((resumeFrom / pending.totalSize) * 100),
        speed: 0, sent: resumeFrom, total: pending.totalSize,
      });

      // Small delay to let relay/channel fully stabilise
      await new Promise((r) => setTimeout(r, 300));

      const done = await sendBuffer({
        transferId: pending.transferId,
        buffer:     pending.buffer,
        fromOffset: resumeFrom,
        totalSize:  pending.totalSize,
        isMeta:     true,
        metaPayload: { ...pending.metaPayload, fromOffset: resumeFrom },
      });

      if (done) {
        sendDone(pending.transferId);
        onProgress?.({ percent: 100, speed: 0, sent: pending.totalSize, total: pending.totalSize });
        pendingTransferRef.current = null;
      }
      return;
    }

    if (kind === 'transfer-cancel') {
      const canceledSender = pendingTransferRef.current?.transferId === message.transferId;
      const canceledReceiver = recvTransferRef.current?.transferId === message.transferId;

      if (canceledSender) {
        abortSendRef.current = true;
        pendingTransferRef.current = null;
        sendingRef.current = false;
        onTransferCanceled?.({ transferId: message.transferId, sender: 'me' });
      }

      if (canceledReceiver) {
        resetReceiveTransfer();
        onTransferCanceled?.({ transferId: message.transferId, sender: 'peer' });
      }
      return;
    }

    if (kind === 'meta') {
      // Resume: same transferId and we already have bytes
      const isResume = !!message.fromOffset &&
        recvTransferRef.current?.transferId === message.transferId;
      if (isResume) {
        console.log(`[Resume] Receiver resuming — already have ${recvSize.current} bytes`);
        startTime.current = Date.now();
        return;
      }
      // Fresh transfer
      fileMeta.current = {
        name: message.name, size: message.size,
        type: message.type, encrypted: !!message.encrypted,
      };
      recvBuffers.current = []; recvSize.current = 0;
      chunksSinceAck.current = 0;
      startTime.current = Date.now();
      recvTransferRef.current = { transferId: message.transferId, receivedBytes: 0 };
      onFileMeta?.({
        transferId: message.transferId,
        name: message.name,
        size: message.size,
        type: message.type,
      });
      return;
    }

    if (kind === 'done') processTransferDone();
  }, [
    onTyping, onReaction, onChatMessage, onWhiteboardEvent,
    onMessageEdit, onMessageDelete, onLinkPreview,
    onProgress, onFileMeta, processTransferDone, sendBuffer, sendDone, wsSend,
  ]);

  // ── DataChannel setup ──────────────────────────────────────────────
  const setupDataChannel = useCallback((dc) => {
    dc.binaryType = 'arraybuffer';

    dc.onopen = () => {
      console.log('DataChannel OPEN');
      onConnected?.();
      // Receiver auto-resumes if mid-transfer
      if (recvTransferRef.current) {
        console.log('[Resume] DataChannel reopened — sending resume-request');
        sendResumeRequest();
      }
    };

    dc.onerror = (err) => {
      console.error('DataChannel Error:', err);
      // Notify UI that active transfer is paused
      if (recvTransferRef.current || pendingTransferRef.current) {
        onTransferPaused?.();
      }
    };

    dc.onclose = () => {
      console.log('DataChannel CLOSED');
      if (recvTransferRef.current || pendingTransferRef.current) {
        onTransferPaused?.();
      }
    };

    dc.onmessage = async ({ data }) => {
      if (typeof data === 'string') {
        let message;
        try { message = JSON.parse(data); } catch { return; }
        await processMessage(message);
      } else {
        await processIncomingChunk(data, false);
      }
    };
  }, [onConnected, onTransferPaused, processMessage, processIncomingChunk, sendResumeRequest]);

  // ── WS Relay incoming ──────────────────────────────────────────────
  const handleRelayMessage = useCallback(async (payload) => {
    if (!payload?.kind) return;

    if (payload.kind === 'relay-connected') {
      if (!isRelayMode.current) {
        isRelayMode.current  = true;
        abortSendRef.current = true;   // abort current P2P send
        onStateChange?.('relay');
        onConnected?.();

        // Receiver: request resume via relay
        if (recvTransferRef.current) {
          console.log('[Resume] Relay connected — receiver sending resume-request via relay');
          // Small delay to let sender's relay mode fully activate
          await new Promise((r) => setTimeout(r, 400));
          sendResumeRequest();
        }

        // Sender: if we have a pending transfer, wait for receiver's resume-request
        if (pendingTransferRef.current) {
          onTransferPaused?.();
          console.log('[Resume] Relay connected — sender waiting for resume-request');
        }
      }
      return;
    }

    if (payload.kind === 'chunk') { await processIncomingChunk(payload.data, true); return; }
    await processMessage(payload);
  }, [
    onStateChange, onConnected, onTransferPaused,
    processMessage, processIncomingChunk, sendResumeRequest,
  ]);

  // ── Peer Connection ────────────────────────────────────────────────
  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    // Use ref so we always read the current stream even if called from a stale closure
    const currentStream = localStreamRef.current;
    if (currentStream) {
      currentStream.getTracks().forEach(track => {
        pc.addTrack(track, currentStream);
      });
    }

    pc.ontrack = (event) => {
       if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
       }
    };

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) onSignal({ type: 'ice-candidate', payload: candidate });
    };

    pc.oniceconnectionstatechange = () => {
      console.log('ICE State:', pc.iceConnectionState);
      onStateChange?.(pc.iceConnectionState);

      if (pc.iceConnectionState === 'disconnected') {
        if (recvTransferRef.current || pendingTransferRef.current) {
          onTransferPaused?.();
          console.log('[Resume] ICE disconnected — transfer paused');
        }
        // Give P2P 4 s to recover before switching to relay
        setTimeout(() => {
          if (pc.iceConnectionState !== 'connected' &&
              pc.iceConnectionState !== 'completed') {
            console.log('[Resume] ICE did not recover — switching to relay');
            isRelayMode.current  = true;
            abortSendRef.current = true;
            onStateChange?.('relay');
            wsSend?.({ type: 'relay', payload: { kind: 'relay-connected' } });
            onConnected?.();
          }
        }, 4000);
      }

      if (pc.iceConnectionState === 'failed') {
        if (recvTransferRef.current || pendingTransferRef.current) {
          onTransferPaused?.();
        }
        isRelayMode.current  = true;
        abortSendRef.current = true;
        onStateChange?.('relay');
        wsSend?.({ type: 'relay', payload: { kind: 'relay-connected' } });
        onConnected?.();
      }
    };

    pc.onconnectionstatechange = () =>
      console.log('Peer Connection State:', pc.connectionState);

    pcRef.current = pc;
    return pc;
  // Removed `localStream` from deps — we use localStreamRef.current instead
  // to avoid a stale closure (the PC is created before the meeting starts).
  }, [onSignal, onStateChange, onConnected, onTransferPaused, wsSend]);

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
    // If we already have a live peer connection (e.g. host renegotiating for
    // screen-share), reuse it — do NOT destroy it with createPeerConnection().
    const existingPc = pcRef.current;
    const isRenegotiation = existingPc &&
      existingPc.signalingState !== 'closed' &&
      existingPc.connectionState !== 'failed';

    const pc = isRenegotiation ? existingPc : createPeerConnection();

    if (!isRenegotiation) {
      pc.ondatachannel = ({ channel }) => {
        dcRef.current = channel;
        setupDataChannel(channel);
      };
    }

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    while (pendingCandidates.current.length > 0)
      await pc.addIceCandidate(
        new RTCIceCandidate(pendingCandidates.current.shift())
      ).catch(console.warn);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    onSignal({ type: 'answer', payload: answer });
  }, [createPeerConnection, setupDataChannel, onSignal]);

  const handleAnswer = useCallback(async (answer) => {
    const pc = pcRef.current;
    if (!pc) return;
    await pc.setRemoteDescription(new RTCSessionDescription(answer));
    while (pendingCandidates.current.length > 0)
      await pc.addIceCandidate(
        new RTCIceCandidate(pendingCandidates.current.shift())
      ).catch(console.warn);
  }, []);

  const handleIceCandidate = useCallback(async (candidate) => {
    const pc = pcRef.current;
    if (pc && pc.remoteDescription?.type) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.warn);
    } else {
      pendingCandidates.current.push(candidate);
    }
  }, []);

  // ── Meeting Streams ────────────────────────────────────────────────


  const broadcastMediaState = useCallback((state) => {
    const payload = { kind: 'media-state', ...state };
    if (isRelayMode.current) { wsSend?.({ type: 'relay', payload }); }
    else if (dcRef.current?.readyState === 'open') { dcRef.current.send(JSON.stringify(payload)); }
  }, [wsSend]);

  const startMeetingStreams = useCallback(async (opts = { audio: true, video: true }) => {
    let stream = null;
    let fallbackError = null;

    if (opts.audio || opts.video) {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        fallbackError = new Error('Browser media API not supported. Please ensure you are using HTTPS or localhost.');
      } else {
        try {
          stream = await navigator.mediaDevices.getUserMedia(opts);
        } catch (err) {
          // Graceful fallback if video fails but audio might work, or vice versa
          console.warn("Requested media combination failed, attempting fallback:", err);
          if (opts.audio && opts.video) {
            try {
              stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            } catch (err2) {
              try {
                stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
              } catch (err3) {
                fallbackError = err;
              }
            }
          } else {
            fallbackError = err;
          }
        }
      }

      if (stream) {
        localStreamRef.current = stream;
        setLocalStream(stream);

        // Map initial disabled states if changed during fallback
        if (!stream.getAudioTracks().length) setIsAudioMuted(true);
        if (!stream.getVideoTracks().length) setIsVideoOff(true);
      } else if (fallbackError) {
         if (onMediaError) onMediaError(fallbackError);
         setIsAudioMuted(true);
         setIsVideoOff(true);
      }
    }

    try {
      // If we already have a connection, renegotiate
      if (pcRef.current && pcRef.current.signalingState !== 'closed') {
        if (stream) {
          stream.getTracks().forEach(track => {
             pcRef.current.addTrack(track, stream);
          });
        }
        
        // Also ensure receivers are added if a user joins purely to watch without media
        if (!stream) {
           pcRef.current.addTransceiver('video', { direction: 'recvonly' });
           pcRef.current.addTransceiver('audio', { direction: 'recvonly' });
        }

        const offer = await pcRef.current.createOffer();
        await pcRef.current.setLocalDescription(offer);
        onSignal({ type: 'offer', payload: offer });
        
        // Notify other peer that the meeting officially started
        const startPayload = { kind: 'meeting-start' };
        if (isRelayMode.current) { wsSend?.({ type: 'relay', payload: startPayload }); }
        else if (dcRef.current?.readyState === 'open') { dcRef.current.send(JSON.stringify(startPayload)); }

        // Also broadcast initial state if muted/camera off
        if (stream) {
           const initialAudioMuted = !stream.getAudioTracks().length;
           const initialVideoOff = !stream.getVideoTracks().length;
           broadcastMediaState({ audioMuted: initialAudioMuted, videoOff: initialVideoOff });
        } else {
           broadcastMediaState({ audioMuted: true, videoOff: true });
        }
        
      }
    } catch (err) {
      console.warn("Negotiation failed after starting meeting:", err);
    }
  }, [onSignal, onMediaError, broadcastMediaState, wsSend]);

  const toggleAudio = useCallback(() => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioMuted(!audioTrack.enabled);
      }
    }
  }, [localStream]);

  const toggleVideo = useCallback(() => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  }, [localStream]);

  const stopMeeting = useCallback(() => {
    if (localStream) {
      localStream.getTracks().forEach(t => t.stop());
      setLocalStream(null);
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
    }
    screenSenderRef.current = null;
    if (remoteStream) {
      setRemoteStream(null);
    }
    if (pcRef.current) {
      pcRef.current.getSenders().forEach(sender => {
         if (sender.track) {
             sender.track.stop();
             pcRef.current.removeTrack(sender);
         }
      });
    }
    setIsAudioMuted(false);
    setIsVideoOff(false);
    setIsScreenSharing(false);
    
    // Explicitly notify remote that we stopped
    const payload = { kind: 'media-state', meetingStopped: true };
    if (isRelayMode.current) { wsSend?.({ type: 'relay', payload }); }
    else if (dcRef.current?.readyState === 'open') { dcRef.current.send(JSON.stringify(payload)); }
    
  }, [localStream, remoteStream, wsSend]);

  const toggleScreenShare = useCallback(async () => {
    if (!pcRef.current) return;
    try {
      if (isScreenSharing && screenStreamRef.current) {
        // ── Stop screen sharing ──────────────────────────────────────
        const screenTrack = screenStreamRef.current.getVideoTracks()[0];
        if (screenTrack) screenTrack.stop();
        screenStreamRef.current = null;

        const sender = screenSenderRef.current;
        screenSenderRef.current = null;

        if (sender) {
          const videoTrack = localStream?.getVideoTracks()[0];
          if (videoTrack?.enabled) {
            // Revert the sender back to the camera track
            await sender.replaceTrack(videoTrack);
          } else {
            // No camera to revert to — remove the sender and renegotiate
            pcRef.current.removeTrack(sender);
            const offer = await pcRef.current.createOffer();
            await pcRef.current.setLocalDescription(offer);
            onSignal({ type: 'offer', payload: offer });
          }
        }

        // Tell remote: video is off when no camera or camera is currently disabled
        const camTrack = localStream?.getVideoTracks()[0];
        setIsScreenSharing(false);
        broadcastMediaState({ screenSharing: false, videoOff: !(camTrack?.enabled) });
      } else {
        // ── Start screen sharing ─────────────────────────────────────
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = screenStream;
        const screenTrack = screenStream.getVideoTracks()[0];

        // Find an existing video sender (camera may be on or off)
        let sender = pcRef.current.getSenders().find(s => s.track?.kind === 'video');

        if (sender) {
          // Swap the camera track for the screen track (no renegotiation needed)
          await sender.replaceTrack(screenTrack);
        } else {
          // No video sender exists (user joined without camera) — add track and renegotiate
          sender = pcRef.current.addTrack(screenTrack, screenStream);
          const offer = await pcRef.current.createOffer();
          await pcRef.current.setLocalDescription(offer);
          onSignal({ type: 'offer', payload: offer });
        }

        screenSenderRef.current = sender;

        // When the user stops sharing via the browser's native stop button
        screenTrack.onended = async () => {
          const videoTrack = localStream?.getVideoTracks()[0];
          const currentSender = screenSenderRef.current;
          screenStreamRef.current = null;
          screenSenderRef.current = null;

          if (currentSender && pcRef.current) {
            if (videoTrack?.enabled) {
              await currentSender.replaceTrack(videoTrack);
            } else {
              pcRef.current.removeTrack(currentSender);
              if (pcRef.current.signalingState !== 'closed') {
                const offer = await pcRef.current.createOffer();
                await pcRef.current.setLocalDescription(offer);
                onSignal({ type: 'offer', payload: offer });
              }
            }
          }

           // Tell remote: video is off when no camera or camera is currently disabled
           const camOff = !(videoTrack?.enabled);
           setIsScreenSharing(false);
           broadcastMediaState({ screenSharing: false, videoOff: camOff });
        };

        setIsScreenSharing(true);
        // Clear the remote's "Camera Off" overlay — screen video is now active
        broadcastMediaState({ screenSharing: true, videoOff: false });
      }
    } catch (err) {
      // Clean up if getDisplayMedia was granted but setup failed
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(t => t.stop());
        screenStreamRef.current = null;
      }
      screenSenderRef.current = null;
      console.warn('Screen share error:', err);
    }
  }, [isScreenSharing, localStream, onSignal, broadcastMediaState]);

  // ── Typing ─────────────────────────────────────────────────────────
  const sendTyping = useCallback(() => {
    if (isRelayMode.current) {
      wsSend?.({ type: 'relay', payload: { kind: 'typing' } }); return;
    }
    const dc = dcRef.current;
    if (dc?.readyState === 'open') dc.send(JSON.stringify({ kind: 'typing' }));
  }, [wsSend]);

  // ── Chat ───────────────────────────────────────────────────────────
  const sendChatMessage = useCallback((text, replyTo = null) => {
    const id      = makeId();
    const payload = {
      kind: 'chat', text, timestamp: Date.now(), id,
      ...(replyTo && {
        replyTo: {
          id:     replyTo.id,
          text:   replyTo.text   || null,
          name:   replyTo.name   || null,
          type:   replyTo.type,
          sender: replyTo.sender,
        },
      }),
    };
    if (isRelayMode.current) { wsSend?.({ type: 'relay', payload }); return id; }
    const dc = dcRef.current;
    if (!dc || dc.readyState !== 'open') return false;
    dc.send(JSON.stringify(payload));
    return id;
  }, [wsSend]);

  // ── Reaction ───────────────────────────────────────────────────────
  const sendReaction = useCallback((msgId, emoji) => {
    const payload = { kind: 'reaction', msgId, emoji };
    if (isRelayMode.current) { wsSend?.({ type: 'relay', payload }); return; }
    const dc = dcRef.current;
    if (dc?.readyState === 'open') dc.send(JSON.stringify(payload));
  }, [wsSend]);

  // ── Edit ───────────────────────────────────────────────────────────
  const sendEdit = useCallback((id, newText) => {
    const payload = { kind: 'edit', id, newText };
    if (isRelayMode.current) { wsSend?.({ type: 'relay', payload }); return; }
    const dc = dcRef.current;
    if (dc?.readyState === 'open') dc.send(JSON.stringify(payload));
  }, [wsSend]);

  // ── Delete ─────────────────────────────────────────────────────────
  const sendDelete = useCallback((id) => {
    const payload = { kind: 'delete', id };
    if (isRelayMode.current) { wsSend?.({ type: 'relay', payload }); return; }
    const dc = dcRef.current;
    if (dc?.readyState === 'open') dc.send(JSON.stringify(payload));
  }, [wsSend]);

  // ── Link preview ───────────────────────────────────────────────────
  const sendLinkPreview = useCallback((msgId, preview) => {
    const payload = { kind: 'link-preview', msgId, preview };
    if (isRelayMode.current) { wsSend?.({ type: 'relay', payload }); return; }
    const dc = dcRef.current;
    if (dc?.readyState === 'open') dc.send(JSON.stringify(payload));
  }, [wsSend]);

  // ── Whiteboard ─────────────────────────────────────────────────────
  const sendWhiteboardEvent = useCallback((event) => {
    if (isRelayMode.current) { wsSend?.({ type: 'relay', payload: event }); return; }
    const dc = dcRef.current;
    if (dc?.readyState === 'open') dc.send(JSON.stringify(event));
  }, [wsSend]);

  // ── File send ──────────────────────────────────────────────────────
  const sendFile = useCallback(async (file, transferId = makeId()) => {
    if (sendingRef.current) return;
    sendingRef.current = true;
    const metaPayload = {
      kind: 'meta', version: 2,
      name: file.name, size: file.size,
      type: file.type, encrypted: !!encryptChunk,
    };
    try {
      const buffer = await file.arrayBuffer();
      pendingTransferRef.current = {
        transferId,
        buffer,
        totalSize:   file.size,
        ackedOffset: 0,
        savedOffset: 0,
        metaPayload,
      };
      abortSendRef.current = false;

      const done = await sendBuffer({
        transferId, buffer, fromOffset: 0,
        totalSize: file.size, isMeta: true, metaPayload,
      });

      if (done) {
        sendDone(transferId);
        onProgress?.({ percent: 100, speed: 0, sent: file.size, total: file.size });
        pendingTransferRef.current = null;
      }
      // If not done: pendingTransferRef stays alive — resume-request will retrigger sendBuffer
    } finally {
      sendingRef.current = false;
    }
  }, [encryptChunk, onProgress, sendBuffer, sendDone]);

  const cancelTransfer = useCallback((transferId) => {
    if (!transferId) return false;

    if (pendingTransferRef.current?.transferId === transferId) {
      abortSendRef.current = true;
      sendControl({ kind: 'transfer-cancel', transferId });
      pendingTransferRef.current = null;
      sendingRef.current = false;
      onTransferCanceled?.({ transferId, sender: 'me' });
      return true;
    }

    if (recvTransferRef.current?.transferId === transferId) {
      sendControl({ kind: 'transfer-cancel', transferId });
      resetReceiveTransfer();
      onTransferCanceled?.({ transferId, sender: 'peer' });
      return true;
    }

    return false;
  }, [onTransferCanceled, resetReceiveTransfer, sendControl]);

  // ── Connection info ────────────────────────────────────────────────
  const getConnectionInfo = useCallback(async () => {
    if (isRelayMode.current)
      return { type: 'relay', relayed: true, protocol: 'websocket' };
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
    abortSendRef.current = true;
    dcRef.current?.close();
    pcRef.current?.close();
    dcRef.current      = null;
    pcRef.current      = null;
    recvBuffers.current = [];
    recvSize.current   = 0;
    fileMeta.current   = null;
    isRelayMode.current = false;
    pendingTransferRef.current = null;
    recvTransferRef.current    = null;
    chunksSinceAck.current     = 0;
    screenSenderRef.current    = null;
  }, []);

  return {
    createOffer,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    sendFile,
    cancelTransfer,
    sendChatMessage,
    sendTyping,
    sendReaction,
    sendEdit,
    sendDelete,
    sendLinkPreview,
    sendWhiteboardEvent,
    getConnectionInfo,
    cleanup,
    handleRelayMessage,
    startMeetingStreams,
    stopMeeting,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    localStream,
    remoteStream,
    isAudioMuted,
    isVideoOff,
    isScreenSharing,
    remoteAudioMuted,
    remoteVideoOff,
  };
}
