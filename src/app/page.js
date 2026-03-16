'use client';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useSignaling }  from '@/hooks/useSignaling';
import { useWebRTC }     from '@/hooks/useWebRTC';
import { deriveKeyFromSecret, encryptChunk, decryptChunk } from '@/hooks/useCrypto';

import SessionCode      from '@/app/components/SessionCode';
import DarkModeToggle   from '@/app/components/ui/DarkModeToggle';
import FileDropZone     from '@/app/components/FileDropZone';
import MessageBubble    from '@/app/components/chat/MessageBubble';
import FileBubble       from '@/app/components/chat/FileBubble';
import TypingIndicator  from '@/app/components/chat/TypingIndicator';
import ChatInput        from '@/app/components/chat/ChatInput';
import SendQueue        from '@/app/components/chat/SendQueue';
import Whiteboard       from '@/app/components/whiteboard/Whiteboard';
import MeetingPanel     from '@/app/components/meeting/MeetingPanel';

function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const URL_REGEX = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)/gi;

export default function Home() {

  // ── State ──────────────────────────────────────────────────────────
  const [mode, setMode]                     = useState(null);
  const [sessionCode, setSessionCode]       = useState('');
  const [roomToken, setRoomToken]           = useState('');
  const [status, setStatus]                 = useState('idle');
  const [connectionType, setConnectionType] = useState(null);
  const [errorMsg, setErrorMsg]             = useState('');
  const [messages, setMessages]             = useState([]);
  const [lightboxUrl, setLightboxUrl]       = useState(null);
  const [rtcState, setRtcState]             = useState('idle');
  const [peerTyping, setPeerTyping]         = useState(false);
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const [replyingTo, setReplyingTo]         = useState(null);
  const [queueVersion, setQueueVersion]     = useState(0);
  const [dragDepth, setDragDepth]           = useState(0);
  const [showMeeting, setShowMeeting]       = useState(false);
  const [meetingActive, setMeetingActive]   = useState(false);
  const [mediaError, setMediaError]         = useState(null);
  const [chatWidth, setChatWidth]           = useState(360);
  const [lobbyCode, setLobbyCode]           = useState('');
  const [toasts, setToasts]                 = useState([]);
  const [peerMeetingActive, setPeerMeetingActive] = useState(false);
  const [peerWhiteboardActive, setPeerWhiteboardActive] = useState(false);

  // ── Refs ───────────────────────────────────────────────────────────
  const cryptoKeyRef           = useRef(null);
  const autoJoinHandled        = useRef(false);
  const pendingFilesRef        = useRef([]);
  const sendingLoopRunning     = useRef(false);
  const receivingMsgIdRef      = useRef(null);
  const currentSendingMsgIdRef = useRef(null);
  const chatEndRef             = useRef(null);
  const typingTimeoutRef       = useRef(null);
  const handleRelayMessageRef  = useRef(null);
  const sendReactionRef        = useRef(null);
  const whiteboardRef          = useRef(null);
  const audioContextRef        = useRef(null);

  // ── Message helpers ────────────────────────────────────────────────
  const addMsg = useCallback((msg) =>
    setMessages((prev) => [...prev, msg]), []);

  const addSystemMsg = useCallback((text) =>
    setMessages((prev) => [
      ...prev,
      { id: genId(), type: 'system', text, timestamp: Date.now() },
    ]), []);

  const updateMsg = useCallback((id, updates) =>
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...updates } : m))), []);

  const pushToast = useCallback((text, tone = 'info') => {
    const id = genId();
    setToasts((prev) => [...prev, { id, text, tone }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 3200);
  }, []);

  const playIncomingSound = useCallback(() => {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = audioContextRef.current || new Ctx();
      audioContextRef.current = ctx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.06, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } catch {
      // Ignore browser audio restrictions.
    }
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, peerTyping]);

  // ── Crypto ─────────────────────────────────────────────────────────
  const setupDerivedKey = useCallback(async (secret) => {
    cryptoKeyRef.current = await deriveKeyFromSecret(secret);
  }, []);

  const encryptFn = useCallback(async (data) => {
    if (!cryptoKeyRef.current) return data;
    return encryptChunk(cryptoKeyRef.current, data);
  }, []);

  const decryptFn = useCallback(async (data) => {
    if (!cryptoKeyRef.current) throw new Error('Missing key');
    return decryptChunk(cryptoKeyRef.current, data);
  }, []);

  // ── Reaction handler ───────────────────────────────────────────────
  const handleReaction = useCallback((msgId, emoji, fromPeer = false) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== msgId) return m;
        const reactions = {};
        Object.entries(m.reactions || {}).forEach(([e, r]) => {
          reactions[e] = { ...r };
        });

        if (fromPeer) {
          Object.keys(reactions).forEach((e) => {
            if (reactions[e].peer) {
              reactions[e].peer = false;
              if (!reactions[e].mine) delete reactions[e];
            }
          });
          if (emoji) reactions[emoji] = { mine: reactions[emoji]?.mine || false, peer: true };
        } else {
          const myPrevEmoji = Object.keys(reactions).find((e) => reactions[e].mine);
          if (myPrevEmoji === emoji) {
            reactions[emoji].mine = false;
            if (!reactions[emoji].peer) delete reactions[emoji];
            sendReactionRef.current?.(msgId, null);
          } else {
            if (myPrevEmoji) {
              reactions[myPrevEmoji].mine = false;
              if (!reactions[myPrevEmoji].peer) delete reactions[myPrevEmoji];
            }
            reactions[emoji] = { mine: true, peer: reactions[emoji]?.peer || false };
            sendReactionRef.current?.(msgId, emoji);
          }
        }
        return { ...m, reactions };
      })
    );
  }, []);

  // ── Signaling ──────────────────────────────────────────────────────
  const handleSignal = useCallback((msg) => {
    switch (msg.type) {
      case 'created':
        setSessionCode(msg.payload.code);
        setRoomToken(msg.payload.token || '');
        setStatus('waiting');
        setErrorMsg('');
        setupDerivedKey(msg.payload.code).catch(() => {
          setStatus('error');
          setErrorMsg('Could not initialize encryption key. Please retry.');
        });
        break;
      case 'joined':
        setStatus('waiting');
        setErrorMsg('');
        break;
      case 'peer-joined':
        createOffer();
        break;
      case 'offer':
        handleOffer(msg.payload);
        break;
      case 'answer':
        handleAnswer(msg.payload);
        break;
      case 'ice-candidate':
        handleIceCandidate(msg.payload);
        break;
      case 'relay':
        handleRelayMessageRef.current?.(msg.payload);
        break;
      case 'peer-disconnected':
        setStatus('waiting');
        pendingFilesRef.current = [];
        setQueueVersion((v) => v + 1);
        setPeerTyping(false);
        addSystemMsg('Peer disconnected. Waiting for reconnect…');
        setErrorMsg('');
        break;
      case 'left':
        setStatus('idle');
        break;
      case 'error':
        setErrorMsg(msg.payload.message);
        setStatus('error');
        break;
      default:
        break;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { send, wsState } = useSignaling(handleSignal);

  const {
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
    sendPresenceEvent,
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
    localPresentationStream,
    remoteAudioMuted,
    remoteVideoOff,
    remoteScreenSharing,
  } = useWebRTC({
    onSignal: ({ type, payload }) => send({ type, payload }),
    wsSend: send,

    onMediaError: (err) => setMediaError(err.message),
    onMeetingStart: () => {
      setMeetingActive(true);
      pushToast('Meeting is available to join.', 'meeting');
    },

    onPresence: (message) => {
      switch (message.type) {
        case 'whiteboard-open':
          setPeerWhiteboardActive(true);
          break;
        case 'whiteboard-close':
          setPeerWhiteboardActive(false);
          break;
        case 'meeting-open':
          setPeerMeetingActive(true);
          break;
        case 'meeting-close':
          setPeerMeetingActive(false);
          break;
        case 'page-hidden':
          pushToast('Peer switched tab or minimized the app.', 'navigation');
          break;
        case 'page-visible':
          pushToast('Peer returned to the app.', 'navigation');
          break;
        case 'leaving-page':
          pushToast('Peer is navigating away.', 'navigation');
          break;
        default:
          break;
      }
    },

    onProgress: (p) => {
      const activeId = currentSendingMsgIdRef.current || receivingMsgIdRef.current;
      if (activeId) updateMsg(activeId, { progress: p.percent });
    },

    onFileMeta: ({ transferId, name, size, type }) => {
      const id = transferId || genId();
      receivingMsgIdRef.current = id;
      addMsg({
        id, type: 'file', sender: 'peer',
        name, size, mimeType: type,
        status: 'receiving', progress: 0,
        timestamp: Date.now(),
      });
    },

    onFileReceived: ({ blob }) => {
      const msgId = receivingMsgIdRef.current;
      receivingMsgIdRef.current = null;
      const previewUrl =
        blob.type?.startsWith('image/') ||
        blob.type?.startsWith('video/') ||
        blob.type?.startsWith('audio/')
          ? URL.createObjectURL(blob)
          : null;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? { ...m, blob, previewUrl, status: 'received', progress: 100 }
            : m
        )
      );
      setStatus('connected');
    },

    onConnected: async () => {
      setStatus('connected');
      // Restore paused file messages back to active states
      setMessages((prev) =>
        prev.map((m) => {
          if (m.type !== 'file') return m;
          if (m.status === 'paused' && m.sender === 'me')
            return { ...m, status: 'sending' };
          if (m.status === 'paused' && m.sender === 'peer')
            return { ...m, status: 'receiving' };
          return m;
        })
      );
      setTimeout(async () => {
        const info = await getConnectionInfo();
        if (info) {
          setConnectionType(info);
          if (info.type === 'relay')
            addSystemMsg('Using server relay — still encrypted 🔒');
        }
      }, 2000);
    },

    // ── NEW: connection dropped mid-transfer ──────────────────────
    onTransferPaused: () => {
      // Mark the active sending message as paused
      if (currentSendingMsgIdRef.current) {
        updateMsg(currentSendingMsgIdRef.current, { status: 'paused' });
      }
      // Mark the active receiving message as paused
      if (receivingMsgIdRef.current) {
        updateMsg(receivingMsgIdRef.current, { status: 'paused' });
      }
      addSystemMsg('Transfer paused — reconnecting… ⏸');
    },

    onTransferError: (message) => {
      setErrorMsg(message);
      if (receivingMsgIdRef.current) {
        updateMsg(receivingMsgIdRef.current, { status: 'error' });
        receivingMsgIdRef.current = null;
      }
      setStatus('connected');
    },

    onTransferCanceled: ({ transferId, sender }) => {
      if (!transferId) return;
      updateMsg(transferId, { status: 'canceled', progress: 0 });
      if (sender === 'peer' && receivingMsgIdRef.current === transferId) {
        receivingMsgIdRef.current = null;
      }
      if (sender === 'me' && currentSendingMsgIdRef.current === transferId) {
        currentSendingMsgIdRef.current = null;
      }
      addSystemMsg(sender === 'me' ? 'Upload canceled.' : 'Incoming file canceled by peer.');
      setStatus('connected');
    },

    onChatMessage: ({ text, id, timestamp, replyTo }) => {
      setPeerTyping(false);
      clearTimeout(typingTimeoutRef.current);
      pushToast('You have a new message.', 'message');
      playIncomingSound();
      addMsg({
        id: id || genId(), type: 'text', sender: 'peer',
        text, timestamp: timestamp || Date.now(),
        replyTo: replyTo || null,
      });
    },

    onTyping: () => {
      setPeerTyping(true);
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => setPeerTyping(false), 2500);
    },

    onReaction: ({ msgId, emoji, fromPeer }) => {
      handleReaction(msgId, emoji, fromPeer);
    },

    onWhiteboardEvent: (event) => {
      if (event?.kind === 'wb-open') setPeerWhiteboardActive(true);
      if (event?.kind === 'wb-close') setPeerWhiteboardActive(false);
      whiteboardRef.current?.handlePeerEvent(event);
    },

    onMessageEdit: ({ id, newText }) => {
      setMessages((prev) =>
        prev.map((m) => m.id === id ? { ...m, text: newText, edited: true } : m)
      );
    },

    onMessageDelete: ({ id }) => {
      setMessages((prev) =>
        prev.map((m) => m.id === id ? { ...m, deleted: true } : m)
      );
    },

    onLinkPreview: ({ msgId, preview }) => {
      setMessages((prev) =>
        prev.map((m) => m.id === msgId ? { ...m, linkPreview: preview } : m)
      );
    },

    onStateChange: (state) => {
      setRtcState(state);
      if (state === 'relay')
        addSystemMsg('Direct P2P failed — switching to secure relay 🔄');
      else if (state === 'failed' || state === 'disconnected')
        addSystemMsg(`Connection ${state}. Switching to relay...`);
    },

    encryptChunk: encryptFn,
    decryptChunk: decryptFn,
  });

  useEffect(() => {
    if (showMeeting) setPeerMeetingActive(false);
  }, [showMeeting]);

  useEffect(() => {
    if (showWhiteboard) setPeerWhiteboardActive(false);
  }, [showWhiteboard]);

  useEffect(() => {
    const isChatReady = status === 'connected' || status === 'transferring';
    if (!isChatReady) return;

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        sendPresenceEvent('page-hidden');
      } else {
        sendPresenceEvent('page-visible');
      }
    };

    const onPageLeave = () => {
      sendPresenceEvent('leaving-page');
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageLeave);
    window.addEventListener('beforeunload', onPageLeave);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageLeave);
      window.removeEventListener('beforeunload', onPageLeave);
    };
  }, [status, sendPresenceEvent]);

  // Keep refs in sync
  useEffect(() => { sendReactionRef.current      = sendReaction;      }, [sendReaction]);
  useEffect(() => { handleRelayMessageRef.current = handleRelayMessage; }, [handleRelayMessage]);

  // ── Auto-join from URL ─────────────────────────────────────────────
  useEffect(() => {
    if (autoJoinHandled.current || wsState !== 'connected') return;
    const params      = new URLSearchParams(window.location.search);
    const joinToken   = params.get('join');
    const codeFromUrl = params.get('code');
    if (!joinToken) return;
    autoJoinHandled.current = true;
    setMode('receive');
    setStatus('waiting');
    setupDerivedKey(codeFromUrl || joinToken)
      .then(() => send({ type: 'join', payload: { token: joinToken } }))
      .catch(() => { setStatus('error'); setErrorMsg('Could not initialize secure join.'); });
    window.history.replaceState({}, '', window.location.pathname);
  }, [wsState, send, setupDerivedKey]);

  // ── Room actions ───────────────────────────────────────────────────
  const startSend    = () => { setErrorMsg(''); setMode('send');    send({ type: 'create' }); };

  const joinRoom = async (code) => {
    setErrorMsg('');
    try {
      await setupDerivedKey(code);
      send({ type: 'join', payload: { code } });
    } catch {
      setStatus('error');
      setErrorMsg('Could not initialize secure connection.');
    }
  };

  const leaveRoom = useCallback(() => {
    send({ type: 'leave' });
    cleanup();
  }, [send, cleanup]);

  const reset = () => {
    leaveRoom();
    setMode(null); setStatus('idle'); setSessionCode(''); setRoomToken('');
    setLobbyCode('');
    pendingFilesRef.current = []; setMessages([]); setErrorMsg('');
    setConnectionType(null); setRtcState('idle'); setPeerTyping(false);
    setShowWhiteboard(false); setReplyingTo(null); setQueueVersion(0);
    cryptoKeyRef.current           = null;
    sendingLoopRunning.current     = false;
    currentSendingMsgIdRef.current = null;
    receivingMsgIdRef.current      = null;
    clearTimeout(typingTimeoutRef.current);
  };

  // ── Send loop ──────────────────────────────────────────────────────
  const runSendLoop = useCallback(async () => {
    if (sendingLoopRunning.current) return;
    sendingLoopRunning.current = true;
    try {
      while (pendingFilesRef.current.length > 0) {
        const { file, msgId } = pendingFilesRef.current[0];
        currentSendingMsgIdRef.current = msgId;
        updateMsg(msgId, { status: 'sending', progress: 0 });
        setStatus('transferring');
        await sendFile(file, msgId);
        // sendFile returns when either done OR paused (for resume)
        // Only advance queue if fully sent (status will be 'sent' via onProgress 100%)
        const msgNow = pendingFilesRef.current[0]; // might have changed
        if (msgNow?.msgId === msgId) {
          currentSendingMsgIdRef.current = null;
          pendingFilesRef.current.shift();
          setQueueVersion((v) => v + 1);
          updateMsg(msgId, { status: 'sent', progress: 100 });
        }
      }
    } finally {
      sendingLoopRunning.current     = false;
      currentSendingMsgIdRef.current = null;
      if (status !== 'idle') setStatus('connected');
    }
  }, [sendFile, updateMsg, status]);

  useEffect(() => {
    if (status === 'connected' && pendingFilesRef.current.length > 0) runSendLoop();
  }, [status, runSendLoop]);

  const chatReady = status === 'connected' || status === 'transferring';

  // ── File attach ────────────────────────────────────────────────────
  const handleFilesAttach = useCallback((files) => {
    if (!files?.length) return;
    const newMsgs = Array.from(files).map((file) => {
      const id         = genId();
      const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
      pendingFilesRef.current = [...pendingFilesRef.current, { file, msgId: id }];
      return {
        id, type: 'file', sender: 'me',
        name: file.name, size: file.size, mimeType: file.type,
        file, previewUrl, status: 'queued', progress: 0,
        timestamp: Date.now(),
      };
    });
    setMessages((prev) => [...prev, ...newMsgs]);
    setQueueVersion((v) => v + 1);
    if (status === 'connected') runSendLoop();
  }, [status, runSendLoop]);

  const handleDropEnter = useCallback((event) => {
    if (!chatReady) return;
    if (!Array.from(event.dataTransfer?.types || []).includes('Files')) return;
    event.preventDefault();
    setDragDepth((depth) => depth + 1);
  }, [chatReady]);

  const handleDropLeave = useCallback((event) => {
    if (!chatReady) return;
    if (!Array.from(event.dataTransfer?.types || []).includes('Files')) return;
    event.preventDefault();
    setDragDepth((depth) => Math.max(0, depth - 1));
  }, [chatReady]);

  const handleDropOver = useCallback((event) => {
    if (!chatReady) return;
    if (!Array.from(event.dataTransfer?.types || []).includes('Files')) return;
    event.preventDefault();
  }, [chatReady]);

  const handleDropFiles = useCallback((event) => {
    if (!chatReady) return;
    if (!Array.from(event.dataTransfer?.types || []).includes('Files')) return;
    event.preventDefault();
    setDragDepth(0);
    const files = Array.from(event.dataTransfer?.files || []);
    if (files.length) handleFilesAttach(files);
  }, [chatReady, handleFilesAttach]);

  const cancelQueuedFile = useCallback((msgId) => {
    const idx = pendingFilesRef.current.findIndex((x) => x.msgId === msgId);
    if (idx === 0 && status === 'transferring') return;
    if (idx >= 0) {
      pendingFilesRef.current.splice(idx, 1);
      setQueueVersion((v) => v + 1);
    }
    setMessages((prev) => prev.filter((m) => m.id !== msgId));
  }, [status]);

  const cancelFileTransfer = useCallback((msgId) => {
    const message = messages.find((item) => item.id === msgId);
    if (!message) return;

    if (message.status === 'queued') {
      cancelQueuedFile(msgId);
      return;
    }

    const canceled = cancelTransfer(msgId);
    if (!canceled) return;

    if (message.sender === 'me') {
      pendingFilesRef.current = pendingFilesRef.current.filter((item) => item.msgId !== msgId);
      currentSendingMsgIdRef.current = currentSendingMsgIdRef.current === msgId ? null : currentSendingMsgIdRef.current;
    } else {
      receivingMsgIdRef.current = receivingMsgIdRef.current === msgId ? null : receivingMsgIdRef.current;
    }

    setQueueVersion((v) => v + 1);
    updateMsg(msgId, { status: 'canceled', progress: 0 });
  }, [cancelQueuedFile, cancelTransfer, messages, updateMsg]);

  // ── Reorder queue ──────────────────────────────────────────────────
  const reorderQueue = useCallback((fromIdx, toIdx) => {
    const arr = [...pendingFilesRef.current];
    const [moved] = arr.splice(fromIdx, 1);
    arr.splice(toIdx, 0, moved);
    pendingFilesRef.current = arr;
    setQueueVersion((v) => v + 1);
    setMessages((prev) => {
      const queuedIds = arr.map((q) => q.msgId);
      const nonQueued = prev.filter((m) => !queuedIds.includes(m.id));
      const queued    = queuedIds
        .map((id) => prev.find((m) => m.id === id))
        .filter(Boolean);
      return [...nonQueued, ...queued];
    });
  }, []);

  // ── Link preview ───────────────────────────────────────────────────
  const fetchAndSendLinkPreview = useCallback(async (msgId, text) => {
    const matches = text.match(URL_REGEX);
    const url     = matches?.[0];
    if (!url) return;
    try {
      const res = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`);
      if (!res.ok) return;
      const preview = await res.json();
      if (preview.error) return;
      setMessages((prev) =>
        prev.map((m) => m.id === msgId ? { ...m, linkPreview: preview } : m)
      );
      sendLinkPreview(msgId, preview);
    } catch { /* silent */ }
  }, [sendLinkPreview]);

  // ── Send text ──────────────────────────────────────────────────────
  const handleSendText = useCallback((text) => {
    if (!text) return;
    const id = sendChatMessage?.(text, replyingTo);
    if (id === false || !id) return;
    addMsg({
      id, type: 'text', sender: 'me', text,
      timestamp: Date.now(),
      replyTo: replyingTo
        ? {
            id:     replyingTo.id,
            text:   replyingTo.text   || null,
            name:   replyingTo.name   || null,
            type:   replyingTo.type,
            sender: replyingTo.sender,
          }
        : null,
    });
    setReplyingTo(null);
    fetchAndSendLinkPreview(id, text);
  }, [sendChatMessage, addMsg, replyingTo, fetchAndSendLinkPreview]);

  // ── Edit ───────────────────────────────────────────────────────────
  const handleEdit = useCallback((msgId, newText) => {
    setMessages((prev) =>
      prev.map((m) => m.id === msgId ? { ...m, text: newText, edited: true } : m)
    );
    sendEdit(msgId, newText);
  }, [sendEdit]);

  // ── Delete ─────────────────────────────────────────────────────────
  const handleDelete = useCallback((msgId) => {
    setMessages((prev) =>
      prev.map((m) => m.id === msgId ? { ...m, deleted: true } : m)
    );
    sendDelete(msgId);
  }, [sendDelete]);

  // ── Download ───────────────────────────────────────────────────────
  const downloadMsg = useCallback((msg) => {
    const url = msg.previewUrl || (msg.blob ? URL.createObjectURL(msg.blob) : null);
    if (!url) return;
    const a = document.createElement('a');
    a.href = url; a.download = msg.name; a.click();
    if (msg.blob && !msg.previewUrl) setTimeout(() => URL.revokeObjectURL(url), 1500);
  }, []);

  const connectionLabel = connectionType?.type === 'relay'
    ? 'Connected via relay'
    : connectionType
      ? 'Connected directly'
      : status === 'transferring'
        ? 'Transferring'
        : status === 'connected'
          ? 'Connected'
          : status === 'error'
            ? 'Connection error'
            : 'Connecting';

  const connectionDotClass =
    status === 'error'
      ? 'bg-red-500'
      : status === 'connected'
        ? 'bg-emerald-500'
        : status === 'transferring'
          ? 'bg-blue-500 animate-pulse'
          : 'bg-amber-500 animate-pulse';

  const normalizedLobbyCode = lobbyCode.trim().toUpperCase();
  const canJoinLobbyCode = normalizedLobbyCode.length >= 4;

  const handleLobbyJoin = async () => {
    if (!canJoinLobbyCode) return;
    setMode('receive');
    setStatus('waiting');
    await joinRoom(normalizedLobbyCode);
  };

  // ────────────────────────────────────────────────────────────────────
  //  Render
  // ────────────────────────────────────────────────────────────────────
  return (
    <main
      className="min-h-screen bg-slate-100 dark:bg-slate-950"
      onDragEnter={handleDropEnter}
      onDragLeave={handleDropLeave}
      onDragOver={handleDropOver}
      onDrop={handleDropFiles}
    >

      {/* ══════  CHAT VIEW  ══════ */}
      {chatReady && (
        <div className="relative flex h-screen overflow-hidden bg-slate-100 dark:bg-slate-950">

          {/* Meeting Panel */}
          {showMeeting && (
             <div className="flex-1 min-w-0 bg-slate-100 dark:bg-slate-950 h-screen overflow-hidden">
                <MeetingPanel
                   isHost={mode === 'send'}
                   meetingActive={meetingActive}
                   localStream={localStream}
                   localPresentationStream={localPresentationStream}
                   remoteStream={remoteStream}
                   onStartMeeting={async (opts = { audio: true, video: true }) => {
                      setMeetingActive(true);
                      await startMeetingStreams(opts);
                   }}
                   mediaError={mediaError}
                   toggleAudio={toggleAudio}
                   toggleVideo={toggleVideo}
                   toggleScreenShare={toggleScreenShare}
                   isAudioMuted={isAudioMuted}
                   isVideoOff={isVideoOff}
                   isScreenSharing={isScreenSharing}
                   remoteAudioMuted={remoteAudioMuted}
                   remoteVideoOff={remoteVideoOff}
                   remoteScreenSharing={remoteScreenSharing}
                   onLeaveMeeting={() => {
                      stopMeeting();
                      setShowMeeting(false);
                      setMeetingActive(false);
                   }}
                />
             </div>
          )}

          {/* Resizer */}
          {showMeeting && (
             <div 
               className="w-1 cursor-col-resize shrink-0 bg-slate-300/70 hover:bg-blue-500 dark:bg-slate-700/70 dark:hover:bg-blue-500 z-10 transition-colors"
               onMouseDown={(e) => {
                 const startX = e.clientX;
                 const startW = chatWidth;
                 const onMove = (me) => setChatWidth(Math.max(280, Math.min(startW - (me.clientX - startX), window.innerWidth - 360)));
                 const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
                 window.addEventListener('mousemove', onMove);
                 window.addEventListener('mouseup', onUp);
               }}
             />
          )}

          <div
            style={{ width: showMeeting ? `${chatWidth}px` : '100%', minWidth: showMeeting ? '300px' : undefined }}
            className={`flex h-screen flex-col overflow-hidden border-l border-slate-200 bg-white transition-all duration-300 dark:border-slate-800 dark:bg-slate-900 ${!showMeeting && 'w-full border-l-0'}`}
          >

          {/* Header */}
          <header className="sticky top-0 z-20 flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900 sm:px-5 lg:px-6">
            <div className="flex min-w-0 items-center gap-3 sm:gap-4">
              <button
                onClick={reset}
                className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 sm:px-4"
              >
                ← Leave
              </button>
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100 sm:text-base">
                    Chat
                  </p>
                  <span className="inline-flex items-center" title={connectionLabel} aria-label={connectionLabel}>
                    <span className={`h-2.5 w-2.5 rounded-full ${connectionDotClass}`} />
                  </span>
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => {
                  setShowMeeting((prev) => {
                    const next = !prev;
                    sendPresenceEvent(next ? 'meeting-open' : 'meeting-close');
                    return next;
                  });
                }}
                title={showMeeting ? "Close Meeting" : "Open Meeting"}
                className={`relative flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 transition-colors dark:border-slate-700 dark:hover:bg-slate-800 ${showMeeting ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-white text-slate-500 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-400'} ${peerMeetingActive ? 'ring-2 ring-blue-400/70 dark:ring-blue-500/70' : ''}`}
              >
                {peerMeetingActive && !showMeeting && (
                  <span className="pointer-events-none absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-blue-500 animate-pulse" />
                )}
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
              <button
                onClick={() => {
                  setShowWhiteboard(true);
                  sendWhiteboardEvent({ kind: 'wb-open' });
                  sendPresenceEvent('whiteboard-open');
                }}
                title="Open whiteboard"
                className={`relative flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 ${showWhiteboard ? 'ring-2 ring-emerald-400/70 dark:ring-emerald-500/70' : ''} ${peerWhiteboardActive ? 'ring-2 ring-emerald-400/70 dark:ring-emerald-500/70' : ''}`}
              >
                {peerWhiteboardActive && !showWhiteboard && (
                  <span className="pointer-events-none absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                )}
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M15.232 5.232l3.536 3.536M9 11l6-6 3.536 3.536-6 6H9v-3.536z" />
                </svg>
              </button>
              <DarkModeToggle />
            </div>
          </header>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto bg-slate-50 px-3 py-4 dark:bg-slate-950 sm:px-4 sm:py-5 lg:px-6">
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-3">
              {messages.length === 0 && (
                <div className="mx-auto mt-8 max-w-md rounded-[28px] bg-white px-6 py-8 text-center shadow-sm dark:bg-slate-900">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/70 dark:text-blue-400">
                    <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4l-4 4v-4z" />
                    </svg>
                  </div>
                  <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    Your conversation starts here
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                    Send a message, drop a file, or open the whiteboard. This layout now stays focused like a real chat window.
                  </p>
                </div>
              )}

              {messages.map((msg) => {
                if (msg.type === 'system') {
                  return (
                    <div key={msg.id} className="flex justify-center py-1">
                      <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[11px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                        {msg.text}
                      </span>
                    </div>
                  );
                }

                const isMine = msg.sender === 'me';
                return (
                  <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                    <div className="min-w-0 max-w-[84%] sm:max-w-[72%] lg:max-w-[62%]">

                      {msg.type === 'text' && (
                        <MessageBubble
                          msg={msg}
                          isMine={isMine}
                          onReact={(msgId, emoji) => handleReaction(msgId, emoji, false)}
                          onReply={(m) => setReplyingTo(m)}
                          onEdit={handleEdit}
                          onDelete={handleDelete}
                        />
                      )}

                      {msg.type === 'file' && (
                        <FileBubble
                          msg={msg}
                          isMine={isMine}
                          onDownload={downloadMsg}
                          onPreview={(url) => setLightboxUrl(url)}
                          onCancel={cancelQueuedFile}
                        />
                      )}

                      <p className={`mt-1 px-1 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400 ${isMine ? 'text-right' : 'text-left'}`}>
                        {new Date(msg.timestamp).toLocaleTimeString([], {
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                );
              })}

              {peerTyping && <TypingIndicator />}
              <div ref={chatEndRef} />
            </div>
          </div>

          {/* Error banner */}
          {errorMsg && (
            <div className="shrink-0 border-t border-red-200 bg-red-50 px-4 py-2 text-center text-xs text-red-700 dark:border-red-900 dark:bg-red-950/90 dark:text-red-300">
              {errorMsg}
              <button onClick={() => setErrorMsg('')} className="ml-3 underline opacity-70">
                Dismiss
              </button>
            </div>
          )}

          <div className="shrink-0 px-3 py-2 sm:px-4 lg:px-5">
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-2">
              {/* Send queue */}
              <SendQueue
                key={queueVersion}
                queue={pendingFilesRef.current.map(({ file, msgId }) => ({
                  file, msgId,
                  status:   messages.find((m) => m.id === msgId)?.status   || 'queued',
                  progress: messages.find((m) => m.id === msgId)?.progress || 0,
                }))}
                onReorder={reorderQueue}
                onCancel={cancelFileTransfer}
              />

              {/* Chat input */}
              <ChatInput
                onSendText={handleSendText}
                onFilesAttach={handleFilesAttach}
                onTyping={sendTyping}
                replyingTo={replyingTo}
                onCancelReply={() => setReplyingTo(null)}
              />
            </div>
          </div>

          {/* Whiteboard overlay */}
          {showWhiteboard && (
            <Whiteboard
              ref={whiteboardRef}
              onSendEvent={sendWhiteboardEvent}
              onClose={() => {
                setShowWhiteboard(false);
                sendWhiteboardEvent({ kind: 'wb-close' });
                sendPresenceEvent('whiteboard-close');
              }}
            />
          )}
          </div>

          {dragDepth > 0 && (
            <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-slate-950/10 p-5 backdrop-blur-[2px] dark:bg-slate-950/30">
              <div className="pointer-events-auto w-full max-w-2xl">
                <FileDropZone onFilesSelect={handleFilesAttach} disabled={false} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════  LOBBY VIEW  ══════ */}
      {!chatReady && (
        <div className="relative flex flex-1 items-center justify-center px-4 py-10">
          <div className="w-full max-w-6xl rounded-3xl bg-white/90 p-6 shadow-xl shadow-slate-900/5 backdrop-blur dark:bg-slate-900/75 lg:p-8">

            <div className="mb-8 flex items-center justify-between">
              {mode ? (
                <button
                  onClick={reset}
                  className="group inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                >
                  <svg className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Back
                </button>
              ) : <div />}
              <DarkModeToggle />
            </div>

            {mode !== 'send' ? (
              <div className="grid gap-8 lg:grid-cols-[0.9fr_1.3fr] lg:items-center">
                <section>
                  <h1 className="max-w-xl text-4xl font-semibold leading-tight text-slate-900 dark:text-slate-100 sm:text-5xl">
                    Meet, chat, and share files instantly.
                  </h1>

                  <p className="mt-4 max-w-xl text-base leading-7 text-slate-600 dark:text-slate-300">
                    Join with a room code or start a new meeting, similar to Google Meet web flow.
                  </p>
                </section>

                <section className="rounded-2xl bg-white p-6 shadow-sm dark:bg-slate-900 sm:p-7">
                  <p className="text-base font-semibold text-slate-800 dark:text-slate-200">
                    Start or join with a code
                  </p>

                  <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                    <button
                      onClick={startSend}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 4v16m8-8H4" />
                      </svg>
                      New meeting
                    </button>

                    <div className="relative flex-1">
                      <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4l-4 4v-4z" />
                      </svg>
                      <input
                        type="text"
                        value={lobbyCode}
                        onChange={(e) => setLobbyCode(e.target.value.toUpperCase())}
                        onKeyDown={(e) => e.key === 'Enter' && handleLobbyJoin()}
                        placeholder="Enter a code"
                        maxLength={12}
                        className="w-full rounded-full border border-slate-300 bg-white py-3 pl-10 pr-4 text-sm font-medium tracking-wide text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-500 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-500"
                      />
                    </div>

                    <button
                      onClick={handleLobbyJoin}
                      disabled={!canJoinLobbyCode}
                      className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-45 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      Join
                    </button>
                  </div>

                  {mode === 'receive' && status !== 'idle' && (
                    <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
                        Connecting to room {normalizedLobbyCode || sessionCode || '...'}
                      </div>
                    </div>
                  )}

                  <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                    Tip: Use the room code shared by your teammate. Codes are case-insensitive.
                  </p>
                </section>
              </div>
            ) : (
              <div className="mx-auto w-full max-w-md">
                <header className="mb-7 text-center">
                  <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                    FileShare &amp; Chat
                  </h1>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    Share this code to invite others
                  </p>
                </header>
                <SessionCode mode="send" code={sessionCode} token={roomToken} />
              </div>
            )}

            {errorMsg && (
              <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
                {errorMsg}
              </div>
            )}

            <footer className="mt-8 text-center text-xs text-slate-400">
              Fast file sharing and chat in one room.
            </footer>
          </div>
        </div>
      )}

      {/* ══════  LIGHTBOX  ══════ */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/25 transition-colors"
            onClick={() => setLightboxUrl(null)}
            aria-label="Close preview"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img
            src={lightboxUrl}
            alt="Full size preview"
            className="max-h-[90vh] max-w-full rounded-2xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* ══════  TOASTS  ══════ */}
      <div className="pointer-events-none fixed right-4 top-4 z-[60] flex w-[min(92vw,360px)] flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`rounded-xl border px-4 py-3 text-sm shadow-lg shadow-slate-900/10 backdrop-blur ${
              toast.tone === 'message'
                ? 'border-blue-200 bg-blue-50/95 text-blue-900 dark:border-blue-800 dark:bg-blue-950/95 dark:text-blue-100'
                : toast.tone === 'navigation'
                  ? 'border-amber-200 bg-amber-50/95 text-amber-900 dark:border-amber-800 dark:bg-amber-950/95 dark:text-amber-100'
                  : toast.tone === 'meeting'
                    ? 'border-emerald-200 bg-emerald-50/95 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/95 dark:text-emerald-100'
                    : 'border-slate-200/90 bg-white/95 text-slate-700 dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-200'
            }`}
          >
            {toast.text}
          </div>
        ))}
      </div>

    </main>
  );
}
