'use client';
import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles, Activity, PanelRight, Zap, UploadCloud, PencilLine, ShieldCheck, X } from 'lucide-react';

import { useSignaling } from '@/hooks/useSignaling';
import { useWebRTC } from '@/hooks/useWebRTC';
import { deriveKeyFromSecret, encryptChunk, decryptChunk } from '@/hooks/useCrypto';
import { parseDataTransfer, zipFolderEntry } from '@/hooks/useFolderZip';
import { saveBlobToDB, loadBlobFromDB, clearAllBlobsDB } from '@/utils/idb';
import { formatSize } from '@/utils/format';

import DarkModeToggle from '@/app/components/ui/DarkModeToggle';
import Toasts from '@/app/components/ui/Toasts';
import SendSuccessOverlay from '@/app/components/ui/SendSuccessOverlay';
import FileDropZone from '@/app/components/FileDropZone';
import FolderZipModal from '@/app/components/FolderZipModal';
import DiscoveryNetwork from '@/app/components/lobby/DiscoveryNetwork';
import IncomingInviteModal from '@/app/components/lobby/IncomingInviteModal';
import ConnectingState from '@/app/components/lobby/ConnectingState';
import SessionHeader from '@/app/components/layout/SessionHeader';
import TransferPanel from '@/app/components/transfer/TransferPanel';
import ActiveTransferCard from '@/app/components/transfer/ActiveTransferCard';
import QueueList from '@/app/components/transfer/QueueList';

function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Save a blob to the user's device. Used by both manual and auto download. */
function triggerDownload(blob, name) {
  if (!blob) return false;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name || 'download';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  return true;
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

  // ── UI State (side panel, download mode, completion popup) ─────────
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelTab, setPanelTab] = useState('received');
  const [autoDownload, setAutoDownload] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [sendSummary, setSendSummary] = useState(null);
  const [dragOverlay, setDragOverlay] = useState(false);

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
  const autoDownloadRef = useRef(false);
  const panelOpenRef = useRef(false);
  const sendBatchRef = useRef({ count: 0, bytes: 0, startedAt: 0 });
  const dragDepthRef = useRef(0);
  // Room code we already hold a seat in on the current socket, so the rejoin
  // effect below doesn't fire a second `join` and get "Room is full" back.
  const joinedCodeRef = useRef('');

  useEffect(() => {
    latestTransfersRef.current = transfers;
  }, [transfers]);

  useEffect(() => { autoDownloadRef.current = autoDownload; }, [autoDownload]);
  useEffect(() => { panelOpenRef.current = panelOpen; }, [panelOpen]);

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

  // Restore UI preferences (download mode + panel state)
  useEffect(() => {
    try {
      setAutoDownload(localStorage.getItem('p2p-auto-download') === 'on');
      const storedPanel = localStorage.getItem('p2p-panel-open');
      setPanelOpen(storedPanel === null
        ? window.matchMedia('(min-width: 1024px)').matches
        : storedPanel === 'on');
    } catch {
      // Storage unavailable — fall back to defaults.
    }
  }, []);

  const setAutoDownloadPref = useCallback((next) => {
    setAutoDownload(next);
    try { localStorage.setItem('p2p-auto-download', next ? 'on' : 'off'); } catch {}
    pushToast(
      next
        ? 'Auto-download on — incoming files save automatically'
        : 'Manual mode — you choose what to save',
      next ? 'download' : 'info',
    );
  }, [pushToast]);

  const togglePanel = useCallback(() => {
    setPanelOpen((prev) => {
      const next = !prev;
      try { localStorage.setItem('p2p-panel-open', next ? 'on' : 'off'); } catch {}
      if (next) setUnreadCount(0);
      return next;
    });
  }, []);

  const openPanelTo = useCallback((tab) => {
    setPanelTab(tab);
    setPanelOpen(true);
    setUnreadCount(0);
    try { localStorage.setItem('p2p-panel-open', 'on'); } catch {}
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
        joinedCodeRef.current = msg.payload.code;
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
          joinedCodeRef.current = msg.payload.code;
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

  const { send, wsState, waitForBufferDrain } = useSignaling(handleSignal, handleSignalingConnectionChange);

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
    waitForRelayDrain: waitForBufferDrain,

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
      if (activeId) {
        updateTransfer(activeId, {
          progress: p.percent,
          speed: p.speed,
          transferred: p.sent ?? p.received,
        });
      }
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

      // Auto-download hands the file straight to the browser; manual mode waits
      // for the user to hit Download in the activity panel.
      let saved = false;
      const meta = latestTransfersRef.current.find((t) => t.id === msgId);
      if (autoDownloadRef.current && blob) {
        saved = triggerDownload(blob, meta?.name);
      }

      setTransfers((prev) =>
        prev.map((t) =>
          t.id === msgId
            ? { ...t, blob, status: 'received', progress: 100, downloaded: saved || t.downloaded }
            : t
        )
      );
      setStatus('connected');

      if (saved) {
        pushToast(`Saved ${meta?.name || 'file'} to your device`, 'download');
      } else {
        pushToast(`${meta?.name || 'A file'} received — ready to save`, 'session');
      }

      if (!panelOpenRef.current) setUnreadCount((c) => c + 1);
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
      pushToast('Transfer paused — reconnecting…', 'warning');
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

  // Join room when WebSocket connects after session restore, or re-join after
  // the socket drops. Skipped when we already hold a seat on this connection.
  useEffect(() => {
    if (wsState !== 'connected') {
      joinedCodeRef.current = '';
      return;
    }
    if (!sessionCode) return;
    if (joinedCodeRef.current === sessionCode) return;
    joinedCodeRef.current = sessionCode;
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
      joinedCodeRef.current = code;
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
    sendBatchRef.current = { count: 0, bytes: 0, startedAt: 0 };
    joinedCodeRef.current = '';
    setSendSummary(null);
    setUnreadCount(0);
  }, [leaveRoom, clearSession]);

  // ── Send loop ──────────────────────────────────────────────────────
  const runSendLoop = useCallback(async () => {
    if (sendingLoopRunning.current) return;
    sendingLoopRunning.current = true;
    sendBatchRef.current = { count: 0, bytes: 0, startedAt: Date.now() };
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
          sendBatchRef.current.count += 1;
          sendBatchRef.current.bytes += file?.size || 0;
          if (!panelOpenRef.current) setUnreadCount((c) => c + 1);
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

      // Whole queue drained — celebrate with the delivery receipt.
      const batch = sendBatchRef.current;
      if (batch.count > 0) {
        setSendSummary({
          count: batch.count,
          bytes: batch.bytes,
          elapsedMs: Date.now() - batch.startedAt,
        });
      }
      sendBatchRef.current = { count: 0, bytes: 0, startedAt: 0 };
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

  const handleWindowDragEnter = useCallback((event) => {
    if (!isConnected) return;
    if (!Array.from(event.dataTransfer?.types || []).includes('Files')) return;
    dragDepthRef.current += 1;
    setDragOverlay(true);
  }, [isConnected]);

  const handleWindowDragLeave = useCallback(() => {
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setDragOverlay(false);
  }, []);

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
    dragDepthRef.current = 0;
    setDragOverlay(false);
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
    if (!triggerDownload(item.blob, item.name)) return;
    updateTransfer(item.id, { downloaded: true });
  }, [updateTransfer]);

  const downloadAllPending = useCallback(() => {
    const pending = latestTransfersRef.current.filter(
      (t) => t.status === 'received' && t.blob && !t.downloaded
    );
    pending.forEach((item, i) => {
      setTimeout(() => downloadFile(item), i * 180);
    });
    if (pending.length) {
      pushToast(`Saving ${pending.length} file${pending.length > 1 ? 's' : ''}…`, 'download');
    }
  }, [downloadFile, pushToast]);

  /** Lets a received file be dragged straight out to the desktop (Chromium). */
  const handleDragOutStart = useCallback((event, item) => {
    if (!item?.blob) return;
    const url = URL.createObjectURL(item.blob);
    const mime = item.mimeType || 'application/octet-stream';
    try {
      event.dataTransfer.effectAllowed = 'copy';
      event.dataTransfer.setData('DownloadURL', `${mime}:${item.name}:${url}`);
    } catch {
      // Firefox/Safari don't support DownloadURL — the click path still works.
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }, []);

  // ── Keyboard shortcuts ─────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && panelOpenRef.current && window.innerWidth < 1024) {
        setPanelOpen(false);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        togglePanel();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePanel]);

  // ── Derived view data ──────────────────────────────────────────────
  const isRelay = connectionType?.type === 'relay';
  const connectionLabel = isRelay
    ? 'Relay'
    : connectionType
      ? 'Direct P2P'
      : status === 'transferring'
        ? 'Transferring'
        : status === 'connected'
          ? 'Connected'
          : 'Connecting';

  const activeTransfers = transfers.filter((t) =>
    ['sending', 'receiving', 'paused'].includes(t.status)
  );

  const queuedTransfers = useMemo(() => pendingFilesRef.current
    .filter((q) => {
      const t = transfers.find((t) => t.id === q.msgId);
      return t && t.status === 'queued';
    })
    .map((q) => transfers.find((t) => t.id === q.msgId))
    .filter(Boolean),
  // queueVersion tracks mutations of the pendingFilesRef array itself
  [transfers, queueVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  const completedTransfers = transfers.filter((t) =>
    ['sent', 'received', 'canceled', 'error'].includes(t.status)
  );

  const sentCount = completedTransfers.filter((t) => t.sender === 'me' && t.status === 'sent').length;
  const receivedCount = completedTransfers.filter((t) => t.sender === 'peer' && t.status === 'received').length;
  const isBusy = activeTransfers.length > 0 || queuedTransfers.length > 0;
  const hasActivity = isBusy || completedTransfers.length > 0;

  const connectingStep = pendingInvite ? 0 : (rtcState === 'connected' ? 2 : 1);

  // ────────────────────────────────────────────────────────────────────
  //  Render
  // ────────────────────────────────────────────────────────────────────
  return (
    <>
      <main
        className="aurora min-h-[100dvh] bg-bg-canvas"
        onDragOver={handleDragOver}
        onDragEnter={handleWindowDragEnter}
        onDragLeave={handleWindowDragLeave}
        onDrop={handleDropFiles}
      >

        {/* ══════  CONNECTED → FILE TRANSFER VIEW  ══════ */}
        {isConnected && (
          <div className="flex h-[100dvh] flex-col overflow-hidden">

            <SessionHeader
              peerNickname={peerNickname}
              status={status}
              connectionLabel={connectionLabel}
              isRelay={isRelay}
              sentCount={sentCount}
              receivedCount={receivedCount}
              autoDownload={autoDownload}
              onAutoDownloadChange={setAutoDownloadPref}
              panelOpen={panelOpen}
              onTogglePanel={togglePanel}
              unreadCount={unreadCount}
              onLeave={reset}
            />

            <div className="flex min-h-0 flex-1">

              {/* ── Workspace ── */}
              <div className="custom-scrollbar min-w-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
                <div className={`mx-auto flex w-full max-w-2xl flex-col gap-5 ${isBusy ? '' : 'min-h-full justify-center'}`}>

                  {!hasActivity && (
                    <div className="text-center">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-border-secondary bg-bg-primary/70 px-3 py-1 text-[11px] font-semibold text-text-secondary dark:border-border-primary dark:bg-bg-secondary/60">
                        <Sparkles className="h-3.5 w-3.5 text-brand-primary" strokeWidth={2.2} />
                        Channel open with {peerNickname || 'your peer'}
                      </span>
                      <h1 className="mt-4 text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
                        Send anything, <span className="text-gradient">instantly</span>
                      </h1>
                      <p className="mx-auto mt-2 max-w-sm text-sm text-text-secondary">
                        Files stream straight to the other device. Nothing is uploaded to a server.
                      </p>
                    </div>
                  )}

                  <FileDropZone onFilesSelect={handleFilesAttach} disabled={false} compact={hasActivity} />

                  {/* Active transfers */}
                  <AnimatePresence initial={false} mode="popLayout">
                    {activeTransfers.length > 0 && (
                      <motion.section
                        key="active"
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col gap-2.5"
                      >
                        <p className="flex items-center gap-1.5 px-1 text-[11px] font-bold uppercase tracking-[0.14em] text-text-secondary">
                          <Activity className="h-3.5 w-3.5 text-brand-primary" strokeWidth={2.4} />
                          In flight
                          <span className="rounded-full bg-brand-primary/12 px-1.5 py-px text-[10px] tabular-nums text-brand-primary">
                            {activeTransfers.length}
                          </span>
                        </p>
                        {activeTransfers.map((item) => (
                          <ActiveTransferCard key={item.id} item={item} onCancel={cancelFileTransfer} />
                        ))}
                      </motion.section>
                    )}
                  </AnimatePresence>

                  {/* Queue */}
                  <AnimatePresence initial={false}>
                    {queuedTransfers.length > 0 && (
                      <QueueList
                        key="queue"
                        items={queuedTransfers}
                        onCancel={cancelQueuedFile}
                        onClearAll={() => queuedTransfers.forEach((t) => cancelQueuedFile(t.id))}
                      />
                    )}
                  </AnimatePresence>

                  {/* Compact activity summary — the full list lives in the side panel */}
                  {completedTransfers.length > 0 && !panelOpen && (
                    <button
                      onClick={() => openPanelTo(receivedCount > 0 ? 'received' : 'sent')}
                      className="group flex items-center justify-between gap-3 rounded-2xl border border-border-secondary bg-bg-primary/60 px-4 py-3 text-left transition-colors hover:border-brand-primary/40 dark:border-border-primary dark:bg-bg-secondary/50"
                    >
                      <span className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary">
                          <PanelRight className="h-4 w-4" strokeWidth={2.2} />
                        </span>
                        <span>
                          <span className="block text-sm font-semibold text-text-primary">
                            {completedTransfers.length} completed transfer{completedTransfers.length > 1 ? 's' : ''}
                          </span>
                          <span className="block text-[11px] text-text-tertiary">
                            {sentCount} sent · {receivedCount} received · {formatSize(completedTransfers.reduce((s, t) => s + (t.size || 0), 0))}
                          </span>
                        </span>
                      </span>
                      <span className="shrink-0 text-xs font-bold text-brand-primary transition-transform group-hover:translate-x-0.5">
                        Open →
                      </span>
                    </button>
                  )}

                  {/* Auto-download hint on small screens where the header switch is hidden */}
                  <div className="flex items-center justify-center gap-1.5 pt-1 text-[11px] text-text-tertiary sm:hidden">
                    <Zap className={`h-3 w-3 ${autoDownload ? 'text-brand-primary' : ''}`} strokeWidth={2.4} />
                    {autoDownload ? 'Auto-download is on' : 'Manual download'} ·{' '}
                    <button onClick={() => openPanelTo('received')} className="font-semibold text-brand-primary">
                      change
                    </button>
                  </div>
                </div>
              </div>

              {/* ── Activity side panel ── */}
              <AnimatePresence>
                {panelOpen && (
                  <TransferPanel
                    open
                    onClose={togglePanel}
                    tab={panelTab}
                    onTabChange={setPanelTab}
                    items={completedTransfers}
                    onDownload={downloadFile}
                    onDragOut={handleDragOutStart}
                    autoDownload={autoDownload}
                    onAutoDownloadChange={setAutoDownloadPref}
                    onDownloadAll={downloadAllPending}
                  />
                )}
              </AnimatePresence>
            </div>

            {/* Error bar */}
            <AnimatePresence>
              {errorMsg && (
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 20, opacity: 0 }}
                  className="z-40 flex shrink-0 items-center justify-between gap-3 border-t border-brand-danger/20 bg-brand-danger/[0.07] px-4 py-2.5 text-xs font-medium text-brand-danger"
                >
                  <span className="truncate">{errorMsg}</span>
                  <button
                    onClick={() => setErrorMsg('')}
                    className="shrink-0 rounded-md p-1 opacity-70 transition-opacity hover:opacity-100"
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={2.4} />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* ══════  PRE-CONNECTION VIEW  ══════ */}
        {!isConnected && (
          <div className="flex min-h-[100dvh] flex-col">

            {/* Brand bar */}
            <header className="flex shrink-0 items-center justify-between gap-3 px-4 py-4 sm:px-6">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-brand text-white shadow-md" style={{ boxShadow: 'var(--shadow-glow)' }}>
                  <UploadCloud className="h-4.5 w-4.5" strokeWidth={2} />
                </span>
                <div className="leading-tight">
                  <p className="text-sm font-bold tracking-tight text-text-primary">Antigravity</p>
                  <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-text-tertiary">
                    Peer-to-peer transfer
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className={`hidden items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-semibold sm:inline-flex
                  ${wsState === 'connected'
                    ? 'border-brand-success/25 bg-brand-success/[0.08] text-brand-success'
                    : 'border-brand-warning/25 bg-brand-warning/[0.08] text-brand-warning'}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${wsState === 'connected' ? 'bg-brand-success' : 'animate-pulse bg-brand-warning'}`} />
                  {wsState === 'connected' ? 'Online' : 'Connecting…'}
                </span>
                {mode && (
                  <button
                    onClick={() => {
                      if (pendingInvite) {
                        send({ type: 'invite-cancel', payload: { targetId: pendingInvite.toId } });
                      }
                      reset();
                    }}
                    className="rounded-full border border-border-secondary bg-bg-primary/60 px-3 py-1.5 text-xs font-semibold text-text-secondary transition-colors hover:text-text-primary dark:border-border-primary dark:bg-bg-secondary/50"
                  >
                    Back
                  </button>
                )}
                <DarkModeToggle />
              </div>
            </header>

            {!mode ? (
              <section className="flex flex-1 flex-col items-center px-4 pb-6">
                {/* Identity */}
                <div className="flex flex-col items-center gap-3 text-center">
                  {isEditingNick ? (
                    <input
                      autoFocus
                      className="rounded-xl border border-border-primary bg-bg-primary px-4 py-2 text-center text-lg font-bold text-text-primary outline-none focus:border-brand-primary dark:bg-bg-secondary"
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
                  ) : (
                    <div className="flex items-center gap-2">
                      <h1 className="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
                        Hi, <span className="text-gradient">{nickname}</span>
                      </h1>
                      <button
                        onClick={() => setIsEditingNick(true)}
                        title="Change your display name"
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-text-tertiary transition-colors hover:bg-bg-tertiary hover:text-text-primary"
                      >
                        <PencilLine className="h-3.5 w-3.5" strokeWidth={2.2} />
                      </button>
                    </div>
                  )}
                  <p className="max-w-sm text-sm text-text-secondary">
                    Pick a device on the radar to open an encrypted channel. Nothing touches a server.
                  </p>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-success/10 px-2.5 py-1 text-[11px] font-semibold text-brand-success">
                    <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2.2} />
                    {lobbyPeers.length > 0
                      ? `${lobbyPeers.length} device${lobbyPeers.length > 1 ? 's' : ''} nearby`
                      : 'You are visible on this network'}
                  </span>
                </div>

                <DiscoveryNetwork
                  peers={lobbyPeers}
                  nickname={nickname}
                  busy={!!pendingInvite}
                  onConnect={(peer) => {
                    if (pendingInvite) return;
                    setMode('send');
                    pushToast(`Inviting ${peer.nickname}…`, 'session');
                    setPendingInvite({ toNick: peer.nickname, toId: peer.id });
                    pendingInvitePeerRef.current = peer;
                    send({ type: 'create' });
                  }}
                />
              </section>
            ) : (
              <ConnectingState
                peerName={pendingInvite?.toNick || peerNickname}
                step={connectingStep}
                title={pendingInvite
                  ? `Waiting for ${pendingInvite.toNick}`
                  : (rtcState === 'connecting' || rtcState === 'checking' || status === 'waiting')
                    ? `Connecting to ${peerNickname || 'peer'}`
                    : 'Establishing connection'}
                subtitle={pendingInvite
                  ? 'They need to accept before the channel opens.'
                  : (rtcState === 'connecting' || rtcState === 'checking' || (status === 'waiting' && mode === 'receive'))
                    ? 'Setting up a direct, encrypted peer-to-peer link…'
                    : 'Waiting for your peer to join the secure session…'}
                onCancel={() => {
                  if (pendingInvite) {
                    send({ type: 'invite-cancel', payload: { targetId: pendingInvite.toId } });
                  }
                  reset();
                }}
              />
            )}

            {errorMsg && (
              <div className="mx-auto mb-6 w-full max-w-md rounded-2xl border border-brand-danger/20 bg-brand-danger/[0.07] px-4 py-3 text-center text-sm font-medium text-brand-danger">
                {errorMsg}
              </div>
            )}
          </div>
        )}

        <Toasts toasts={toasts} />
      </main>

      {/* Full-window drop hint */}
      <AnimatePresence>
        {dragOverlay && isConnected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none fixed inset-0 z-[95] flex items-center justify-center bg-brand-primary/10 backdrop-blur-[2px]"
          >
            <div className="glass flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-brand-primary px-10 py-8 shadow-premium">
              <UploadCloud className="h-10 w-10 text-brand-primary" strokeWidth={1.6} />
              <p className="text-base font-bold text-text-primary">Drop to send</p>
              <p className="text-xs text-text-secondary">Files and folders welcome</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Folder zip confirmation */}
      <AnimatePresence>
        {folderZipItems && (
          <FolderZipModal
            items={folderZipItems}
            onSend={handleFolderZipSend}
            onCancel={handleFolderZipCancel}
          />
        )}
      </AnimatePresence>

      {/* Delivery receipt after the whole queue is sent */}
      <AnimatePresence>
        {sendSummary && (
          <SendSuccessOverlay
            summary={{ ...sendSummary, peer: peerNickname }}
            onClose={() => setSendSummary(null)}
            onViewSent={() => { setSendSummary(null); openPanelTo('sent'); }}
          />
        )}
      </AnimatePresence>

      {/* Incoming invite */}
      <AnimatePresence>
        {incomingInvite && (
          <IncomingInviteModal
            invite={incomingInvite}
            onDecline={() => {
              send({ type: 'invite-reject', payload: { targetId: incomingInvite.fromId } });
              setIncomingInvite(null);
            }}
            onAccept={() => {
              setMode('receive');
              setPeerNickname(incomingInvite.fromNick);
              setStatus('waiting');
              joinRoom(incomingInvite.roomCode);
              setIncomingInvite(null);
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}
