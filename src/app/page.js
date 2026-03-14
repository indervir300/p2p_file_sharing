'use client';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useSignaling } from '@/hooks/useSignaling';
import { useWebRTC }    from '@/hooks/useWebRTC';
import { deriveKeyFromSecret, encryptChunk, decryptChunk } from '@/hooks/useCrypto';
import SessionCode      from '@/app/components/SessionCode';
import ConnectionStatus from '@/app/components/ConnectionStatus';

// ── Helpers ────────────────────────────────────────────────────────────
function formatSize(bytes) {
  if (bytes < 1024)       return `${bytes} B`;
  if (bytes < 1024 ** 2)  return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3)  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function formatSpeed(bytesPerSec) {
  if (bytesPerSec >= 1024 * 1024) return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
  if (bytesPerSec >= 1024)        return `${(bytesPerSec / 1024).toFixed(0)} KB/s`;
  return `${Math.round(bytesPerSec)} B/s`;
}

function formatBandwidth(kbps) {
  if (kbps == null) return '—';
  if (kbps >= 1000) return `${(kbps / 1000).toFixed(1)} Mbps`;
  return `${kbps} Kbps`;
}

function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ── SpeedGraph (SVG sparkline, no library needed) ──────────────────────
function SpeedGraph({ data }) {
  if (!data || data.length < 2) {
    return (
      <div className="flex h-14 items-center justify-center text-xs text-slate-400">
        No transfer in progress
      </div>
    );
  }

  const W = 280, H = 56, PAD = 4;
  const maxVal = Math.max(...data, 0.001);

  // Build polyline points
  const pts = data
    .map((v, i) => {
      const x = PAD + (i / Math.max(data.length - 1, 1)) * (W - PAD * 2);
      const y = H - PAD - (v / maxVal) * (H - PAD * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  // Filled area under curve
  const firstX = PAD;
  const lastX  = PAD + (W - PAD * 2);
  const areaPoints = `${firstX},${H - PAD} ${pts} ${lastX},${H - PAD}`;

  // Current value dot
  const lastVal = data[data.length - 1];
  const dotX    = lastX;
  const dotY    = H - PAD - (lastVal / maxVal) * (H - PAD * 2);

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-14"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="speedGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#6366f1" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {/* Grid line at midpoint */}
        <line
          x1={PAD} y1={H / 2} x2={W - PAD} y2={H / 2}
          stroke="#e2e8f0" strokeWidth="0.5" strokeDasharray="3,3"
        />
        {/* Fill area */}
        <polygon points={areaPoints} fill="url(#speedGrad)" />
        {/* Speed line */}
        <polyline
          points={pts}
          fill="none"
          stroke="#6366f1"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Current value dot */}
        <circle cx={dotX} cy={dotY} r="3" fill="#6366f1" />
      </svg>
      <div className="flex justify-between text-[10px] text-slate-400 mt-0.5 px-0.5">
        <span>0</span>
        <span className="font-medium text-indigo-600">
          {lastVal > 0 ? `Now: ${lastVal.toFixed(2)} MB/s` : 'Idle'}
        </span>
        <span>Peak: {maxVal.toFixed(2)} MB/s</span>
      </div>
    </div>
  );
}

// ── StatCard ───────────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent }) {
  const accents = {
    indigo:  'bg-indigo-50  border-indigo-100  text-indigo-700',
    emerald: 'bg-emerald-50 border-emerald-100 text-emerald-700',
    blue:    'bg-blue-50    border-blue-100    text-blue-700',
    violet:  'bg-violet-50  border-violet-100  text-violet-700',
    amber:   'bg-amber-50   border-amber-100   text-amber-700',
  };
  return (
    <div className={`rounded-xl border px-3 py-2.5 ${accents[accent] || accents.indigo}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider opacity-60">{label}</p>
      <p className="mt-0.5 text-sm font-bold leading-tight">{value ?? '—'}</p>
      {sub && <p className="text-[10px] opacity-50 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── StatsPanel ─────────────────────────────────────────────────────────
function StatsPanel({ stats, speedHistory, connectionType }) {
  const isRelay = stats?.mode === 'relay' || connectionType?.type === 'relay';

  return (
    <div className="shrink-0 border-b border-slate-200 bg-slate-50 px-4 py-3 space-y-3">
      {/* Row 1 — connection cards */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard
          label="RTT"
          value={stats?.rtt != null ? `${stats.rtt} ms` : '—'}
          sub={isRelay ? 'via relay' : 'direct'}
          accent="indigo"
        />
        <StatCard
          label="Bandwidth"
          value={formatBandwidth(stats?.bandwidth)}
          sub="outgoing"
          accent="emerald"
        />
        <StatCard
          label="Upload"
          value={stats?.sentPerSec > 0 ? formatSpeed(stats.sentPerSec) : '—'}
          sub="current"
          accent="blue"
        />
        <StatCard
          label="Download"
          value={stats?.recvPerSec > 0 ? formatSpeed(stats.recvPerSec) : '—'}
          sub="current"
          accent="violet"
        />
      </div>

      {/* Row 2 — network path pill */}
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
          isRelay
            ? 'bg-amber-100 text-amber-700'
            : 'bg-emerald-100 text-emerald-700'
        }`}>
          <span className={`h-1.5 w-1.5 rounded-full ${isRelay ? 'bg-amber-500' : 'bg-emerald-500'}`} />
          {isRelay
            ? 'Server Relay · WSS'
            : `Direct P2P · ${connectionType?.protocol?.toUpperCase() || 'UDP'}`
          }
        </span>
        {stats?.rtt != null && (
          <span className="text-[11px] text-slate-400">{stats.rtt} ms latency</span>
        )}
      </div>

      {/* Row 3 — speed graph */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
          Transfer Speed
        </p>
        <SpeedGraph data={speedHistory} />
      </div>
    </div>
  );
}

// ── TypingIndicator ────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="flex justify-start py-1">
      <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm bg-white border border-slate-200 px-4 py-3 shadow-sm">
        <div className="flex items-center gap-1">
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              className="h-2 w-2 rounded-full bg-slate-400 animate-bounce"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </div>
        <span className="text-xs text-slate-400">typing…</span>
      </div>
    </div>
  );
}

// ── FileBubble ─────────────────────────────────────────────────────────
function FileBubble({ msg, isMine, onDownload, onPreview, onCancel }) {
  const { mimeType = '', previewUrl, name, size, status = 'queued', progress = 0 } = msg;
  const isImg    = mimeType.startsWith('image/');
  const isVid    = mimeType.startsWith('video/');
  const isAud    = mimeType.startsWith('audio/');
  const isBusy   = status === 'sending' || status === 'receiving';
  const hasPreview = (isImg || isVid || isAud) && previewUrl;
  const bubble   = isMine
    ? 'bg-slate-900 text-white'
    : 'bg-white border border-slate-200 text-slate-800';

  return (
    <div className={`w-64 sm:w-72 max-w-[80vw] rounded-2xl overflow-hidden shadow-sm ${bubble}`}>
      {isImg && previewUrl && (
        <button className="block w-full focus:outline-none" onClick={() => onPreview?.(previewUrl)}>
          <img
            src={previewUrl} alt={name}
            className={`block w-full max-h-52 object-cover ${isBusy ? 'opacity-50' : 'hover:opacity-90 transition-opacity'}`}
          />
        </button>
      )}
      {isVid && previewUrl && !isBusy && (
        <video src={previewUrl} controls className="block w-full max-h-52 bg-black" />
      )}
      {isAud && previewUrl && !isBusy && (
        <div className="px-3 pt-3">
          <audio src={previewUrl} controls style={{ width: '100%', minWidth: 0 }} />
        </div>
      )}
      {!hasPreview && (
        <div className="flex items-center gap-3 px-4 py-3">
          <div className={`shrink-0 rounded-xl p-2.5 ${isMine ? 'bg-white/10' : 'bg-slate-100'}`}>
            <svg className={`h-5 w-5 ${isMine ? 'text-white' : 'text-slate-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className={`truncate text-sm font-medium ${isMine ? 'text-white' : 'text-slate-800'}`}>{name}</p>
            <p className={`text-xs ${isMine ? 'text-white/60' : 'text-slate-500'}`}>{formatSize(size)}</p>
          </div>
        </div>
      )}
      {hasPreview && (
        <p className={`truncate px-3 pt-1.5 text-xs ${isMine ? 'text-white/60' : 'text-slate-500'}`}>
          {name} · {formatSize(size)}
        </p>
      )}
      {isBusy && (
        <div className={`mx-3 my-2 h-1 rounded-full ${isMine ? 'bg-white/20' : 'bg-slate-200'}`}>
          <div
            className={`h-1 rounded-full transition-all duration-300 ${isMine ? 'bg-white' : 'bg-slate-700'}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
      <div className="flex items-center justify-between gap-2 px-3 pb-3 pt-1">
        <span className={`text-xs ${isMine ? 'text-white/50' : 'text-slate-400'}`}>
          {status === 'queued'    && 'Queued…'}
          {status === 'sending'   && `Sending ${progress}%`}
          {status === 'sent'      && '✓ Sent'}
          {status === 'receiving' && `Receiving ${progress}%`}
          {status === 'error'     && '✗ Error'}
        </span>
        <div className="flex items-center gap-1.5">
          {status === 'queued' && isMine && onCancel && (
            <button onClick={() => onCancel(msg.id)}
              className="rounded-lg border border-white/20 px-2 py-0.5 text-xs text-white/60 hover:bg-white/10 transition-colors">
              Cancel
            </button>
          )}
          {!isMine && status === 'received' && (
            <button onClick={() => onDownload?.(msg)}
              className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors">
              {isImg || isVid ? 'Save' : 'Download'}
            </button>
          )}
          {isMine && status === 'sent' && isImg && previewUrl && (
            <button onClick={() => onDownload?.(msg)}
              className="rounded-lg border border-white/20 px-3 py-1 text-xs font-medium text-white/70 hover:bg-white/10 transition-colors">
              Save
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
//  Main Page
// ══════════════════════════════════════════════════════════════════════
export default function Home() {
  const [mode, setMode]               = useState(null);
  const [sessionCode, setSessionCode] = useState('');
  const [roomToken, setRoomToken]     = useState('');
  const [status, setStatus]           = useState('idle');
  const [connectionType, setConnectionType] = useState(null);
  const [errorMsg, setErrorMsg]       = useState('');
  const [messages, setMessages]       = useState([]);
  const [chatInput, setChatInput]     = useState('');
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const [rtcState, setRtcState]       = useState('idle');
  const [showTimeout, setShowTimeout] = useState(false);
  const [peerTyping, setPeerTyping]   = useState(false);

  // Stats dashboard state
  const [statsData, setStatsData]       = useState(null);    // live WebRTC stats
  const [showStats, setShowStats]       = useState(false);   // toggle panel
  const [speedHistory, setSpeedHistory] = useState([]);      // MB/s values for graph

  const cryptoKeyRef              = useRef(null);
  const autoJoinHandled           = useRef(false);
  const pendingFilesRef           = useRef([]);
  const sendingLoopRunning        = useRef(false);
  const receivingMsgIdRef         = useRef(null);
  const currentSendingMsgIdRef    = useRef(null);
  const chatEndRef                = useRef(null);
  const fileInputRef              = useRef(null);
  const typingTimeoutRef          = useRef(null);
  const typingSentAtRef           = useRef(0);
  const handleRelayMessageRef     = useRef(null);
  const lastSpeedUpdateRef        = useRef(0);   // throttle speed history updates

  // ── Message helpers ────────────────────────────────────────────────
  const addMsg = useCallback((msg) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const addSystemMsg = useCallback((text) => {
    setMessages((prev) => [...prev, { id: genId(), type: 'system', text, timestamp: Date.now() }]);
  }, []);

  const updateMsg = useCallback((id, updates) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...updates } : m)));
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
    if (!cryptoKeyRef.current) throw new Error('Missing encryption key');
    return decryptChunk(cryptoKeyRef.current, data);
  }, []);

  // ── Signaling handler ──────────────────────────────────────────────
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
        addSystemMsg('Friend joined the room. Starting handshake...');
        createOffer();
        break;
      case 'offer':
        addSystemMsg('Secure offer received. Connecting...');
        handleOffer(msg.payload);
        break;
      case 'answer':
        addSystemMsg('Secure answer received. Finalizing...');
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
        setPeerTyping(false);
        setStatsData(null);
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
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { send, wsState } = useSignaling(handleSignal);

  const {
    createOffer,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    sendFile,
    sendChatMessage,
    sendTyping,
    getConnectionInfo,
    cleanup,
    handleRelayMessage,
  } = useWebRTC({
    onSignal: ({ type, payload }) => send({ type, payload }),
    wsSend:   send,

    // ── Progress: track speed history for graph ──
    onProgress: (p) => {
      const activeId = currentSendingMsgIdRef.current || receivingMsgIdRef.current;
      if (activeId) updateMsg(activeId, { progress: p.percent });

      // Throttle speed history to max once per second
      const now = Date.now();
      if (p.speed > 0 && now - lastSpeedUpdateRef.current > 1000) {
        lastSpeedUpdateRef.current = now;
        const mbps = parseFloat((p.speed / (1024 * 1024)).toFixed(3));
        setSpeedHistory((prev) => [...prev.slice(-59), mbps]);
      }
    },

    onFileMeta: ({ name, size, type }) => {
      const id = genId();
      receivingMsgIdRef.current = id;
      setSpeedHistory([]); // reset graph for each new incoming transfer
      addMsg({ id, type: 'file', sender: 'peer', name, size, mimeType: type, status: 'receiving', progress: 0, timestamp: Date.now() });
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
          m.id === msgId ? { ...m, blob, previewUrl, status: 'received', progress: 100 } : m
        )
      );
      setStatus('connected');
    },

    onConnected: async () => {
      setStatus('connected');
      addSystemMsg('Connected — end-to-end encrypted 🔒');
      setTimeout(async () => {
        const info = await getConnectionInfo();
        if (info) {
          setConnectionType(info);
          if (info.type === 'relay') {
            addSystemMsg('Using secure server relay (direct P2P unavailable on this network)');
          }
        }
      }, 2000);
    },

    onTransferError: (message) => {
      setErrorMsg(message);
      if (receivingMsgIdRef.current) {
        updateMsg(receivingMsgIdRef.current, { status: 'error' });
        receivingMsgIdRef.current = null;
      }
      setStatus('connected');
    },

    onChatMessage: ({ text, id, timestamp }) => {
      setPeerTyping(false);
      clearTimeout(typingTimeoutRef.current);
      addMsg({ id: id || genId(), type: 'text', sender: 'peer', text, timestamp: timestamp || Date.now() });
    },

    onTyping: () => {
      setPeerTyping(true);
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => setPeerTyping(false), 2500);
    },

    // ── Live stats callback ──────────────────────────────────────────
    onStats: (data) => {
      setStatsData(data);
    },

    onStateChange: (state) => {
      setRtcState(state);
      if (state === 'relay') {
        addSystemMsg('Direct P2P failed — switching to secure relay 🔄');
      } else if (state === 'failed' || state === 'disconnected') {
        addSystemMsg(`Connection ${state}. Switching to relay...`);
      }
    },

    encryptChunk: encryptFn,
    decryptChunk: decryptFn,
  });

  useEffect(() => {
    handleRelayMessageRef.current = handleRelayMessage;
  }, [handleRelayMessage]);

  // ── Auto-join from URL ─────────────────────────────────────────────
  useEffect(() => {
    if (autoJoinHandled.current || wsState !== 'connected') return;
    const params     = new URLSearchParams(window.location.search);
    const joinToken  = params.get('join');
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
      setErrorMsg('Could not initialize secure connection for this room code.');
    }
  };

  const leaveRoom = useCallback(() => { send({ type: 'leave' }); cleanup(); }, [send, cleanup]);

  const reset = () => {
    leaveRoom();
    setMode(null);
    setStatus('idle');
    setSessionCode('');
    setRoomToken('');
    pendingFilesRef.current = [];
    setMessages([]);
    setChatInput('');
    setErrorMsg('');
    setConnectionType(null);
    setRtcState('idle');
    setPeerTyping(false);
    setStatsData(null);
    setSpeedHistory([]);
    setShowStats(false);
    cryptoKeyRef.current         = null;
    sendingLoopRunning.current   = false;
    currentSendingMsgIdRef.current = null;
    receivingMsgIdRef.current    = null;
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
        setSpeedHistory([]); // reset graph for each new outgoing transfer
        await sendFile(file);
        currentSendingMsgIdRef.current = null;
        pendingFilesRef.current.shift();
        updateMsg(msgId, { status: 'sent', progress: 100 });
      }
    } finally {
      sendingLoopRunning.current     = false;
      currentSendingMsgIdRef.current = null;
      setStatus('connected');
    }
  }, [sendFile, updateMsg]);

  useEffect(() => {
    let timer;
    if (status === 'waiting' && mode) {
      setShowTimeout(false);
      timer = setTimeout(() => setShowTimeout(true), 15000);
    } else {
      setShowTimeout(false);
    }
    return () => clearTimeout(timer);
  }, [status, mode]);

  useEffect(() => {
    if (status === 'connected' && pendingFilesRef.current.length > 0) runSendLoop();
  }, [status, runSendLoop]);

  // ── Attach files ───────────────────────────────────────────────────
  const handleFilesAttach = useCallback((files) => {
    if (!files?.length) return;
    const newMsgs = Array.from(files).map((file) => {
      const id         = genId();
      const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
      pendingFilesRef.current = [...pendingFilesRef.current, { file, msgId: id }];
      return { id, type: 'file', sender: 'me', name: file.name, size: file.size, mimeType: file.type, file, previewUrl, status: 'queued', progress: 0, timestamp: Date.now() };
    });
    setMessages((prev) => [...prev, ...newMsgs]);
    if (status === 'connected') runSendLoop();
  }, [status, runSendLoop]);

  const cancelQueuedFile = useCallback((msgId) => {
    const idx = pendingFilesRef.current.findIndex((x) => x.msgId === msgId);
    if (idx === 0 && status === 'transferring') return;
    if (idx >= 0) pendingFilesRef.current.splice(idx, 1);
    setMessages((prev) => prev.filter((m) => m.id !== msgId));
  }, [status]);

  // ── Send text ──────────────────────────────────────────────────────
  const handleSendText = useCallback(() => {
    const text = chatInput.trim();
    if (!text) return;
    if (sendChatMessage?.(text) === false) return;
    addMsg({ id: genId(), type: 'text', sender: 'me', text, timestamp: Date.now() });
    setChatInput('');
  }, [chatInput, sendChatMessage, addMsg]);

  // ── Download ───────────────────────────────────────────────────────
  const downloadMsg = useCallback((msg) => {
    const url = msg.previewUrl || (msg.blob ? URL.createObjectURL(msg.blob) : null);
    if (!url) return;
    const a = document.createElement('a');
    a.href = url; a.download = msg.name; a.click();
    if (msg.blob && !msg.previewUrl) setTimeout(() => URL.revokeObjectURL(url), 1500);
  }, []);

  const chatReady = status === 'connected' || status === 'transferring';

  // ══════════════════════════════════════════════════════════════════
  //  Render
  // ══════════════════════════════════════════════════════════════════
  return (
    <main className="flex min-h-screen flex-col bg-slate-100">

      {/* ════════  CHAT VIEW  ════════ */}
      {chatReady && (
        <div className="flex h-screen flex-col">

          {/* Header */}
          <header className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-3 shadow-sm sm:gap-3 sm:px-4">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <button onClick={reset}
                className="shrink-0 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors sm:px-3">
                ← Leave
              </button>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {sessionCode ? `Room ${sessionCode}` : 'Chat Session'}
                </p>
                <p className="text-[10px] text-slate-400 sm:text-[11px]">
                  {connectionType?.type === 'relay' ? '🔄 Relay · E2E Encrypted' : '🔒 E2E Encrypted'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Stats toggle button */}
              <button
                onClick={() => setShowStats((s) => !s)}
                title="Connection stats"
                className={`rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${
                  showStats
                    ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                    : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                📊
              </button>
              <ConnectionStatus wsState={wsState} encrypted={!!cryptoKeyRef.current} />
            </div>
          </header>

          {/* Stats panel — slides in under header when toggled */}
          {showStats && (
            <StatsPanel
              stats={statsData}
              speedHistory={speedHistory}
              connectionType={connectionType}
            />
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-4 space-y-2 sm:px-4 sm:py-5">
            {messages.length === 0 && (
              <p className="mt-12 text-center text-xs text-slate-400">
                Say hi, or tap the paperclip to send a file 📎
              </p>
            )}

            {messages.map((msg) => {
              if (msg.type === 'system') {
                return (
                  <div key={msg.id} className="flex justify-center py-1">
                    <span className="rounded-full bg-slate-200 px-3 py-1 text-[11px] text-slate-500">
                      {msg.text}
                    </span>
                  </div>
                );
              }
              const isMine = msg.sender === 'me';
              return (
                <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                  <div className="max-w-[85%] sm:max-w-[75%] min-w-0">
                    {msg.type === 'text' && (
                      <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                        isMine
                          ? 'rounded-br-sm bg-slate-900 text-white'
                          : 'rounded-bl-sm bg-white border border-slate-200 text-slate-800'
                      }`}>
                        {msg.text}
                      </div>
                    )}
                    {msg.type === 'file' && (
                      <FileBubble
                        msg={msg} isMine={isMine}
                        onDownload={downloadMsg}
                        onPreview={(url) => setLightboxUrl(url)}
                        onCancel={cancelQueuedFile}
                      />
                    )}
                    <p className={`mt-0.5 text-[10px] text-slate-400 ${isMine ? 'text-right' : 'text-left'}`}>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              );
            })}

            {peerTyping && <TypingIndicator />}
            <div ref={chatEndRef} />
          </div>

          {/* Error banner */}
          {errorMsg && (
            <div className="shrink-0 border-t border-red-200 bg-red-50 px-4 py-2 text-center text-xs text-red-700">
              {errorMsg}
              <button onClick={() => setErrorMsg('')} className="ml-3 underline opacity-70">Dismiss</button>
            </div>
          )}

          {/* Input bar */}
          <div className="shrink-0 border-t border-slate-200 bg-white px-2 py-2 sm:px-4 sm:py-3">
            <div className="flex items-end gap-1.5 sm:gap-2">
              <button onClick={() => fileInputRef.current?.click()} title="Attach files"
                className="shrink-0 rounded-xl border border-slate-300 bg-white p-2 sm:p-2.5 text-slate-500 hover:bg-slate-100 transition-colors">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              </button>
              <input ref={fileInputRef} type="file" multiple className="hidden"
                onChange={(e) => { handleFilesAttach(Array.from(e.target.files || [])); e.target.value = ''; }}
              />
              <textarea
                value={chatInput}
                onChange={(e) => {
                  setChatInput(e.target.value);
                  const now = Date.now();
                  if (now - typingSentAtRef.current > 1500) {
                    typingSentAtRef.current = now;
                    sendTyping?.();
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendText(); }
                }}
                placeholder="Message…"
                rows={1}
                className="flex-1 resize-none rounded-xl border border-slate-300 bg-white px-3 py-2 sm:px-4 sm:py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-400 transition-colors"
                style={{ maxHeight: '120px', overflowY: 'auto' }}
              />
              <button onClick={handleSendText} disabled={!chatInput.trim()} title="Send message"
                className="shrink-0 rounded-xl bg-slate-900 p-2 sm:p-2.5 text-white hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════  LOBBY VIEW  ════════ */}
      {!chatReady && (
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-10">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <header className="mb-8 text-center">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                Secure Peer-to-Peer
              </p>
              <h1 className="text-3xl font-bold text-slate-900">FileShare &amp; Chat</h1>
              <p className="mt-2 text-sm text-slate-500">
                WebRTC · End-to-end encrypted · No cloud storage
              </p>
            </header>

            <div className="mb-6">
              <ConnectionStatus wsState={wsState} encrypted={!!cryptoKeyRef.current} />
            </div>

            {!mode && (
              <div className="grid gap-4 sm:grid-cols-2">
                <button onClick={startSend}
                  className="rounded-xl bg-slate-900 px-6 py-4 text-base font-semibold text-white hover:bg-slate-700 transition-colors">
                  Start Session
                </button>
                <button onClick={startReceive}
                  className="rounded-xl border border-slate-300 bg-white px-6 py-4 text-base font-semibold text-slate-800 hover:bg-slate-100 transition-colors">
                  Join Session
                </button>
              </div>
            )}

            {mode === 'receive' && status === 'idle' && (
              <SessionCode mode="receive" onJoin={joinRoom} />
            )}

            {mode === 'send' && (
              <div className="space-y-4">
                <SessionCode mode="send" code={sessionCode} token={roomToken} />
              </div>
            )}

            {mode && status === 'waiting' && (
              <div className="space-y-4">
                <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-slate-200 bg-slate-50 py-8 text-center">
                  <div className="relative">
                    <span className="absolute inset-0 block h-full w-full animate-ping rounded-full bg-slate-200 opacity-75" />
                    <span className="relative block h-3 w-3 rounded-full bg-slate-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700">
                      {mode === 'send' ? 'Waiting for peer to join…' : 'Connecting to session…'}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400 uppercase tracking-widest">
                      Status: {rtcState === 'idle' ? 'Negotiating' : rtcState.replace(/-/g, ' ')}
                    </p>
                  </div>
                </div>

                {(rtcState === 'failed' || rtcState === 'relay') && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    <p className="font-semibold">
                      {rtcState === 'relay' ? 'Switched to relay mode' : 'Connection failed'}
                    </p>
                    <p className="mt-1 text-xs opacity-80">
                      {rtcState === 'relay'
                        ? 'Direct P2P was blocked by your network. Using server relay — still encrypted.'
                        : 'This usually happens on restricted networks. Switching to relay…'}
                    </p>
                  </div>
                )}

                {showTimeout && rtcState !== 'connected' && rtcState !== 'relay' && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-500 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-semibold text-slate-700">Taking longer than expected?</p>
                    <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">
                      The app will automatically switch to relay mode. Please wait a moment.
                    </p>
                    <button onClick={reset}
                      className="mt-3 w-full rounded-lg border border-slate-300 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                      Cancel and Try Again
                    </button>
                  </div>
                )}
              </div>
            )}

            {errorMsg && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm text-red-700">
                {errorMsg}
              </div>
            )}

            {mode && (
              <button onClick={reset}
                className="mt-6 w-full rounded-xl border border-slate-300 py-2.5 text-sm text-slate-700 hover:bg-slate-100 transition-colors">
                Start Over
              </button>
            )}

            <footer className="mt-8 text-center text-xs text-slate-400">
              Transfers are device-to-device via WebRTC. Falls back to encrypted server relay when needed.
            </footer>
          </div>
        </div>
      )}

      {/* ════════  LIGHTBOX  ════════ */}
      {lightboxUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          onClick={() => setLightboxUrl(null)}>
          <button className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/25 transition-colors"
            onClick={() => setLightboxUrl(null)} aria-label="Close preview">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img src={lightboxUrl} alt="Full size preview"
            className="max-h-[90vh] max-w-full rounded-2xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </main>
  );
}
