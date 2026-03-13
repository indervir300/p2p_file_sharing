'use client';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useSignaling } from '@/hooks/useSignaling';
import { useWebRTC } from '@/hooks/useWebRTC';
import { deriveKeyFromSecret, encryptChunk, decryptChunk } from '@/hooks/useCrypto';
import SessionCode from '@/app/components/SessionCode';
import FileDropZone from '@/app/components/FileDropZone';
import ProgressBar from '@/app/components/ProgressBar';
import ConnectionStatus from '@/app/components/ConnectionStatus';

export default function Home() {
  const [mode, setMode] = useState(null);           // 'send' | 'receive'
  const [sessionCode, setSessionCode] = useState('');
  const [roomToken, setRoomToken] = useState('');
  const [status, setStatus] = useState('idle');     // idle | waiting | connected | transferring | done | error
  const [progress, setProgress] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [sendQueue, setSendQueue] = useState([]);
  const [sendHistory, setSendHistory] = useState([]);
  const [receivedQueue, setReceivedQueue] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [connectionType, setConnectionType] = useState(null);

  const cryptoKeyRef = useRef(null);
  const autoJoinHandled = useRef(false);
  const pendingFilesRef = useRef([]);
  const sendingLoopRunning = useRef(false);

  const setupDerivedKey = useCallback(async (secret) => {
    const key = await deriveKeyFromSecret(secret);
    cryptoKeyRef.current = key;
  }, []);

  // ── Encryption wrappers ─────────────────────────────────────────────
  const encryptFn = useCallback(async (data) => {
    if (!cryptoKeyRef.current) return data;
    return encryptChunk(cryptoKeyRef.current, data);
  }, []);

  const decryptFn = useCallback(async (data) => {
    if (!cryptoKeyRef.current) {
      throw new Error('Missing encryption key');
    }
    return decryptChunk(cryptoKeyRef.current, data);
  }, []);

  // ── Signal handler ──────────────────────────────────────────────────
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
        setProgress(null);
        setSelectedFile(null);
        pendingFilesRef.current = [];
        setSendQueue([]);
        setErrorMsg('Peer disconnected. Room is available for a new connection.');
        break;
      case 'left':
        setStatus('idle');
        break;
      case 'error':
        setErrorMsg(msg.payload.message);
        setStatus('error');
        break;
    }
  }, []);

  const { send, wsState } = useSignaling(handleSignal);

  const { createOffer, handleOffer, handleAnswer, handleIceCandidate, sendFile, getConnectionInfo, cleanup } = useWebRTC({
    onSignal: ({ type, payload }) => send({ type, payload }),
    onProgress: (p) => { setProgress(p); setStatus('transferring'); },
    onConnected: async () => {
      setStatus('connected');
      // Detect connection type after a short delay
      setTimeout(async () => {
        const info = await getConnectionInfo();
        if (info) setConnectionType(info);
      }, 2000);
    },
    onFileReceived: ({ blob, name, size }) => {
      setReceivedQueue((prev) => [...prev, {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        blob,
        name,
        size,
      }]);
      setStatus('connected');
      setProgress(null);
    },
    onTransferError: (message) => {
      setStatus('error');
      setErrorMsg(message);
    },
    encryptChunk: encryptFn,
    decryptChunk: decryptFn,
  });

  // ── Auto-join from URL ──────────────────────────────────────────────
  useEffect(() => {
    if (autoJoinHandled.current) return;
    if (wsState !== 'connected') return;

    const params = new URLSearchParams(window.location.search);
    const joinToken = params.get('join');
    const codeFromUrl = params.get('code');

    if (joinToken) {
      autoJoinHandled.current = true;
      setMode('receive');

      const sharedSecret = codeFromUrl || joinToken;
      setupDerivedKey(sharedSecret).then(() => {
        send({ type: 'join', payload: { token: joinToken } });
      }).catch(() => {
        setStatus('error');
        setErrorMsg('Could not initialize secure join. Please request a new link.');
      });

      // Clean URL without reloading
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [wsState, send, setupDerivedKey]);

  // ── Actions ─────────────────────────────────────────────────────────
  const startSend = async () => {
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

  const runSendLoop = useCallback(async () => {
    if (sendingLoopRunning.current) return;
    if (status !== 'connected') return;
    if (pendingFilesRef.current.length === 0) return;

    sendingLoopRunning.current = true;
    setErrorMsg('');

    try {
      while (pendingFilesRef.current.length > 0) {
        const nextFile = pendingFilesRef.current[0];
        setSelectedFile(nextFile);
        setStatus('transferring');
        await sendFile(nextFile);

        pendingFilesRef.current.shift();
        setSendQueue([...pendingFilesRef.current]);
        setSendHistory((prev) => [...prev, {
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          name: nextFile.name,
          size: nextFile.size,
        }]);
      }
    } finally {
      sendingLoopRunning.current = false;
      setSelectedFile(null);
      setProgress(null);
      setStatus('connected');
    }
  }, [status, sendFile]);

  useEffect(() => {
    if (status === 'connected' && pendingFilesRef.current.length > 0) {
      runSendLoop();
    }
  }, [status, runSendLoop]);

  const handleFilesSelect = (files) => {
    if (!files?.length) return;
    const validFiles = files.filter(Boolean);
    if (!validFiles.length) return;

    pendingFilesRef.current = [...pendingFilesRef.current, ...validFiles];
    setSendQueue([...pendingFilesRef.current]);

    if (status === 'connected') {
      runSendLoop();
    }
  };

  const downloadFile = (fileItem) => {
    if (!fileItem) return;
    const url = URL.createObjectURL(fileItem.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileItem.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  const downloadAllFiles = () => {
    receivedQueue.forEach((fileItem, index) => {
      setTimeout(() => downloadFile(fileItem), index * 250);
    });
  };

  const backToRoom = () => {
    setProgress(null);
    setSelectedFile(null);
    setErrorMsg('');
    setStatus('connected');
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
    setProgress(null);
    setSelectedFile(null);
    pendingFilesRef.current = [];
    setSendQueue([]);
    setSendHistory([]);
    setReceivedQueue([]);
    setErrorMsg('');
    setConnectionType(null);
    cryptoKeyRef.current = null;
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 sm:px-6">
      <section className="mx-auto w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <header className="mb-8 text-center" style={{ animation: 'fadeIn 0.3s ease-out' }}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Secure Peer-to-Peer Transfer</p>
          <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">P2P FileShare</h1>
          <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600">
            Direct WebRTC file transfer with end-to-end encryption. No cloud storage and no retained files.
          </p>
        </header>

        <div className="mb-8">
          <ConnectionStatus
            wsState={wsState}
            encrypted={!!cryptoKeyRef.current}
            connectionType={connectionType}
          />
        </div>

        {!mode && (
          <div className="grid gap-4 sm:grid-cols-2" style={{ animation: 'slideUp 0.3s ease-out' }}>
            <button
              onClick={startSend}
              id="btn-send"
              className="rounded-xl bg-slate-900 px-6 py-4 text-base font-semibold text-white transition-colors hover:bg-slate-700"
            >
              Send File
            </button>
            <button
              onClick={startReceive}
              id="btn-receive"
              className="rounded-xl border border-slate-300 bg-white px-6 py-4 text-base font-semibold text-slate-800 transition-colors hover:bg-slate-100"
            >
              Receive File
            </button>
          </div>
        )}

        {mode === 'send' && (
          <div className="space-y-6" style={{ animation: 'slideUp 0.4s ease-out' }}>
            <SessionCode mode="send" code={sessionCode} token={roomToken} />

            {(status === 'connected' || status === 'transferring') && (
              <div>
                <p className="mb-4 text-center text-sm text-emerald-700">Receiver connected. Add one or multiple files.</p>
                <FileDropZone onFilesSelect={handleFilesSelect} disabled={status === 'transferring'} selectedFile={selectedFile} />

                {sendQueue.length > 0 && (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Pending Queue ({sendQueue.length})</p>
                    <div className="space-y-1">
                      {sendQueue.slice(0, 6).map((file, idx) => (
                        <p key={`${file.name}-${idx}`} className="truncate text-sm text-slate-700">{file.name}</p>
                      ))}
                      {sendQueue.length > 6 && (
                        <p className="text-xs text-slate-500">+ {sendQueue.length - 6} more</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {status === 'transferring' && (
              <div className="mt-4">
                <ProgressBar progress={progress} />
              </div>
            )}

            {sendHistory.length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sent Files ({sendHistory.length})</p>
                  <button
                    onClick={backToRoom}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                  >
                    Back To Room
                  </button>
                </div>
                <div className="space-y-1">
                  {sendHistory.slice(-8).reverse().map((file) => (
                    <p key={file.id} className="truncate text-sm text-slate-700">
                      {file.name} • {formatSize(file.size)}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {mode === 'receive' && (
          <div className="space-y-6" style={{ animation: 'slideUp 0.4s ease-out' }}>
            {status === 'idle' && <SessionCode mode="receive" onJoin={joinRoom} />}

            {status === 'waiting' && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-7 text-center">
                <p className="text-sm text-slate-600">Waiting for sender...</p>
              </div>
            )}

            {status === 'connected' && (
              <div className="space-y-4" style={{ animation: 'fadeIn 0.25s ease-out' }}>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-center">
                  <p className="font-medium text-emerald-700">Connected. Waiting for files.</p>
                </div>

                {receivedQueue.length > 0 && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Download Queue ({receivedQueue.length})</p>
                      <button
                        onClick={downloadAllFiles}
                        className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700"
                      >
                        Download All
                      </button>
                    </div>
                    <div className="space-y-2">
                      {receivedQueue.slice().reverse().map((file) => (
                        <div key={file.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-800">{file.name}</p>
                            <p className="text-xs text-slate-500">{formatSize(file.size)}</p>
                          </div>
                          <button
                            onClick={() => downloadFile(file)}
                            className="shrink-0 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                          >
                            Download
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {status === 'transferring' && (
              <div>
                <div className="mb-4 text-center">
                  <p className="font-medium text-slate-800">Receiving file</p>
                </div>
                <ProgressBar progress={progress} />
              </div>
            )}
          </div>
        )}

        {errorMsg && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center" style={{ animation: 'fadeIn 0.25s ease-out' }}>
            <p className="text-sm text-red-700">{errorMsg}</p>
          </div>
        )}

        {mode && (
          <button
            onClick={reset}
            id="btn-reset"
            className="mt-8 w-full rounded-xl border border-slate-300 bg-white py-2.5 text-sm text-slate-700 transition-colors hover:bg-slate-100"
          >
            Start Over
          </button>
        )}

        <footer className="mt-10 text-center text-xs text-slate-500">
          Transfers are device-to-device over WebRTC. The signaling server coordinates connection only.
        </footer>
      </section>
    </main>
  );
}
