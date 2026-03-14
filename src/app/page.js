'use client';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useSignaling } from '@/hooks/useSignaling';
import { useWebRTC } from '@/hooks/useWebRTC';
import { deriveKeyFromSecret, encryptChunk, decryptChunk } from '@/hooks/useCrypto';
import SessionCode from '@/app/components/SessionCode';
import ConnectionStatus from '@/app/components/ConnectionStatus';

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

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
    <div className={`w-64 sm:w-72 max-w-[80vw] rounded-2xl overflow-hidden shadow-sm ${bubble}`}>
      {isImg && previewUrl && (
        <button className="block w-full focus:outline-none" onClick={() => onPreview?.(previewUrl)}>
          <img
            src={previewUrl}
            alt={name}
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
            <button
              onClick={() => onCancel(msg.id)}
              className="rounded-lg border border-white/20 px-2 py-0.5 text-xs text-white/60 hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
          )}
          {!isMine && status === 'received' && (
            <button
              onClick={() => onDownload?.(msg)}
              className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
            >
              {isImg || isVid ? 'Save' : 'Download'}
            </button>
          )}
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

export default function Home() {
  const [mode, setMode] = useState(null);
  const [sessionCode, setSessionCode] = useState('');
  const [roomToken, setRoomToken] = useState('');
  const [status, setStatus] = useState('idle');
  const [connectionType, setConnectionType] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const [rtcState, setRtcState] = useState('idle');
  const [showTimeout, setShowTimeout] = useState(false);

  const cryptoKeyRef = useRef(null);
  const autoJoinHandled = useRef(false);
  const pendingFilesRef = useRef([]);
  const sendingLoopRunning = useRef(false);
  const receivingMsgIdRef = useRef(null);
  const currentSendingMsgIdRef = useRef(null);
  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);

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

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

  // ── handleSignal must be declared before useSignaling ─────────────────
  // We use a ref so useWebRTC hooks can be declared after, then wired in
  const handleRelayMessageRef = useRef(null);

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
        // Route relay messages to WebRTC hook
        handleRelayMessageRef.current?.(msg.payload);
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

  const {
    createOffer,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    sendFile,
    sendChatMessage,
    getConnectionInfo,
    cleanup,
    handleRelayMessage,
  } = useWebRTC({
    onSignal: ({ type, payload }) => send({ type, payload }),
    wsSend: send,   // ← relay fallback uses the same WS connection

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
      addMsg({
        id: id || genId(),
        type: 'text',
        sender: 'peer',
        text,
        timestamp: timestamp || Date.now(),
      });
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

  // Wire relay handler into the ref so handleSignal can call it
  useEffect(() => {
    handleRelayMessageRef.current = handleRelayMessage;
  }, [handleRelayMessage]);

  // ── Auto-join from URL ─────────────────────────────────────────────────
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

  // ── Room actions ───────────────────────────────────────────────────────
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
    setRtcState('idle');
    cryptoKeyRef.current = null;
    sendingLoopRunning.current = false;
    currentSendingMsgIdRef.current = null;
    receivingMsgIdRef.current = null;
  };

  // ── Send loop ──────────────────────────────────────────────────────────
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
    if (status === 'connected' && pendingFilesRef.current.length > 0) {
      runSendLoop();
    }
  }, [status, runSendLoop]);

  // ── Attach files ───────────────────────────────────────────────────────
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

  const cancelQueuedFile = useCallback((msgId) => {
    const idx = pendingFilesRef.current.findIndex((x) => x.msgId === msgId);
    if (idx === 0 && status === 'transferring') return;
    if (idx >= 0) pendingFilesRef.current.splice(idx, 1);
    setMessages((prev) => prev.filter((m) => m.id !== msgId));
  }, [status]);

  const handleSendText = useCallback(() => {
    const text = chatInput.trim();
    if (!text) return;
    if (sendChatMessage?.(text) === false) return;
    addMsg({ id: genId(), type: 'text', sender: 'me', text, timestamp: Date.now() });
    setChatInput('');
  }, [chatInput, sendChatMessage, addMsg]);

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

  const chatReady = status === 'connected' || status === 'transferring';

  return (
    <main className="flex min-h-screen flex-col bg-slate-100">

      {/* ════════  CHAT VIEW  ════════ */}
      {chatReady && (
        <div className="flex h-screen flex-col">
          <header className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-3 shadow-sm sm:gap-3 sm:px-4">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
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
                <p className="text-[10px] text-slate-400 sm:text-[11px]">
                  {connectionType?.type === 'relay' ? '🔄 Relay · E2E Encrypted' : '🔒 E2E Encrypted'}
                </p>
              </div>
            </div>
            <div className="shrink-0">
              <ConnectionStatus wsState={wsState} encrypted={!!cryptoKeyRef.current} />
            </div>
          </header>

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
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>

          {errorMsg && (
            <div className="shrink-0 border-t border-red-200 bg-red-50 px-4 py-2 text-center text-xs text-red-700">
              {errorMsg}
              <button onClick={() => setErrorMsg('')} className="ml-3 underline opacity-70">
                Dismiss
              </button>
            </div>
          )}

          <div className="shrink-0 border-t border-slate-200 bg-white px-2 py-2 sm:px-4 sm:py-3">
            <div className="flex items-end gap-1.5 sm:gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                title="Attach files"
                className="shrink-0 rounded-xl border border-slate-300 bg-white p-2 sm:p-2.5 text-slate-500 hover:bg-slate-100 transition-colors"
              >
                <svg className="h-5 w-5 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
              <textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendText();
                  }
                }}
                placeholder="Message…"
                rows={1}
                className="flex-1 resize-none rounded-xl border border-slate-300 bg-white px-3 py-2 sm:px-4 sm:py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-400 transition-colors"
                style={{ maxHeight: '120px', overflowY: 'auto' }}
              />
              <button
                onClick={handleSendText}
                disabled={!chatInput.trim()}
                title="Send message"
                className="shrink-0 rounded-xl bg-slate-900 p-2 sm:p-2.5 text-white hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="h-5 w-5 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                      If the session doesn't start soon, your network may be restricting connections.
                      The app will automatically switch to relay mode. Please wait a moment.
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

      {/* ════════  LIGHTBOX  ════════ */}
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
