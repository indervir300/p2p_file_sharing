'use client';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useSignaling }  from '@/hooks/useSignaling';
import { useWebRTC }     from '@/hooks/useWebRTC';
import { deriveKeyFromSecret, encryptChunk, decryptChunk } from '@/hooks/useCrypto';

import SessionCode      from '@/app/components/SessionCode';
import DarkModeToggle   from '@/app/components/ui/DarkModeToggle';
import FileDropZone     from '@/app/components/FileDropZone';
import PeerAvatar       from '@/app/components/chat/PeerAvatar';
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
  } = useWebRTC({
    onSignal: ({ type, payload }) => send({ type, payload }),
    wsSend: send,

    onMediaError: (err) => setMediaError(err.message),
    onMeetingStart: () => setMeetingActive(true),

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
    setupDerivedKey(codeFromUrl || joinToken)
      .then(() => send({ type: 'join', payload: { token: joinToken } }))
      .catch(() => { setStatus('error'); setErrorMsg('Could not initialize secure join.'); });
    window.history.replaceState({}, '', window.location.pathname);
  }, [wsState, send, setupDerivedKey]);

  // ── Room actions ───────────────────────────────────────────────────
  const startSend    = () => { setErrorMsg(''); setMode('send');    send({ type: 'create' }); };
  const startReceive = () => { setErrorMsg(''); setMode('receive'); setStatus('idle'); };

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
    ? 'Secure relay'
    : connectionType
      ? 'Direct peer'
      : status === 'transferring'
        ? 'Transferring'
        : 'Connecting';

  // ────────────────────────────────────────────────────────────────────
  //  Render
  // ────────────────────────────────────────────────────────────────────
  return (
    <main
      className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.16),transparent_32%),linear-gradient(180deg,#f8fbff_0%,#e8eef8_100%)] dark:bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.18),transparent_30%),linear-gradient(180deg,#020617_0%,#0f172a_100%)]"
      onDragEnter={handleDropEnter}
      onDragLeave={handleDropLeave}
      onDragOver={handleDropOver}
      onDrop={handleDropFiles}
    >

      {/* ══════  CHAT VIEW  ══════ */}
      {chatReady && (
        <div className="relative flex min-h-screen overflow-hidden">
          <div 
            style={{ width: showMeeting ? `${chatWidth}px` : '100%', minWidth: showMeeting ? '300px' : undefined }}
            className={`flex h-screen flex-col overflow-hidden bg-transparent backdrop-blur-xl transition-all duration-300 ${!showMeeting && 'w-full'}`}
          >

          {/* Header */}
          <header className="sticky top-0 z-20 flex shrink-0 items-center justify-between gap-3 border-b border-slate-200/80 bg-white/55 px-4 py-3 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/40 sm:px-5 lg:px-6">
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
                    {sessionCode ? `Room ${sessionCode}` : 'Chat Session'}
                  </p>
                  <span className="hidden rounded-full border px-1.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 sm:inline-flex">
                    {connectionLabel}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => setShowMeeting(prev => !prev)}
                title={showMeeting ? "Close Meeting" : "Open Meeting"}
                className={`flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 transition-colors dark:border-slate-700 dark:hover:bg-slate-800 ${showMeeting ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-white text-slate-500 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-400'}`}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
              <button
                onClick={() => setShowWhiteboard(true)}
                title="Open whiteboard"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M15.232 5.232l3.536 3.536M9 11l6-6 3.536 3.536-6 6H9v-3.536z" />
                </svg>
              </button>
              <DarkModeToggle />
              <PeerAvatar connectionType={connectionType} />
            </div>
          </header>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto bg-transparent px-3 py-4 sm:px-4 sm:py-5 lg:px-6">
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-3">
              {messages.length === 0 && (
                <div className="mx-auto mt-8 max-w-md rounded-[28px] border border-white/70 bg-white/75 px-6 py-8 text-center shadow-lg shadow-slate-900/5 backdrop-blur dark:border-slate-800 dark:bg-slate-900/75 dark:shadow-black/10">
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
                      <span className="rounded-full border border-slate-200/80 bg-white/80 px-3 py-1.5 text-[11px] text-slate-500 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/75 dark:text-slate-400">
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
            <div className="shrink-0 border-t border-red-200 bg-red-50/95 px-4 py-2 text-center text-xs text-red-700 backdrop-blur dark:border-red-900 dark:bg-red-950/90 dark:text-red-300">
              {errorMsg}
              <button onClick={() => setErrorMsg('')} className="ml-3 underline opacity-70">
                Dismiss
              </button>
            </div>
          )}

          <div className="shrink-0 border-t border-slate-200/80 bg-white/30 px-3 py-3 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/25 sm:px-4 lg:px-6">
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-3">
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
              onClose={() => setShowWhiteboard(false)}
            />
          )}
          </div>

          {/* Resizer */}
          {showMeeting && (
             <div 
               className="w-1 cursor-col-resize shrink-0 bg-slate-200/60 hover:bg-blue-400 dark:bg-slate-700/60 dark:hover:bg-blue-500 z-10 transition-colors"
               onMouseDown={(e) => {
                 const startX = e.clientX;
                 const startW = chatWidth;
                 const onMove = (me) => setChatWidth(Math.max(280, Math.min(startW + me.clientX - startX, window.innerWidth - 360)));
                 const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
                 window.addEventListener('mousemove', onMove);
                 window.addEventListener('mouseup', onUp);
               }}
             />
          )}

          {/* Meeting Panel */}
          {showMeeting && (
             <div className="flex-1 min-w-0 bg-black h-screen overflow-hidden">
                <MeetingPanel
                   isHost={mode === 'send'}
                   meetingActive={meetingActive}
                   localStream={localStream}
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
                   onLeaveMeeting={() => {
                      stopMeeting();
                      setShowMeeting(false);
                      setMeetingActive(false);
                   }}
                />
             </div>
          )}

          {dragDepth > 0 && (
            <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-slate-950/10 p-5 backdrop-blur-[2px] dark:bg-slate-950/30">
              <div className="pointer-events-auto w-full max-w-2xl">
                <FileDropZone onFilesSelect={handleFilesAttach} disabled={false} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════  LOBBY VIEW  ══════ */}
      {!chatReady && (
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 relative">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-sm">

            <div className="flex justify-between items-center mb-6">
              {mode ? (
                <button
                  onClick={reset}
                  className="group flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
                >
                  <svg className="h-4 w-4 transition-transform group-hover:-translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Back
                </button>
              ) : <div />}
              <DarkModeToggle />
            </div>

            <header className="mb-8 text-center">
              <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                FileShare &amp; Chat
              </h1>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                WebRTC · End-to-end encrypted · No cloud storage
              </p>
            </header>

            {!mode && (
              <div className="flex flex-col gap-4">
                <button
                  onClick={startSend}
                  className="group relative flex w-full items-center justify-between rounded-2xl bg-linear-to-r from-blue-600 to-indigo-600 px-6 py-5 shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl active:scale-95"
                >
                  <div className="flex flex-col items-start gap-1">
                    <span className="text-xl font-bold text-white">Create Room</span>
                    <span className="text-sm text-blue-100">Start sharing and chatting</span>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white transition-transform group-hover:rotate-12">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                </button>
                
                <div className="relative flex items-center justify-center py-2">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200 dark:border-slate-700"></div></div>
                  <span className="relative bg-white dark:bg-slate-900 px-4 text-xs font-medium text-slate-400">OR</span>
                </div>

                <button
                  onClick={startReceive}
                  className="group relative flex w-full items-center justify-between rounded-2xl border-2 border-slate-200 bg-white px-6 py-5 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600 dark:hover:bg-slate-700"
                >
                  <div className="flex flex-col items-start gap-1">
                    <span className="text-xl font-bold text-slate-800 dark:text-white">Join Room</span>
                    <span className="text-sm text-slate-500 dark:text-slate-400">Enter a code to connect</span>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition-transform group-hover:translate-x-1 dark:bg-slate-700 dark:text-slate-300">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </div>
                </button>
              </div>
            )}

            {mode === 'receive' && status === 'idle' && (
              <SessionCode mode="receive" onJoin={joinRoom} />
            )}

            {mode === 'send' && (
              <SessionCode mode="send" code={sessionCode} token={roomToken} />
            )}

            {errorMsg && (
              <div className="mt-4 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 px-4 py-3 text-center text-sm text-red-700 dark:text-red-300">
                {errorMsg}
              </div>
            )}

            <footer className="mt-8 text-center text-xs text-slate-400">
              Transfers are device-to-device via WebRTC. Falls back to encrypted server relay when needed.
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

    </main>
  );
}
