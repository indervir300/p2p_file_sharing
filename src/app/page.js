'use client';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useSignaling } from '@/hooks/useSignaling';
import { useWebRTC } from '@/hooks/useWebRTC';
import { deriveKeyFromSecret, encryptChunk, decryptChunk } from '@/hooks/useCrypto';
import SessionCode from '@/app/components/SessionCode';
import ConnectionStatus from '@/app/components/ConnectionStatus';

/* ── tiny helpers ─────────────────────────────────────────────────── */
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/* ── FileBubble ───────────────────────────────────────────────────── */
function FileBubble({ msg, isMine, onDownload, onPreview, onCancel }) {
  const { mimeType = '', previewUrl, name, size, status = 'queued', progress = 0 } = msg;
  const isImg = mimeType.startsWith('image/');
  const isVid = mimeType.startsWith('video/');
  const isAud = mimeType.startsWith('audio/');
  const isBusy = status === 'sending' || status === 'receiving';
  const hasPreview = (isImg || isVid || isAud) && previewUrl;

  const bubble = isMine
    ? 'bg-slate-900 text-white'
    : 'bg-white border border-slate-200 text-slate-800';

  return (
    <div className={`w-64 rounded-2xl overflow-hidden shadow-sm ${bubble}`}>

      {/* ── Image ── */}
      {isImg && previewUrl && (
        <button className="block w-full focus:outline-none" onClick={() => onPreview?.(previewUrl)}>
          <img
            src={previewUrl}
            alt={name}
            className={`block w-full max-h-52 object-cover ${isBusy ? 'opacity-50' : 'hover:opacity-90 transition-opacity'}`}
          />
        </button>
      )}

      {/* ── Video ── */}
      {isVid && previewUrl && !isBusy && (
        <video src={previewUrl} controls className="block w-full max-h-52 bg-black" />
      )}

      {/* ── Audio ── */}
      {isAud && previewUrl && !isBusy && (
        <div className="px-3 pt-3">
          <audio src={previewUrl} controls style={{ width: '100%', minWidth: 0 }} />
        </div>
      )}

      {/* ── Generic file card (non-media or no preview yet) ── */}
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

      {/* ── Filename under media thumbnails ── */}
      {hasPreview && (
        <p className={`truncate px-3 pt-1.5 text-xs ${isMine ? 'text-white/60' : 'text-slate-500'}`}>
          {name} · {formatSize(size)}
        </p>
      )}

      {/* ── Progress bar ── */}
      {isBusy && (
        <div className={`mx-3 my-2 h-1 rounded-full ${isMine ? 'bg-white/20' : 'bg-slate-200'}`}>
          <div
            className={`h-1 rounded-full transition-all duration-300 ${isMine ? 'bg-white' : 'bg-slate-700'}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* ── Bottom status / action row ── */}
      <div className="flex items-center justify-between gap-2 px-3 pb-3 pt-1">
        <span className={`text-xs ${isMine ? 'text-white/50' : 'text-slate-400'}`}>
          {status === 'queued'    && 'Queued…'}
          {status === 'sending'   && `Sending ${progress}%`}
          {status === 'sent'      && '✓ Sent'}
          {status === 'receiving' && `Receiving ${progress}%`}
          {status === 'error'     && '✗ Error'}
        </span>

        <div className="flex items-center gap-1.5">
          {/* Cancel queued upload */}
          {status === 'queued' && isMine && onCancel && (
            <button
              onClick={() => onCancel(msg.id)}
              className="rounded-lg border border-white/20 px-2 py-0.5 text-xs text-white/60 hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
          )}

          {/* Download / Save for received files */}
          {!isMine && status === 'received' && (
            <button
              onClick={() => onDownload?.(msg)}
              className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
            >
              {isImg || isVid ? 'Save' : 'Download'}
            </button>
          )}

          {/* Save own sent image */}
          {isMine && status === 'sent' && isImg && previewUrl && (
            <button
              onClick={() => onDownload?.(msg)}
              className="rounded-lg border border-white/20 px-3 py-1 text-xs font-medium text-white/70 hover:bg-white/10 transition-colors"
            >
              Save
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   Main Page
══════════════════════════════════════════════════════════════════ */
export default function Home() {
  const [mode, setMode] = useState(null);          // 'send' | 'receive'
  const [sessionCode, setSessionCode] = useState('');
  const [roomToken, setRoomToken] = useState('');
  const [status, setStatus] = useState('idle');    // idle | waiting | connected | transferring | error
  const [connectionType, setConnectionType] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  // All messages: text, file, system
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [lightboxUrl, setLightboxUrl] = useState(null);

  const cryptoKeyRef = useRef(null);
  const autoJoinHandled = useRef(false);
  const pendingFilesRef = useRef([]);       // { file, msgId }[]
  const sendingLoopRunning = useRef(false);
  const receivingMsgIdRef = useRef(null);
  const currentSendingMsgIdRef = useRef(null);
  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);

  /* ── message helpers ─────────────────────────────────────────── */
  const addMsg = useCallback((msg) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const addSystemMsg = useCallback((text) => {
    setMessages((prev) => [
      ...prev,
      { id: genId(), type: 'system', text, timestamp: Date.now() },
    ]);
  }, []);

  const updateMsg = useCallback((id, updates) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...updates } : m)));
  }, []);

  // Auto-scroll to newest message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /* ── crypto ──────────────────────────────────────────────────── */
  const setupDerivedKey = useCallback(async (secret) => {
    const key = await deriveKeyFromSecret(secret);
    cryptoKeyRef.current = key;
  }, []);

  const encryptFn = useCallback(async (data) => {
    if (!cryptoKeyRef.current) return data;
    return encryptChunk(cryptoKeyRef.current, data);
  }, []);

  const decryptFn = useCallback(async (data) => {
    if (!cryptoKeyRef.current) throw new Error('Missing encryption key');
    return decryptChunk(cryptoKeyRef.current, data);
  }, []);

  /* ── signaling ───────────────────────────────────────────────── */
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
      case 'peer-disconnected':
        setStatus('waiting');
        pendingFilesRef.current = [];
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

  /* ── WebRTC ──────────────────────────────────────────────────── */
  const {
    createOffer, handleOffer, handleAnswer, handleIceCandidate,
    sendFile, sendChatMessage, getConnectionInfo, cleanup,
  } = useWebRTC({
    onSignal: ({ type, payload }) => send({ type, payload }),

    onProgress: (p) => {
      const activeId = currentSendingMsgIdRef.current || receivingMsgIdRef.current;
      if (activeId) updateMsg(activeId, { progress: p.percent });
    },

    onFileMeta: ({ name, size, type }) => {
      const id = genId();
      receivingMsgIdRef.current = id;
      addMsg({
        id,
        type: 'file',
        sender: 'peer',
        name,
        size,
        mimeType: type,
        status: 'receiving',
        progress: 0,
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
            : m,
        ),
      );
      setStatus('connected');
    },

    onConnected: async () => {
      setStatus('connected');
      addSystemMsg('Connected — end-to-end encrypted 🔒');
      setTimeout(async () => {
        const info = await getConnectionInfo();
        if (info) setConnectionType(info);
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
      addMsg({
        id: id || genId(),
        type: 'text',
        sender: 'peer',
        text,
        timestamp: timestamp || Date.now(),
      });
    },

    encryptChunk: encryptFn,
    decryptChunk: decryptFn,
  });

  /* ── auto-join from URL ──────────────────────────────────────── */
  useEffect(() => {
    if (autoJoinHandled.current) return;
    if (wsState !== 'connected') return;
    const params = new URLSearchParams(window.location.search);
    const joinToken = params.get('join');
    const codeFromUrl = params.get('code');
    if (!joinToken) return;
    autoJoinHandled.current = true;
    setMode('receive');
    const sharedSecret = codeFromUrl || joinToken;
    setupDerivedKey(sharedSecret)
      .then(() => send({ type: 'join', payload: { token: joinToken } }))
      .catch(() => {
        setStatus('error');
        setErrorMsg('Could not initialize secure join. Please request a new link.');
      });
    window.history.replaceState({}, '', window.location.pathname);
  }, [wsState, send, setupDerivedKey]);

  /* ── room actions ────────────────────────────────────────────── */
  const startSend = () => {
    setErrorMsg('');
    setMode('send');
    send({ type: 'create' });
  };

  const startReceive = () => {
    setErrorMsg('');
    setMode('receive');
    setStatus('idle');
  };

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
    pendingFilesRef.current = [];
    setMessages([]);
    setChatInput('');
    setErrorMsg('');
    setConnectionType(null);
    cryptoKeyRef.current = null;
    sendingLoopRunning.current = false;
    currentSendingMsgIdRef.current = null;
    receivingMsgIdRef.current = null;
  };

  /* ── send loop ───────────────────────────────────────────────── */
  const runSendLoop = useCallback(async () => {
    if (sendingLoopRunning.current) return;
    sendingLoopRunning.current = true;
    try {
      while (pendingFilesRef.current.length > 0) {
        const { file, msgId } = pendingFilesRef.current[0];
        currentSendingMsgIdRef.current = msgId;
        updateMsg(msgId, { status: 'sending', progress: 0 });
        setStatus('transferring');
        await sendFile(file);
        currentSendingMsgIdRef.current = null;
        pendingFilesRef.current.shift();
        updateMsg(msgId, { status: 'sent', progress: 100 });
      }
    } finally {
      sendingLoopRunning.current = false;
      currentSendingMsgIdRef.current = null;
      setStatus('connected');
    }
  }, [sendFile, updateMsg]);

  useEffect(() => {
    if (status === 'connected' && pendingFilesRef.current.length > 0) {
      runSendLoop();
    }
  }, [status, runSendLoop]);

  /* ── attach files ────────────────────────────────────────────── */
  const handleFilesAttach = useCallback((files) => {
    if (!files?.length) return;
    const newMsgs = Array.from(files).map((file) => {
      const id = genId();
      const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
      pendingFilesRef.current = [...pendingFilesRef.current, { file, msgId: id }];
      return {
        id,
        type: 'file',
        sender: 'me',
        name: file.name,
        size: file.size,
        mimeType: file.type,
        file,
        previewUrl,
        status: 'queued',
        progress: 0,
        timestamp: Date.now(),
      };
    });
    setMessages((prev) => [...prev, ...newMsgs]);
    if (status === 'connected') runSendLoop();
  }, [status, runSendLoop]);

  /* ── cancel queued file ──────────────────────────────────────── */
  const cancelQueuedFile = useCallback((msgId) => {
    const idx = pendingFilesRef.current.findIndex((x) => x.msgId === msgId);
    // Don't cancel the file currently being sent
    if (idx === 0 && status === 'transferring') return;
    if (idx >= 0) pendingFilesRef.current.splice(idx, 1);
    setMessages((prev) => prev.filter((m) => m.id !== msgId));
  }, [status]);

  /* ── send text message ───────────────────────────────────────── */
  const handleSendText = useCallback(() => {
    const text = chatInput.trim();
    if (!text) return;
    if (sendChatMessage?.(text) === false) return;
    addMsg({ id: genId(), type: 'text', sender: 'me', text, timestamp: Date.now() });
    setChatInput('');
  }, [chatInput, sendChatMessage, addMsg]);

  /* ── download / save file ────────────────────────────────────── */
  const downloadMsg = useCallback((msg) => {
    if (msg.previewUrl) {
      const a = document.createElement('a');
      a.href = msg.previewUrl;
      a.download = msg.name;
      a.click();
      return;
    }
    if (msg.blob) {
      const url = URL.createObjectURL(msg.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = msg.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    }
  }, []);

  /* ── chat is ready when peer is connected ────────────────────── */
  const chatReady = status === 'connected' || status === 'transferring';

  /* ══════════════════════════════════════════════════════════════
     Render
  ══════════════════════════════════════════════════════════════ */
  return (
    <main className="flex min-h-screen flex-col bg-slate-100">

      {/* ════════════  CHAT VIEW  ════════════ */}
      {chatReady && (
        <div className="flex h-screen flex-col">

          {/* ── Header bar ── */}
          <header className="flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
            <button
              onClick={reset}
              className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
            >
              ← Leave
            </button>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900">
                P2P Chat{sessionCode ? ` · room ${sessionCode}` : ''}
              </p>
              <p className="text-[11px] text-slate-400">
                {connectionType
                  ? (connectionType.relayed ? '🔀 Relayed (TURN)' : '⚡ Direct (P2P)')
                  : '🌐 Establishing…'}
                {' · '}🔒 E2E Encrypted
              </p>
            </div>

            <div className="shrink-0">
              <ConnectionStatus
                wsState={wsState}
                encrypted={!!cryptoKeyRef.current}
                connectionType={connectionType}
              />
            </div>
          </header>

          {/* ── Messages scroll area ── */}
          <div className="flex-1 overflow-y-auto px-4 py-5 space-y-2">
            {messages.length === 0 && (
              <p className="mt-12 text-center text-xs text-slate-400">
                Say hi, or tap the paperclip to send a file 📎
              </p>
            )}

            {messages.map((msg) => {
              /* system event pill */
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
                  <div className="max-w-[75%] min-w-0">

                    {/* Text bubble */}
                    {msg.type === 'text' && (
                      <div
                        className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap wrap-break-word ${
                          isMine
                            ? 'rounded-br-sm bg-slate-900 text-white'
                            : 'rounded-bl-sm bg-white border border-slate-200 text-slate-800'
                        }`}
                      >
                        {msg.text}
                      </div>
                    )}

                    {/* File bubble */}
                    {msg.type === 'file' && (
                      <FileBubble
                        msg={msg}
                        isMine={isMine}
                        onDownload={downloadMsg}
                        onPreview={(url) => setLightboxUrl(url)}
                        onCancel={cancelQueuedFile}
                      />
                    )}

                    {/* Timestamp */}
                    <p className={`mt-0.5 text-[10px] text-slate-400 ${isMine ? 'text-right' : 'text-left'}`}>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>

          {/* ── Error banner ── */}
          {errorMsg && (
            <div className="shrink-0 border-t border-red-200 bg-red-50 px-4 py-2 text-center text-xs text-red-700">
              {errorMsg}
              <button onClick={() => setErrorMsg('')} className="ml-3 underline opacity-70">
                Dismiss
              </button>
            </div>
          )}

          {/* ── Input bar ── */}
          <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-3">
            <div className="flex items-end gap-2">

              {/* Attach files */}
              <button
                onClick={() => fileInputRef.current?.click()}
                title="Attach files"
                className="shrink-0 rounded-xl border border-slate-300 bg-white p-2.5 text-slate-500 hover:bg-slate-100 transition-colors"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  handleFilesAttach(Array.from(e.target.files || []));
                  e.target.value = '';
                }}
              />

              {/* Text input */}
              <textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendText();
                  }
                }}
                placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
                rows={1}
                className="flex-1 resize-none rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-400 transition-colors"
                style={{ maxHeight: '120px', overflowY: 'auto' }}
              />

              {/* Send */}
              <button
                onClick={handleSendText}
                disabled={!chatInput.trim()}
                title="Send message"
                className="shrink-0 rounded-xl bg-slate-900 p-2.5 text-white hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════  LOBBY VIEW  ════════════ */}
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
              <ConnectionStatus
                wsState={wsState}
                encrypted={!!cryptoKeyRef.current}
                connectionType={connectionType}
              />
            </div>

            {/* Mode selection */}
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

            {/* Sender: show room code + shareable link */}
            {mode === 'send' && (
              <div className="space-y-4">
                <SessionCode mode="send" code={sessionCode} token={roomToken} />
                {status === 'waiting' && (
                  <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 py-5">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-slate-400" />
                    <p className="text-sm text-slate-500">Waiting for peer to join…</p>
                  </div>
                )}
              </div>
            )}

            {/* Receiver: enter room code */}
            {mode === 'receive' && status === 'idle' && (
              <SessionCode mode="receive" onJoin={joinRoom} />
            )}

            {/* Receiver: connecting... */}
            {mode === 'receive' && status === 'waiting' && (
              <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 py-5">
                <span className="h-2 w-2 animate-pulse rounded-full bg-slate-400" />
                <p className="text-sm text-slate-500">Connecting to session…</p>
              </div>
            )}

            {/* Error */}
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
              Transfers are device-to-device via WebRTC. The signaling server only coordinates the connection.
            </footer>
          </div>
        </div>
      )}

      {/* ════════════  IMAGE LIGHTBOX  ════════════ */}
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
