'use client';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useSignaling } from '@/hooks/useSignaling';
import { useWebRTC } from '@/hooks/useWebRTC';
import { deriveKeyFromSecret, encryptChunk, decryptChunk } from '@/hooks/useCrypto';
import { parseDataTransfer, zipFolderEntry } from '@/hooks/useFolderZip';
import { saveBlobToDB, loadBlobFromDB, clearAllBlobsDB } from '@/utils/idb';

import DarkModeToggle from '@/app/components/ui/DarkModeToggle';
import FileDropZone from '@/app/components/FileDropZone';
import FolderZipModal from '@/app/components/FolderZipModal';
import DiscoveryNetwork from '@/app/components/lobby/DiscoveryNetwork';

function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function formatSpeed(bytesPerSec) {
  if (bytesPerSec < 1024) return `${bytesPerSec.toFixed(0)} B/s`;
  if (bytesPerSec < 1024 ** 2) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
  return `${(bytesPerSec / 1024 ** 2).toFixed(1)} MB/s`;
}

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function MediaPreview({ blob, mimeType, name }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    if (!blob) return;
    const objUrl = URL.createObjectURL(blob);
    setUrl(objUrl);
    return () => URL.revokeObjectURL(objUrl);
  }, [blob]);

  if (!url) return null;

  if (mimeType?.startsWith('image/')) {
    return (
      <div className="mt-3 overflow-hidden rounded-xl border border-border-secondary/50 dark:border-border-primary/50 shadow-sm max-w-[260px]">
        <img src={url} alt={name} className="w-full h-auto object-cover max-h-[180px]" loading="lazy" onDragStart={(e) => e.preventDefault()} />
      </div>
    );
  }
  if (mimeType?.startsWith('video/')) {
    return (
      <div className="mt-3 overflow-hidden rounded-xl border border-border-secondary/50 dark:border-border-primary/50 shadow-sm max-w-[260px]">
        <video src={url} controls className="w-full h-auto max-h-[180px]" />
      </div>
    );
  }
  if (mimeType?.startsWith('audio/')) {
    return (
      <div className="mt-3 w-full max-w-[260px]">
        <audio src={url} controls className="w-full h-9" />
      </div>
    );
  }
  return null;
}

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
  const [mode, setMode] = useState(null);
  const [sessionCode, setSessionCode] = useState('');
  const [roomToken, setRoomToken] = useState('');
  const [status, setStatus] = useState('idle');
  const [connectionType, setConnectionType] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [transfers, setTransfers] = useState([]); // file transfer items
  const [rtcState, setRtcState] = useState('idle');
  const [queueVersion, setQueueVersion] = useState(0);
  const [toasts, setToasts] = useState([]);
  const [peerNickname, setPeerNickname] = useState('');

  // ── Discovery State ────────────────────────────────────────────────
  const [nickname, setNickname] = useState('');
  const [hubId, setHubId] = useState(null);
  const [lobbyPeers, setLobbyPeers] = useState([]);
  const [isEditingNick, setIsEditingNick] = useState(false);
  const [incomingInvite, setIncomingInvite] = useState(null);
  const [pendingInvite, setPendingInvite] = useState(null);
  const [folderZipItems, setFolderZipItems] = useState(null);

  // ── Refs ───────────────────────────────────────────────────────────
  const cryptoKeyRef = useRef(null);
  const autoJoinHandled = useRef(false);
  const pendingFilesRef = useRef([]);
  const sendingLoopRunning = useRef(false);
  const receivingMsgIdRef = useRef(null);
  const currentSendingMsgIdRef = useRef(null);
  const handleRelayMessageRef = useRef(null);
  const audioContextRef = useRef(null);
  const pendingInvitePeerRef = useRef(null);
  const sessionRestoredRef = useRef(false);
  const lastConnectionQualityRef = useRef(null);
  const cleanupRef = useRef(null);
  const latestTransfersRef = useRef([]);

  useEffect(() => {
    latestTransfersRef.current = transfers;
  }, [transfers]);

  // ── Session persistence helpers ─────────────────────────────────────
  const saveSession = useCallback(() => {
    if (typeof window === 'undefined') return;
    const sessionData = {
      sessionCode,
      roomToken,
      peerNickname,
      mode,
      timestamp: Date.now(),
      transfers: latestTransfersRef.current.map(({ file, blob, ...t }) => ({ ...t })),
    };
    sessionStorage.setItem('p2p-session', JSON.stringify(sessionData));
  }, [sessionCode, roomToken, peerNickname, mode]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (sessionCode) saveSession();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [sessionCode, saveSession]);

  const clearSession = useCallback(() => {
    if (typeof window === 'undefined') return;
    sessionStorage.removeItem('p2p-session');
    clearAllBlobsDB();
  }, []);

  const getStoredSession = useCallback(() => {
    if (typeof window === 'undefined') return null;
    try {
      const data = sessionStorage.getItem('p2p-session');
      if (!data) return null;
      const session = JSON.parse(data);
      if (Date.now() - session.timestamp > 30 * 60 * 1000) {
        clearSession();
        return null;
      }
      return session;
    } catch {
      return null;
    }
  }, [clearSession]);

  // ── Transfer list helpers ──────────────────────────────────────────
  const addTransfer = useCallback((item) =>
    setTransfers((prev) => [...prev, item]), []);

  const updateTransfer = useCallback((id, updates) =>
    setTransfers((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t))), []);

  const pushToast = useCallback((text, tone = 'info') => {
    const id = genId();
    setToasts([{ id, text, tone }]);
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

  // Register service worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => console.log('SW Registered', reg))
        .catch((err) => console.error('SW Registration Failed', err));
    }
  }, []);

  // Cleanup AudioContext on unmount
  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
    };
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
        if (msg.payload?.code) {
          setSessionCode(msg.payload.code);
        }
        setStatus('waiting');
        setErrorMsg('');
        if (msg.payload?.isReconnect) {
          pushToast('Rejoined session! Restoring connection...', 'session');
        }
        break;
      case 'peer-joined':
        setPendingInvite(null);
        if (msg.payload?.nickname) setPeerNickname(msg.payload.nickname);
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
        cleanupRef.current?.();
        setStatus('idle');
        setMode(null);
        pendingFilesRef.current = [];
        setQueueVersion((v) => v + 1);
        setConnectionType(null);
        setRtcState('idle');
        setSessionCode('');
        setRoomToken('');
        clearSession();
        pushToast('Peer has left the session.', 'warning');
        setErrorMsg('');
        break;
      case 'peer-reconnecting':
        pushToast(`${msg.payload?.nickname || 'Peer'} is reconnecting...`, 'warning');
        break;
      case 'peer-reconnected':
        pushToast(`${msg.payload?.nickname || 'Peer'} reconnected!`, 'session');
        cleanupRef.current?.();
        createOffer();
        break;
      case 'left':
        setStatus('idle');
        break;
      case 'error':
        setErrorMsg(msg.payload.message);
        setStatus('error');
        if (msg.payload.message === 'Room not found' || msg.payload.message === 'Room no longer exists') {
          clearSession();
          if (sessionRestoredRef.current) {
            pushToast('Session expired. Please start a new connection.', 'warning');
            sessionRestoredRef.current = false;
          }
        }
        break;
      case 'disconnected':
        setHubId(null);
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

  // ── Signaling connection change handler ─────────────────────────────
  const handleSignalingConnectionChange = useCallback((state) => {
    if (state === 'disconnected' && (status === 'connected' || status === 'transferring')) {
      pushToast('Server connection lost. Reconnecting...', 'warning');
    } else if (state === 'connected' && sessionRestoredRef.current) {
      const storedSession = getStoredSession();
      if (storedSession?.sessionCode && status !== 'connected') {
        pushToast('Reconnected! Rejoining session...', 'session');
      }
    }
  }, [status, pushToast, getStoredSession]);

  const { send, wsState } = useSignaling(handleSignal, handleSignalingConnectionChange);

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
    sendPresenceEvent,
    getConnectionInfo,
    cleanup,
    handleRelayMessage,
  } = useWebRTC({
    onSignal: ({ type, payload }) => send({ type, payload }),
    wsSend: send,

    onPresence: (message) => {
      switch (message.type) {
        case 'identify':
          setPeerNickname(message.nickname || 'Peer');
          break;
        default:
          break;
      }
    },

    onProgress: (p) => {
      const activeId = currentSendingMsgIdRef.current || receivingMsgIdRef.current;
      if (activeId) updateTransfer(activeId, { progress: p.percent, speed: p.speed });
    },

    onFileMeta: ({ transferId, name, size, type }) => {
      const id = transferId || genId();
      receivingMsgIdRef.current = id;
      addTransfer({
        id, sender: 'peer',
        name, size, mimeType: type,
        status: 'receiving', progress: 0,
        timestamp: Date.now(),
      });
    },

    onFileReceived: async ({ blob }) => {
      const msgId = receivingMsgIdRef.current;
      receivingMsgIdRef.current = null;
      if (blob && msgId) {
        await saveBlobToDB(msgId, blob);
      }
      setTransfers((prev) =>
        prev.map((t) =>
          t.id === msgId
            ? { ...t, blob, status: 'received', progress: 100 }
            : t
        )
      );
      setStatus('connected');
    },

    onConnected: async () => {
      setStatus('connected');
      sendPresenceEvent('identify', { nickname });

      setPeerNickname((prev) => {
        if (prev) return prev;
        if (pendingInvite) return pendingInvite.toNick;
        if (incomingInvite) return incomingInvite.fromNick;
        return prev;
      });
      // Restore paused transfers
      setTransfers((prev) =>
        prev.map((t) => {
          if (t.status === 'paused' && t.sender === 'me')
            return { ...t, status: 'sending' };
          if (t.status === 'paused' && t.sender === 'peer')
            return { ...t, status: 'receiving' };
          return t;
        })
      );
      setTimeout(async () => {
        const info = await getConnectionInfo();
        if (info) {
          setConnectionType(info);
        }
      }, 2000);

      if (sessionRestoredRef.current) {
        pushToast('Reconnected to peer!', 'session');
        sessionRestoredRef.current = false;
      }
    },

    onPeerConnectionQuality: ({ quality }) => {
      if (lastConnectionQualityRef.current === quality) return;
      lastConnectionQualityRef.current = quality;

      switch (quality) {
        case 'unstable':
          pushToast('Connection unstable. Trying to reconnect...', 'warning');
          break;
        case 'stable':
          if (status === 'connected' || status === 'transferring') {
            const wasUnstable = lastConnectionQualityRef.current === 'unstable';
            if (wasUnstable) {
              pushToast('Connection restored!', 'session');
            }
          }
          break;
        case 'disconnected':
          pushToast('Peer connection lost. Switching to relay...', 'warning');
          break;
        default:
          break;
      }
    },

    onTransferPaused: () => {
      if (currentSendingMsgIdRef.current) {
        updateTransfer(currentSendingMsgIdRef.current, { status: 'paused' });
      }
      if (receivingMsgIdRef.current) {
        updateTransfer(receivingMsgIdRef.current, { status: 'paused' });
      }
      pushToast('Transfer paused — reconnecting… ⏸', 'warning');
    },

    onTransferError: (message) => {
      setErrorMsg(message);
      if (receivingMsgIdRef.current) {
        updateTransfer(receivingMsgIdRef.current, { status: 'error' });
        receivingMsgIdRef.current = null;
      }
      setStatus('connected');
    },

    onTransferCanceled: ({ transferId, sender }) => {
      if (!transferId) return;
      updateTransfer(transferId, { status: 'canceled', progress: 0 });
      if (sender === 'peer' && receivingMsgIdRef.current === transferId) {
        receivingMsgIdRef.current = null;
      }
      if (sender === 'me' && currentSendingMsgIdRef.current === transferId) {
        currentSendingMsgIdRef.current = null;
      }
      setStatus('connected');
    },

    onStateChange: (state) => {
      setRtcState(state);
    },

    encryptChunk: encryptFn,
    decryptChunk: decryptFn,
  });

  // Keep refs in sync
  useEffect(() => { handleRelayMessageRef.current = handleRelayMessage; }, [handleRelayMessage]);
  useEffect(() => { cleanupRef.current = cleanup; }, [cleanup]);

  // ── Session persistence ─────────────────────────────────────────────
  useEffect(() => {
    if (status === 'connected' && sessionCode) {
      saveSession();
    }
  }, [status, sessionCode, saveSession]);

  // Restore session state on mount
  useEffect(() => {
    if (sessionRestoredRef.current || autoJoinHandled.current) return;

    const storedSession = getStoredSession();
    if (!storedSession?.sessionCode) return;

    sessionRestoredRef.current = true;

    setSessionCode(storedSession.sessionCode);
    setRoomToken(storedSession.roomToken || '');
    setPeerNickname(storedSession.peerNickname || '');
    setMode(storedSession.mode || 'send');
    setStatus('waiting');

    if (storedSession.transfers) {
      const restored = storedSession.transfers.map((t) => {
        if (['sending', 'receiving', 'queued', 'paused'].includes(t.status)) {
          return { ...t, status: 'error', progress: 0 };
        }
        return t;
      });
      setTransfers(restored);

      // Restore blobs from IDB for received files
      restored.filter(t => t.status === 'received').forEach(async (t) => {
        const blob = await loadBlobFromDB(t.id);
        if (blob) {
          setTransfers(prev => prev.map(existing => existing.id === t.id ? { ...existing, blob } : existing));
        }
      });
    }

    setupDerivedKey(storedSession.sessionCode).catch(() => {
      setStatus('error');
      setErrorMsg('Could not restore session encryption.');
      clearSession();
      sessionRestoredRef.current = false;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Join room when WebSocket connects after session restore
  useEffect(() => {
    if (wsState !== 'connected') return;
    if (!sessionCode) return;
    send({ type: 'join', payload: { code: sessionCode } });
  }, [wsState, sessionCode, send]);

  // ── Auto-join from URL ─────────────────────────────────────────────
  useEffect(() => {
    if (autoJoinHandled.current || wsState !== 'connected') return;
    const params = new URLSearchParams(window.location.search);
    const joinToken = params.get('join');
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
  const startSend = () => { setErrorMsg(''); setMode('send'); send({ type: 'create' }); };

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
    clearSession();
    setMode(null); setStatus('idle'); setSessionCode(''); setRoomToken('');
    pendingFilesRef.current = []; setTransfers([]); setErrorMsg('');
    setConnectionType(null); setRtcState('idle');
    setPeerNickname('');
    setQueueVersion(0);
    setIncomingInvite(null); setPendingInvite(null);
    cryptoKeyRef.current = null;
    sendingLoopRunning.current = false;
    currentSendingMsgIdRef.current = null;
    receivingMsgIdRef.current = null;
    sessionRestoredRef.current = false;
    lastConnectionQualityRef.current = null;
  }, [leaveRoom, clearSession]);

  // ── Send loop ──────────────────────────────────────────────────────
  const runSendLoop = useCallback(async () => {
    if (sendingLoopRunning.current) return;
    sendingLoopRunning.current = true;
    try {
      while (pendingFilesRef.current.length > 0) {
        
        let targetIdx = -1;
        for (let i = 0; i < pendingFilesRef.current.length; i++) {
          const mId = pendingFilesRef.current[i].msgId;
          const t = latestTransfersRef.current.find(x => x.id === mId);
          if (t && ['queued', 'sending'].includes(t.status)) {
            targetIdx = i;
            break;
          }
        }

        if (targetIdx === -1) break; // no actionable files
        
        const { file, msgId } = pendingFilesRef.current[targetIdx];
        
        currentSendingMsgIdRef.current = msgId;
        updateTransfer(msgId, { status: 'sending', progress: 0 });
        setStatus('transferring');

        const completed = await sendFile(file, msgId);

        if (completed) {
          const finishIdx = pendingFilesRef.current.findIndex(x => x.msgId === msgId);
          if (finishIdx > -1) pendingFilesRef.current.splice(finishIdx, 1);
          setQueueVersion((v) => v + 1);
          updateTransfer(msgId, { status: 'sent', progress: 100 });
        } else {
          // It was paused/canceled/error. Check latest status to determine if we continue loop.
          const tCheck = latestTransfersRef.current.find(x => x.id === msgId);
          if (tCheck && tCheck.status === 'paused') {
            // Keep it in pendingFilesRef, but we continue the loop to find next queued file
            currentSendingMsgIdRef.current = null;
          } else {
             // Hard failure, stop queue
             break;
          }
        }
      }
    } finally {
      sendingLoopRunning.current = false;
      currentSendingMsgIdRef.current = null;
      setStatus((prev) => prev === 'idle' ? 'idle' : 'connected');
    }
  }, [sendFile, updateTransfer]);

  useEffect(() => {
    if (status === 'connected' && pendingFilesRef.current.length > 0) runSendLoop();
  }, [status, runSendLoop]);

  const isConnected = status === 'connected' || status === 'transferring';

  // ── File attach ────────────────────────────────────────────────────
  const handleFilesAttach = useCallback((files) => {
    if (!files?.length) return;
    const newItems = Array.from(files).map((file) => {
      const id = genId();
      pendingFilesRef.current = [...pendingFilesRef.current, { file, msgId: id }];
      return {
        id, sender: 'me',
        name: file.name, size: file.size, mimeType: file.type,
        file, status: 'queued', progress: 0,
        timestamp: Date.now(),
      };
    });
    setTransfers((prev) => [...prev, ...newItems]);
    setQueueVersion((v) => v + 1);
    if (status === 'connected') runSendLoop();
  }, [status, runSendLoop]);

  const handleDragOver = useCallback((event) => {
    if (!isConnected) return;
    if (!Array.from(event.dataTransfer?.types || []).includes('Files')) return;
    event.preventDefault();
  }, [isConnected]);

  // ── Folder zip modal helpers ───────────────────────────────────────
  const openFolderZipModal = useCallback((folderEntries) => {
    const initial = folderEntries.map(({ name }) => ({ name, state: 'zipping' }));
    setFolderZipItems(initial);

    folderEntries.forEach(({ name, entry }, idx) => {
      zipFolderEntry(entry, name)
        .then((zipFile) => {
          setFolderZipItems((prev) =>
            prev ? prev.map((item, i) =>
              i === idx ? { ...item, state: 'ready', zipFile } : item
            ) : prev
          );
        })
        .catch((err) => {
          console.error('Zip error:', err);
          setFolderZipItems((prev) =>
            prev ? prev.map((item, i) =>
              i === idx ? { ...item, state: 'error', error: err?.message || 'Failed to zip' } : item
            ) : prev
          );
        });
    });
  }, []);

  const handleFolderZipSend = useCallback((zipFile) => {
    handleFilesAttach([zipFile]);
    setFolderZipItems((prev) => {
      if (!prev) return null;
      const remaining = prev.filter((item) => item.zipFile !== zipFile);
      return remaining.length === 0 ? null : remaining;
    });
  }, [handleFilesAttach]);

  const handleFolderZipCancel = useCallback(() => {
    setFolderZipItems(null);
  }, []);

  const handleDropFiles = useCallback((event) => {
    if (!isConnected) return;
    if (!Array.from(event.dataTransfer?.types || []).includes('Files')) return;
    event.preventDefault();

    const { plainFiles, folderEntries } = parseDataTransfer(event.dataTransfer);

    if (plainFiles.length) handleFilesAttach(plainFiles);

    if (folderEntries.length > 0) {
      openFolderZipModal(folderEntries);
    }
  }, [isConnected, handleFilesAttach, openFolderZipModal]);

  const cancelQueuedFile = useCallback((msgId) => {
    const idx = pendingFilesRef.current.findIndex((x) => x.msgId === msgId);
    if (idx === 0 && status === 'transferring') return;
    if (idx >= 0) {
      pendingFilesRef.current.splice(idx, 1);
      setQueueVersion((v) => v + 1);
    }
    setTransfers((prev) => prev.filter((t) => t.id !== msgId));
  }, [status]);

  const cancelFileTransfer = useCallback((msgId) => {
    const item = transfers.find((t) => t.id === msgId);
    if (!item) return;

    if (item.status === 'queued') {
      cancelQueuedFile(msgId);
      return;
    }

    const canceled = cancelTransfer(msgId);
    if (!canceled) return;

    if (item.sender === 'me') {
      pendingFilesRef.current = pendingFilesRef.current.filter((x) => x.msgId !== msgId);
      currentSendingMsgIdRef.current = currentSendingMsgIdRef.current === msgId ? null : currentSendingMsgIdRef.current;
    } else {
      receivingMsgIdRef.current = receivingMsgIdRef.current === msgId ? null : receivingMsgIdRef.current;
    }

    setQueueVersion((v) => v + 1);
    updateTransfer(msgId, { status: 'canceled', progress: 0 });
  }, [cancelQueuedFile, cancelTransfer, transfers, updateTransfer]);

  // ── Reorder queue ──────────────────────────────────────────────────
  const reorderQueue = useCallback((fromIdx, toIdx) => {
    const arr = [...pendingFilesRef.current];
    const [moved] = arr.splice(fromIdx, 1);
    arr.splice(toIdx, 0, moved);
    pendingFilesRef.current = arr;
    setQueueVersion((v) => v + 1);
  }, []);

  // ── Download ───────────────────────────────────────────────────────
  const downloadFile = useCallback((item) => {
    const url = item.blob ? URL.createObjectURL(item.blob) : null;
    if (!url) return;
    const a = document.createElement('a');
    a.href = url; a.download = item.name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    updateTransfer(item.id, { downloaded: true });
  }, [updateTransfer]);

  const connectionLabel = connectionType?.type === 'relay'
    ? 'Relay (encrypted)'
    : connectionType
      ? 'Direct P2P'
      : status === 'transferring'
        ? 'Transferring'
        : status === 'connected'
          ? 'Connected'
          : 'Connecting';

  const connectionDotClass =
    status === 'error'
      ? 'bg-brand-danger'
      : status === 'connected'
        ? 'bg-brand-success'
        : status === 'transferring'
          ? 'bg-brand-primary animate-pulse'
          : 'bg-brand-warning animate-pulse';

  // Separate queued, active (sending/receiving), and completed transfers
  const activeTransfers = transfers.filter((t) =>
    ['sending', 'receiving', 'paused'].includes(t.status)
  );
  const queuedTransfers = pendingFilesRef.current
    .filter((q) => {
      const t = transfers.find((t) => t.id === q.msgId);
      return t && t.status === 'queued';
    })
    .map((q) => transfers.find((t) => t.id === q.msgId))
    .filter(Boolean);
  const completedTransfers = transfers.filter((t) =>
    ['sent', 'received', 'canceled', 'error'].includes(t.status)
  );

  // ────────────────────────────────────────────────────────────────────
  //  Render
  // ────────────────────────────────────────────────────────────────────
  return (
    <>
      <main
        className="min-h-screen bg-bg-secondary dark:bg-bg-tertiary"
        onDragOver={handleDragOver}
        onDrop={handleDropFiles}
      >

        {/* ══════  CONNECTED → FILE TRANSFER VIEW  ══════ */}
        {isConnected && (
          <div className="flex h-screen flex-col overflow-hidden bg-bg-secondary dark:bg-bg-tertiary">

            {/* Header */}
            <header className="sticky top-0 z-20 flex shrink-0 items-center justify-between gap-3 px-4 py-3 sm:px-5 lg:px-6 border-b border-border-secondary dark:border-border-primary">
              <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                <button
                  onClick={reset}
                  className="shrink-0 rounded-full border border-border-secondary bg-bg-primary px-3 py-2 text-xs font-semibold text-text-primary transition-colors hover:bg-bg-secondary dark:border-border-primary dark:bg-bg-secondary dark:text-text-primary dark:hover:bg-bg-tertiary sm:px-4"
                >
                  ← Leave
                </button>
                <div className="flex items-center gap-2.5 min-w-0">
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
                      {connectionLabel} · End-to-end encrypted 🔒
                    </p>
                  </div>
                </div>
              </div>
              <DarkModeToggle />
            </header>

            {/* Main content - centered when empty */}
            <div className={`flex-1 overflow-y-auto px-3 py-5 sm:px-4 lg:px-6 flex flex-col ${transfers.length === 0 ? 'justify-center' : ''}`}>
              <div className="mx-auto w-full max-w-3xl flex flex-col gap-5">

                {/* Drop Zone */}
                <FileDropZone onFilesSelect={handleFilesAttach} disabled={false} />

                {/* Send Queue */}
                {queuedTransfers.length > 0 && (
                  <div className="rounded-2xl border border-border-secondary dark:border-border-primary bg-bg-primary dark:bg-bg-secondary p-4">
                    <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-text-secondary">
                      Queue — {queuedTransfers.length} file{queuedTransfers.length > 1 ? 's' : ''} waiting
                    </p>
                    <div className="flex flex-col gap-2">
                      {queuedTransfers.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 rounded-xl bg-bg-secondary dark:bg-bg-tertiary px-3 py-2.5"
                        >
                          <div className="shrink-0 rounded-lg bg-bg-tertiary dark:bg-bg-secondary p-2">
                            <svg className="h-4 w-4 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-text-primary">{item.name}</p>
                            <p className="text-xs text-text-secondary">{formatSize(item.size)}</p>
                          </div>
                          <button
                            onClick={() => cancelQueuedFile(item.id)}
                            className="shrink-0 rounded-full p-1.5 text-text-secondary hover:text-brand-danger hover:bg-brand-danger/10 transition-colors"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Active Transfers */}
                {activeTransfers.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-secondary px-1">
                      Active Transfers
                    </p>
                    {activeTransfers.map((item) => {
                      const isMine = item.sender === 'me';
                      return (
                        <div
                          key={item.id}
                          className={`rounded-2xl border overflow-hidden transition-all ${
                            item.status === 'paused'
                              ? 'border-brand-warning/30 bg-brand-warning/5'
                              : 'border-brand-primary/20 bg-bg-primary dark:bg-bg-secondary'
                          }`}
                        >
                          <div className="flex items-center gap-3 px-4 py-3">
                            <div className={`shrink-0 rounded-xl p-2.5 ${isMine ? 'bg-brand-primary/10' : 'bg-brand-success/10'}`}>
                              <svg className={`h-5 w-5 ${isMine ? 'text-brand-primary' : 'text-brand-success'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                {isMine ? (
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                ) : (
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M7 10l5 5m0 0l5-5m-5 5V3" />
                                )}
                              </svg>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-text-primary">{item.name}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs text-text-secondary">{formatSize(item.size)}</span>
                                <span className="text-xs text-text-secondary">·</span>
                                <span className={`text-xs font-medium ${item.status === 'paused' ? 'text-brand-warning' : 'text-brand-primary'}`}>
                                  {item.status === 'paused' ? 'Paused' : `${item.progress || 0}%`}
                                </span>
                                {item.speed > 0 && (
                                  <>
                                    <span className="text-xs text-text-secondary">·</span>
                                    <span className="text-xs text-text-secondary">{formatSpeed(item.speed)}</span>
                                  </>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => cancelFileTransfer(item.id)}
                              className="shrink-0 rounded-full p-1.5 text-text-secondary hover:text-brand-danger hover:bg-brand-danger/10 transition-colors"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                          {/* Progress bar */}
                          <div className="px-4 pb-3">
                            <div className={`h-1.5 rounded-full overflow-hidden ${item.status === 'paused' ? 'bg-brand-warning/20' : 'bg-brand-primary/10'}`}>
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${item.status === 'paused' ? 'bg-brand-warning' : 'bg-brand-primary'}`}
                                style={{ width: `${item.progress || 0}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Completed Transfers */}
                {completedTransfers.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-secondary px-1">
                      Completed — {completedTransfers.length} file{completedTransfers.length > 1 ? 's' : ''}
                    </p>
                    {completedTransfers.map((item) => {
                      const isMine = item.sender === 'me';
                      const isError = item.status === 'error' || item.status === 'canceled';
                      return (
                        <div
                          key={item.id}
                          className={`flex flex-col rounded-xl px-4 py-3 transition-all ${
                            isError
                              ? 'bg-brand-danger/5 border border-brand-danger/10'
                              : 'bg-bg-primary dark:bg-bg-secondary border border-border-secondary dark:border-border-primary'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`shrink-0 rounded-lg p-2 ${
                              isError ? 'bg-brand-danger/10' : isMine ? 'bg-brand-primary/10' : 'bg-brand-success/10'
                            }`}>
                              {isError ? (
                                <svg className="h-4 w-4 text-brand-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              ) : (
                                <svg className={`h-4 w-4 ${isMine ? 'text-brand-primary' : 'text-brand-success'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                            
                            <div className="flex gap-2 min-w-0 flex-1">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between">
                                  <p className="truncate text-sm font-medium text-text-primary">{item.name}</p>
                                  <span className="text-[10px] text-text-secondary ml-2">{formatTime(item.timestamp)}</span>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-xs text-text-secondary">{formatSize(item.size)}</span>
                                  <span className="text-xs text-text-secondary">·</span>
                                  <span className={`text-xs font-medium ${
                                    isError ? 'text-brand-danger' : (item.status === 'paused' ? 'text-brand-warning' : (isMine ? 'text-brand-primary capitalize' : 'text-brand-success capitalize'))
                                  }`}>
                                    {item.status === 'sent' ? 'Sent ↑'
                                      : item.status === 'received' ? 'Received ↓'
                                      : item.status === 'error' ? 'Failed — Wait and retry'
                                      : item.status === 'canceled' ? 'Canceled'
                                      : item.status}
                                  </span>
                                </div>
                              </div>
                              
                              {/* Resume or Pause actions for active transfers */}
                              {['sending', 'queued'].includes(item.status) && (
                                <button
                                  onClick={() => pauseFileTransfer(item.id)}
                                  className="shrink-0 p-2 text-brand-warning hover:bg-brand-warning/10 rounded-full transition-colors self-center"
                                  title="Pause Transfer"
                                >
                                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                </button>
                              )}
                              
                              {item.status === 'paused' && item.sender === 'me' && (
                                <button
                                  onClick={() => resumeFileTransfer(item.id)}
                                  className="shrink-0 p-2 text-brand-success hover:bg-brand-success/10 rounded-full transition-colors self-center"
                                  title="Resume Transfer"
                                >
                                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                </button>
                              )}
                            </div>

                            {item.status === 'received' && item.blob && (
                              <button
                                draggable={!!item.blob}
                                onDragStart={(e) => handleDragOutStart(e, item)}
                                title="Click to download, or drag to desktop!"
                                onClick={() => downloadFile(item)}
                                className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors shadow-sm cursor-grab active:cursor-grabbing ${
                                  item.downloaded
                                    ? 'bg-bg-tertiary text-text-primary hover:bg-border-secondary'
                                    : 'bg-brand-primary text-white hover:bg-brand-primary-hover'
                                }`}
                              >
                                {item.downloaded ? 'Download Again ↓' : 'Download ↓'}
                              </button>
                            )}
                          </div>
                          
                          {/* Rich Media Preview */}
                          {item.status === 'received' && item.blob && (
                            <div className="ml-11">
                               <MediaPreview blob={item.blob} mimeType={item.mimeType} name={item.name} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}


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



            {/* Folder zip confirmation modal */}
            {folderZipItems && (
              <FolderZipModal
                items={folderZipItems}
                onSend={handleFolderZipSend}
                onCancel={handleFolderZipCancel}
              />
            )}
          </div>
        )}

        {/* ══════  PRE-CONNECTION VIEW  ══════ */}
        {!isConnected && (
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

              {!mode ? (
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
                        setMode('send');
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
                      <div className="h-24 w-24 rounded-full border-4 border-brand-primary/20 border-t-brand-primary animate-spin" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className={`flex h-16 w-16 items-center justify-center rounded-full text-xl font-bold text-white shadow-md ${getAvatarColor(pendingInvite?.toNick || peerNickname)}`}>
                          {(pendingInvite?.toNick || peerNickname || '?').charAt(0).toUpperCase()}
                        </div>
                      </div>
                    </div>
                    <h1 className="text-2xl font-bold text-text-primary dark:text-text-primary">
                      {pendingInvite
                        ? `Waiting for ${pendingInvite.toNick}...`
                        : (rtcState === 'connecting' || rtcState === 'checking' || status === 'waiting')
                          ? `Connecting to ${peerNickname || 'peer'}...`
                          : 'Establishing Connection'}
                    </h1>
                    <p className="mt-3 text-base text-text-secondary dark:text-text-secondary">
                      {pendingInvite
                        ? 'Waiting for peer to accept the connection.'
                        : (rtcState === 'connecting' || rtcState === 'checking' || (status === 'waiting' && mode === 'receive'))
                          ? 'Setting up secure P2P connection...'
                          : 'Waiting for peer to join the secure session...'}
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

        {/* ══════  TOASTS  ══════ */}
        <div className="pointer-events-none fixed right-4 top-4 z-60 flex w-[min(92vw,360px)] flex-col gap-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`rounded-xl border px-4 py-3 text-sm shadow-lg shadow-bg-tertiary/10 backdrop-blur ${toast.tone === 'session'
                  ? 'border-brand-success/20 bg-brand-success/5 text-brand-success dark:border-brand-success/30 dark:bg-brand-success/10 dark:text-brand-success'
                  : toast.tone === 'warning'
                    ? 'border-brand-warning/20 bg-brand-warning/5 text-brand-warning'
                    : 'border-border-secondary bg-bg-primary/95 text-text-primary dark:border-border-primary dark:bg-bg-secondary/95 dark:text-text-primary'
                }`}
            >
              {toast.text}
            </div>
          ))}
        </div>

      </main>

      {/* Incoming Invite Overlay */}
      {incomingInvite && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-3xl border border-border-secondary bg-bg-secondary p-8 shadow-2xl dark:border-border-primary dark:bg-bg-secondary">
            <div className="mb-6 flex flex-col items-center">
              <div className="relative mb-4">
                <div className={`flex h-20 w-20 items-center justify-center rounded-full text-2xl font-bold text-white shadow-lg ${getAvatarColor(incomingInvite.fromNick)}`}>
                  {(incomingInvite.fromNick || '?').charAt(0).toUpperCase()}
                </div>
                <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-brand-primary text-white shadow-sm ring-4 ring-bg-secondary">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                </span>
                <span className="absolute inset-0 h-full w-full animate-ping rounded-full bg-brand-primary/20" />
              </div>
              <h3 className="text-xl font-bold text-text-primary dark:text-text-primary">
                Incoming File Share
              </h3>
              <p className="mt-2 text-center text-sm text-text-secondary dark:text-text-secondary/80">
                <span className="font-bold text-text-primary dark:text-text-primary">{incomingInvite.fromNick}</span> wants to share files with you.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
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
                  setPeerNickname(incomingInvite.fromNick);
                  setStatus('waiting');
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
