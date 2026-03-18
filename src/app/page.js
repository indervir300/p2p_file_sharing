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
import DiscoveryNetwork from '@/app/components/lobby/DiscoveryNetwork';

function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const URL_REGEX = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)/gi;
const AVATAR_COLORS = [
  'bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500',
  'bg-pink-500', 'bg-indigo-500', 'bg-teal-500', 'bg-orange-500', 'bg-cyan-500'
];
function getAvatarColor(name) {
  if (!name) return 'bg-bg-tertiary';
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

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
  const [toasts, setToasts]                 = useState([]);
  const [peerWhiteboardActive, setPeerWhiteboardActive] = useState(false);
  const [peerNickname, setPeerNickname] = useState('');
  
  // ── Discovery State ────────────────────────────────────────────────
  const [nickname, setNickname]             = useState('');
  const [hubId, setHubId]                   = useState(null);
  const [lobbyPeers, setLobbyPeers]         = useState([]);
  const [isEditingNick, setIsEditingNick]   = useState(false);
  const [incomingInvite, setIncomingInvite] = useState(null); // { fromNick, roomCode, fromId }
  const [pendingInvite, setPendingInvite]   = useState(null); // { toNick, toId }

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
  const pendingInvitePeerRef   = useRef(null);
  const readReceiptsSentRef        = useRef(new Set());

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

  // Load/Save nickname
  useEffect(() => {
    const saved = localStorage.getItem('p2p-nickname');
    if (saved) setNickname(saved);
    else {
      const g = `Explorer-${Math.floor(Math.random() * 9000) + 1000}`;
      setNickname(g);
      localStorage.setItem('p2p-nickname', g);
    }
  }, []);


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
        
        // If we were trying to invite someone, do it now
        if (pendingInvitePeerRef.current) {
          send({ 
            type: 'invite', 
            payload: { 
              targetId: pendingInvitePeerRef.current.id, 
              roomCode: msg.payload.code 
            } 
          });
          pendingInvitePeerRef.current = null;
        }
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
      case 'disconnected':
        setHubId(null); // Force re-identification on reconnect
        break;
      case 'identified':
        setHubId(msg.payload.hubId);
        break;
      case 'lobby-update':
        setLobbyPeers(msg.payload.peers.filter((p) => p.id !== hubId));
        break;
      case 'invited':
        playIncomingSound();
        setIncomingInvite(msg.payload);
        break;
      case 'invite-rejected':
        pushToast(`${msg.payload.fromNick} declined your invitation.`, 'warning');
        setPendingInvite(null);
        reset();
        break;
      case 'invite-cancelled':
        pushToast(`Invitation from peer was cancelled.`, 'warning');
        setIncomingInvite(null);
        break;
      default:
        break;
    }
  }, [hubId, pushToast, playIncomingSound]); // eslint-disable-line react-hooks/exhaustive-deps

  const { send, wsState } = useSignaling(handleSignal);

  useEffect(() => {
    if (nickname && wsState === 'connected') {
      send({ type: 'identify', payload: { nickname } });
    }
  }, [nickname, wsState, send]);

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
    sendDeliveredReceipt,
    sendReadReceipt,
    sendLinkPreview,
    sendWhiteboardEvent,
    sendPresenceEvent,
    getConnectionInfo,
    cleanup,
    handleRelayMessage,
  } = useWebRTC({
    onSignal: ({ type, payload }) => send({ type, payload }),
    wsSend: send,

    onMessageDelivered: ({ msgId }) => {
      updateMsg(msgId, { status: 'delivered' });
    },

    onMessageRead: ({ msgId }) => {
      // All messages up to this point are also implicitly read in many systems, 
      // but we'll just update the specific one or all previous ones.
      setMessages((prev) => prev.map(m => {
        if (m.sender === 'me' && (m.id === msgId || m.status === 'delivered' || m.status === 'sent')) {
           // If we get a 'read' for a later message, we can assume earlier ones are read
           // But let's keep it simple for now: only update the target or if it's older
           return { ...m, status: 'read' };
        }
        return m;
      }));
    },

    onPresence: (message) => {
      switch (message.type) {
        case 'whiteboard-open':
          setPeerWhiteboardActive(true);
          break;
        case 'whiteboard-close':
          setPeerWhiteboardActive(false);
          break;
        case 'identify':
          setPeerNickname(message.nickname || 'Peer');
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
      sendDeliveredReceipt(id);
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
      sendPresenceEvent('identify', { nickname });
      
      // Fallback: Use nickname from invite if not already set
      setPeerNickname((prev) => {
        if (prev) return prev;
        if (pendingInvite) return pendingInvite.toNick;
        if (incomingInvite) return incomingInvite.fromNick;
        return prev;
      });
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
      const msgId = id || genId();
      addMsg({
        id: msgId, type: 'text', sender: 'peer',
        text, timestamp: timestamp || Date.now(),
        replyTo: replyTo || null,
      });
      sendDeliveredReceipt(msgId);
      if (document.visibilityState === 'visible') {
        sendReadReceipt(msgId);
        readReceiptsSentRef.current.add(msgId);
      }
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

  // Send read receipts when window becomes visible
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && (status === 'connected' || status === 'transferring')) {
        // Find unread peer messages and send read receipts
        messages.forEach((m) => {
          if (m.sender === 'peer' && !readReceiptsSentRef.current.has(m.id)) {
            sendReadReceipt(m.id);
            readReceiptsSentRef.current.add(m.id);
          }
        });
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [messages, status, sendReadReceipt]);

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

  const reset = useCallback(() => {
    leaveRoom();
    setMode(null); setStatus('idle'); setSessionCode(''); setRoomToken('');
    setLobbyCode('');
    pendingFilesRef.current = []; setMessages([]); setErrorMsg('');
    setConnectionType(null); setRtcState('idle'); setPeerTyping(false);
    setPeerNickname('');
    setShowWhiteboard(false); setReplyingTo(null); setQueueVersion(0);
    setIncomingInvite(null); setPendingInvite(null);
    cryptoKeyRef.current           = null;
    sendingLoopRunning.current     = false;
    currentSendingMsgIdRef.current = null;
    receivingMsgIdRef.current      = null;
    clearTimeout(typingTimeoutRef.current);
  }, [leaveRoom]);

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
      status: 'sent', // Initial status for double ticks
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
      prev.map((m) => {
        if (m.id !== msgId) return m;
        // Revoke URL if exists
        if (m.previewUrl) URL.revokeObjectURL(m.previewUrl);
        return { ...m, deleted: true, blob: null, previewUrl: null };
      })
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
      ? 'bg-brand-danger'
      : status === 'connected'
        ? 'bg-brand-success'
        : status === 'transferring'
          ? 'bg-brand-primary animate-pulse'
          : 'bg-brand-warning animate-pulse';

  // ────────────────────────────────────────────────────────────────────
  //  Render
  // ────────────────────────────────────────────────────────────────────
  return (
    <>
    <main
      className="min-h-screen bg-bg-secondary dark:bg-bg-tertiary"
      onDragEnter={handleDropEnter}
      onDragLeave={handleDropLeave}
      onDragOver={handleDropOver}
      onDrop={handleDropFiles}
    >

      {/* ══════  CHAT VIEW  ══════ */}
      {chatReady && (
        <div className="relative flex h-screen overflow-hidden bg-bg-secondary dark:bg-bg-tertiary">


          <div
            className="flex h-screen w-full flex-col overflow-hidden transition-all duration-300  border-l-0"
          >

          {/* Header */}
          <header className="sticky top-0 z-20 flex shrink-0 items-center justify-between gap-3 px-4 py-3 sm:px-5 lg:px-6">
            <div className="flex min-w-0 items-center gap-3 sm:gap-4">
              <button
                onClick={reset}
                className="shrink-0 rounded-full border border-border-secondary bg-bg-primary px-3 py-2 text-xs font-semibold text-text-primary transition-colors hover:bg-bg-secondary dark:border-border-primary dark:bg-bg-secondary dark:text-text-primary dark:hover:bg-bg-tertiary sm:px-4"
              >
                ← Leave
              </button>
              <div className="flex items-center gap-2.5 min-w-0">
                {/* Avatar */}
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white font-bold shadow-sm ${getAvatarColor(peerNickname)}`}>
                  {(peerNickname || '?').charAt(0).toUpperCase()}
                </div>
                
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <p className="truncate text-sm font-bold text-text-primary dark:text-text-primary sm:text-base">
                      {peerNickname || 'Connecting...'}
                    </p>
                    <span className="inline-flex items-center" title={connectionLabel} aria-label={connectionLabel}>
                      <span className={`h-2 w-2 rounded-full ${connectionDotClass}`} />
                    </span>
                  </div>
                  <p className="truncate text-[10px] font-medium text-text-secondary dark:text-text-secondary/60 uppercase tracking-wider leading-none">
                     {status === 'transferring' ? 'Sending files...' : 'Secure Session'}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => {
                  setShowWhiteboard(true);
                  sendWhiteboardEvent({ kind: 'wb-open' });
                  sendPresenceEvent('whiteboard-open');
                }}
                title="Open whiteboard"
                className={`relative flex h-9 w-9 items-center justify-center rounded-full border border-border-secondary bg-bg-primary text-text-secondary transition-colors hover:bg-bg-secondary dark:border-border-primary dark:bg-bg-secondary dark:text-text-secondary dark:hover:bg-bg-tertiary ${showWhiteboard ? 'ring-2 ring-brand-success/70' : ''} ${peerWhiteboardActive ? 'ring-2 ring-brand-success/70' : ''}`}
              >
                {peerWhiteboardActive && !showWhiteboard && (
                  <span className="pointer-events-none absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-brand-success animate-pulse" />
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
          <div className="flex-1 overflow-y-auto bg-bg-secondary px-3 py-4 dark:bg-bg-tertiary sm:px-4 sm:py-5 lg:px-6">
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-3">
              {messages.length === 0 && (
                <div className="mx-auto mt-8 max-w-md rounded-[28px] px-6 py-8 text-center">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-bg-tertiary text-brand-primary dark:bg-bg-tertiary dark:text-brand-primary">
                    <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4l-4 4v-4z" />
                    </svg>
                  </div>
                  <p className="text-base font-semibold text-text-primary dark:text-text-primary">
                    Start a conversation
                  </p>
                </div>
              )}

              {messages.map((msg) => {
                if (msg.type === 'system') {
                  return (
                    <div key={msg.id} className="flex justify-center py-1">
                      <span className="rounded-full bg-bg-secondary px-3 py-1.5 text-[11px] text-text-secondary dark:bg-bg-secondary dark:text-text-secondary">
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
                          onDelete={handleDelete}
                        />
                      )}

                      <p className={`mt-1 px-1 text-[10px] font-medium uppercase tracking-[0.18em] text-text-secondary ${isMine ? 'text-right' : 'text-left'}`}>
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

          {errorMsg && (
            <div className="shrink-0 border-t border-brand-danger/20 bg-brand-danger/5 px-4 py-2 text-center text-xs text-brand-danger">
              {errorMsg}
              <button onClick={() => setErrorMsg('')} className="ml-3 underline opacity-70">
                Dismiss
              </button>
            </div>
          )}

          <div className="shrink-0 px-3 py-2 sm:px-4 lg:px-5 bg-bg-secondary dark:bg-bg-tertiary">
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
            <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-bg-tertiary/10 p-5 backdrop-blur-[2px] dark:bg-bg-tertiary/30">
              <div className="pointer-events-auto w-full max-w-2xl">
                <FileDropZone onFilesSelect={handleFilesAttach} disabled={false} />
              </div>
            </div>
          )}
        </div>
      )}

      {!chatReady && (
        <div className="relative flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 w-full flex flex-col p-4 sm:p-6">

            <div className="flex items-center justify-between">
              {mode ? (
                <button
                  onClick={reset}
                  className="group inline-flex items-center gap-1.5 rounded-full bg-bg-primary px-3 py-1.5 text-sm font-semibold text-text-secondary transition-colors hover:bg-bg-secondary hover:text-text-primary dark:border-border-primary dark:bg-bg-secondary dark:text-text-secondary dark:hover:bg-bg-tertiary dark:hover:text-text-primary"
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
              <div className="flex flex-col w-full flex-1">
                <section className="flex flex-col items-center justify-center flex-1">
                  <div className="flex flex-col items-center gap-3">
                    <div className="flex items-center gap-2">
                      {isEditingNick ? (
                        <div className="flex items-center gap-2">
                          <input
                            autoFocus
                            className="rounded-lg border border-border-primary bg-bg-tertiary px-3 py-1.5 text-sm font-semibold text-text-primary outline-none focus:border-brand-primary"
                            value={nickname}
                            onChange={(e) => setNickname(e.target.value)}
                            onBlur={() => {
                              setIsEditingNick(false);
                              localStorage.setItem('p2p-nickname', nickname);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                setIsEditingNick(false);
                                localStorage.setItem('p2p-nickname', nickname);
                              }
                            }}
                          />
                        </div>
                      ) : (
                        <h2 className="text-xl font-bold text-text-primary">
                          Hi, {nickname}
                          <button
                            onClick={() => setIsEditingNick(true)}
                            className="ml-2 text-xs font-normal text-brand-primary hover:underline"
                          >
                            Edit
                          </button>
                        </h2>
                      )}
                    </div>
                    <p className="text-sm text-text-secondary">
                      You are visible on the radar below.
                    </p>
                  </div>
                  {/* Node Network Discovery */}
                  <DiscoveryNetwork
                    peers={lobbyPeers}
                    nickname={nickname}
                    onConnect={(peer) => {
                      if (pendingInvite) return;
                      pushToast(`Inviting ${peer.nickname}...`, 'session');
                      setPendingInvite({ toNick: peer.nickname, toId: peer.id });
                      pendingInvitePeerRef.current = peer;
                      send({ type: 'create' });
                    }}
                  />
                </section>
              </div>
            ) : (

              <div className="mx-auto w-full max-w-md text-center">
                <div className="mb-8 flex flex-col items-center">
                  <div className="relative mb-6">
                    <div className="h-20 w-20 rounded-full border-4 border-brand-primary/20 border-t-brand-primary animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="h-10 w-10 rounded-full bg-brand-primary animate-pulse" />
                    </div>
                  </div>
                  <h1 className="text-2xl font-bold text-text-primary dark:text-text-primary">
                    {pendingInvite ? `Waiting for ${pendingInvite.toNick}...` : 'Establishing Connection'}
                  </h1>
                  <p className="mt-3 text-base text-text-secondary dark:text-text-secondary">
                    {pendingInvite ? 'Waiting for peer to accept the connection.' : 'Waiting for peer to join the secure session...'}
                  </p>
                </div>
                
                <button
                  onClick={() => {
                    if (pendingInvite) {
                      send({ type: 'invite-cancel', payload: { targetId: pendingInvite.toId } });
                    }
                    reset();
                  }}
                  className="rounded-full border border-border-secondary px-6 py-2 text-sm font-medium text-text-secondary hover:bg-bg-secondary hover:text-text-primary transition-colors"
                >
                  Cancel Connect
                </button>
              </div>
            )}

            {errorMsg && (
              <div className="mt-6 rounded-xl border border-brand-danger/20 bg-brand-danger/5 px-4 py-3 text-center text-sm text-brand-danger dark:border-brand-danger/30 dark:bg-brand-danger/10 dark:text-brand-danger">
                {errorMsg}
              </div>
            )}
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
            className={`rounded-xl border px-4 py-3 text-sm shadow-lg shadow-bg-tertiary/10 backdrop-blur ${
              toast.tone === 'message'
                ? 'border-brand-primary/20 bg-brand-primary/5 text-brand-primary dark:border-brand-primary/30 dark:bg-brand-primary/10 dark:text-brand-primary'
                : toast.tone === 'navigation'
                  ? 'border-brand-warning/20 bg-brand-warning/5 text-brand-warning'
                  : toast.tone === 'session'
                    ? 'border-brand-success/20 bg-brand-success/5 text-brand-success dark:border-brand-success/30 dark:bg-brand-success/10 dark:text-brand-success'
                    : 'border-border-secondary bg-bg-primary/95 text-text-primary dark:border-border-primary dark:bg-bg-secondary/95 dark:text-text-primary'
            }`}
          >
            {toast.text}
          </div>
        ))}
      </div>

    </main>
    
    {/* Incoming Invite Overlay (Fixed to Viewport) */}
    {incomingInvite && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="w-full max-w-sm rounded-2xl border border-border-secondary bg-bg-secondary p-6 shadow-xl">
          <div className="mb-4 flex items-center justify-center">
            <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-brand-primary/10">
              <span className="absolute h-full w-full animate-ping rounded-full bg-brand-primary/20" />
              <svg className="h-8 w-8 text-brand-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
          </div>
          <h3 className="text-center text-xl font-bold text-text-primary mb-2">
            Incoming Connection
          </h3>
          <p className="text-center text-sm text-text-secondary mb-6">
            <strong className="text-text-primary">{incomingInvite.fromNick}</strong> wants to connect with you.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => {
                send({ type: 'invite-reject', payload: { targetId: incomingInvite.fromId } });
                setIncomingInvite(null);
              }}
              className="rounded-full border border-border-secondary px-4 py-2 text-sm font-semibold text-text-secondary transition-colors hover:bg-bg-tertiary"
            >
              Decline
            </button>
            <button
              onClick={() => {
                setMode('receive');
                joinRoom(incomingInvite.roomCode);
                setIncomingInvite(null);
              }}
              className="rounded-full bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-primary-hover shadow-md shadow-brand-primary/20"
            >
              Accept
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
