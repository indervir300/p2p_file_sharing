'use client';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useSignaling }    from '@/hooks/useSignaling';
import { useWebRTC }       from '@/hooks/useWebRTC';
import { deriveKeyFromSecret, encryptChunk, decryptChunk } from '@/hooks/useCrypto';

// Components
import SessionCode         from '@/app/components/SessionCode';
import ConnectionStatus    from '@/app/components/ConnectionStatus';
import NetworkBadge        from '@/app/components/connection/NetworkBadge';
import MessageBubble       from '@/app/components/chat/MessageBubble';
import FileBubble          from '@/app/components/chat/FileBubble';
import TypingIndicator     from '@/app/components/chat/TypingIndicator';
import ChatInput           from '@/app/components/chat/ChatInput';

function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function Home() {
  const [mode, setMode]                     = useState(null);
  const [sessionCode, setSessionCode]       = useState('');
  const [roomToken, setRoomToken]           = useState('');
  const [status, setStatus]                 = useState('idle');
  const [connectionType, setConnectionType] = useState(null);
  const [errorMsg, setErrorMsg]             = useState('');
  const [messages, setMessages]             = useState([]);
  const [lightboxUrl, setLightboxUrl]       = useState(null);
  const [rtcState, setRtcState]             = useState('idle');
  const [showTimeout, setShowTimeout]       = useState(false);
  const [peerTyping, setPeerTyping]         = useState(false);
  const [statsData, setStatsData]           = useState(null);
  const [speedHistory, setSpeedHistory]     = useState([]);

  const cryptoKeyRef              = useRef(null);
  const autoJoinHandled           = useRef(false);
  const pendingFilesRef           = useRef([]);
  const sendingLoopRunning        = useRef(false);
  const receivingMsgIdRef         = useRef(null);
  const currentSendingMsgIdRef    = useRef(null);
  const chatEndRef                = useRef(null);
  const typingTimeoutRef          = useRef(null);
  const handleRelayMessageRef     = useRef(null);
  const lastSpeedUpdateRef        = useRef(0);
  const sendReactionRef           = useRef(null); // keeps sendReaction stable in handleReaction

  // ── Message helpers ──────────────────────────────────────────────────
  const addMsg = useCallback((msg) => setMessages((prev) => [...prev, msg]), []);

  const addSystemMsg = useCallback((text) => {
    setMessages((prev) => [
      ...prev,
      { id: genId(), type: 'system', text, timestamp: Date.now() },
    ]);
  }, []);

  const updateMsg = useCallback((id, updates) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...updates } : m)));
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, peerTyping]);

  // ── Crypto ────────────────────────────────────────────────────────────
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

  // ── Reaction handler ─────────────────────────────────────────────────
  // fromPeer = true  → arrived over DataChannel, don't re-send
  // fromPeer = false → local user tapped, send to peer
  const handleReaction = useCallback((msgId, emoji, fromPeer = false) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== msgId) return m;
        const reactions = { ...(m.reactions || {}) };
        const existing  = reactions[emoji] || { count: 0, mine: false };

        if (!fromPeer && existing.mine) {
          // Toggle off own reaction
          const newCount = existing.count - 1;
          if (newCount <= 0) delete reactions[emoji];
          else reactions[emoji] = { count: newCount, mine: false };
        } else {
          reactions[emoji] = {
            count: existing.count + 1,
            mine:  !fromPeer ? true : existing.mine,
          };
        }
        return { ...m, reactions };
      })
    );

    if (!fromPeer) {
      sendReactionRef.current?.(msgId, emoji);
    }
  }, []);

  // ── Signaling ────────────────────────────────────────────────────────
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
    sendChatMessage,
    sendTyping,
    sendReaction,
    getConnectionInfo,
    cleanup,
    handleRelayMessage,
  } = useWebRTC({
    onSignal: ({ type, payload }) => send({ type, payload }),
    wsSend: send,

    // ── Progress ──────────────────────────────────────────────────────
    onProgress: (p) => {
      const activeId = currentSendingMsgIdRef.current || receivingMsgIdRef.current;
      if (activeId) updateMsg(activeId, { progress: p.percent });

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
      setSpeedHistory([]);
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
      addSystemMsg('Connected — end-to-end encrypted 🔒');
      setTimeout(async () => {
        const info = await getConnectionInfo();
        if (info) {
          setConnectionType(info);
          if (info.type === 'relay')
            addSystemMsg('Using secure server relay (direct P2P unavailable)');
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
      addMsg({
        id: id || genId(), type: 'text', sender: 'peer',
        text, timestamp: timestamp || Date.now(),
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

    onStats: (data) => setStatsData(data),

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

  // Keep sendReaction accessible in handleReaction without circular deps
  useEffect(() => { sendReactionRef.current = sendReaction; }, [sendReaction]);
  useEffect(() => { handleRelayMessageRef.current = handleRelayMessage; }, [handleRelayMessage]);

  // ── Auto-join from URL ───────────────────────────────────────────────
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

  // ── Room actions ────────────────────────────────────────────────────
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
    setMode(null);
    setStatus('idle');
    setSessionCode('');
    setRoomToken('');
    pendingFilesRef.current        = [];
    setMessages([]);
    setErrorMsg('');
    setConnectionType(null);
    setRtcState('idle');
    setPeerTyping(false);
    setStatsData(null);
    setSpeedHistory([]);
    cryptoKeyRef.current           = null;
    sendingLoopRunning.current     = false;
    currentSendingMsgIdRef.current = null;
    receivingMsgIdRef.current      = null;
    clearTimeout(typingTimeoutRef.current);
  };

  // ── Send loop ───────────────────────────────────────────────────────
  const runSendLoop = useCallback(async () => {
    if (sendingLoopRunning.current) return;
    sendingLoopRunning.current = true;
    try {
      while (pendingFilesRef.current.length > 0) {
        const { file, msgId } = pendingFilesRef.current[0];
        currentSendingMsgIdRef.current = msgId;
        updateMsg(msgId, { status: 'sending', progress: 0 });
        setStatus('transferring');
        setSpeedHistory([]);
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

  // ── File attach ─────────────────────────────────────────────────────
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
    if (status === 'connected') runSendLoop();
  }, [status, runSendLoop]);

  const cancelQueuedFile = useCallback((msgId) => {
    const idx = pendingFilesRef.current.findIndex((x) => x.msgId === msgId);
    if (idx === 0 && status === 'transferring') return;
    if (idx >= 0) pendingFilesRef.current.splice(idx, 1);
    setMessages((prev) => prev.filter((m) => m.id !== msgId));
  }, [status]);

  // ── Send text ───────────────────────────────────────────────────────
  const handleSendText = useCallback((text) => {
    if (!text) return;
    if (sendChatMessage?.(text) === false) return;
    addMsg({ id: genId(), type: 'text', sender: 'me', text, timestamp: Date.now() });
  }, [sendChatMessage, addMsg]);

  // ── Download ────────────────────────────────────────────────────────
  const downloadMsg = useCallback((msg) => {
    const url = msg.previewUrl || (msg.blob ? URL.createObjectURL(msg.blob) : null);
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = msg.name;
    a.click();
    if (msg.blob && !msg.previewUrl) setTimeout(() => URL.revokeObjectURL(url), 1500);
  }, []);

  const chatReady = status === 'connected' || status === 'transferring';

  // ════════════════════════════════════════════════════════════════════
  //  Render
  // ════════════════════════════════════════════════════════════════════
  return (
    <main className="flex min-h-screen flex-col bg-slate-100">

      {/* ══════  CHAT VIEW  ══════ */}
      {chatReady && (
        <div className="flex h-screen flex-col">

          {/* Header */}
          <header className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-3 shadow-sm sm:px-4">
            <div className="flex items-center gap-2 min-w-0 sm:gap-3">
              <button
                onClick={reset}
                className="shrink-0 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors sm:px-3"
              >
                ← Leave
              </button>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {sessionCode ? `Room ${sessionCode}` : 'Chat Session'}
                </p>
                <p className="text-[10px] text-slate-400">🔒 E2E Encrypted</p>
              </div>
            </div>
            <ConnectionStatus wsState={wsState} encrypted={!!cryptoKeyRef.current} />
          </header>

          {/* Network path badge — always visible, no toggle needed */}
          {connectionType && (
            <div className="shrink-0 flex justify-center py-1.5 bg-white border-b border-slate-100">
              <NetworkBadge connectionType={connectionType} rtt={statsData?.rtt} />
            </div>
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
                <div
                  key={msg.id}
                  className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                >
                  <div className="max-w-[85%] min-w-0 sm:max-w-[75%]">

                    {msg.type === 'text' && (
                      <MessageBubble
                        msg={msg}
                        isMine={isMine}
                        onReact={(msgId, emoji) => handleReaction(msgId, emoji, false)}
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

                    <p className={`mt-0.5 text-[10px] text-slate-400 ${isMine ? 'text-right' : 'text-left'}`}>
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour:   '2-digit',
                        minute: '2-digit',
                      })}
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
              <button onClick={() => setErrorMsg('')} className="ml-3 underline opacity-70">
                Dismiss
              </button>
            </div>
          )}

          {/* Chat input */}
          <ChatInput
            onSendText={handleSendText}
            onFilesAttach={handleFilesAttach}
            onTyping={sendTyping}
          />

        </div>
      )}

      {/* ══════  LOBBY VIEW  ══════ */}
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
                <button
                  onClick={startSend}
                  className="rounded-xl bg-slate-900 px-6 py-4 text-base font-semibold text-white hover:bg-slate-700 transition-colors"
                >
                  Start Session
                </button>
                <button
                  onClick={startReceive}
                  className="rounded-xl border border-slate-300 bg-white px-6 py-4 text-base font-semibold text-slate-800 hover:bg-slate-100 transition-colors"
                >
                  Join Session
                </button>
              </div>
            )}

            {mode === 'receive' && status === 'idle' && (
              <SessionCode mode="receive" onJoin={joinRoom} />
            )}

            {mode === 'send' && (
              <SessionCode mode="send" code={sessionCode} token={roomToken} />
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
                    <p className="mt-1 text-[11px] uppercase tracking-widest text-slate-400">
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
                        ? 'Direct P2P was blocked. Using server relay — still encrypted.'
                        : 'Restricted network detected. Switching to relay…'}
                    </p>
                  </div>
                )}

                {showTimeout && rtcState !== 'connected' && rtcState !== 'relay' && (
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-semibold text-slate-700">
                      Taking longer than expected?
                    </p>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                      The app will automatically switch to relay mode. Please wait.
                    </p>
                    <button
                      onClick={reset}
                      className="mt-3 w-full rounded-lg border border-slate-300 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                    >
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
              <button
                onClick={reset}
                className="mt-6 w-full rounded-xl border border-slate-300 py-2.5 text-sm text-slate-700 hover:bg-slate-100 transition-colors"
              >
                Start Over
              </button>
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
