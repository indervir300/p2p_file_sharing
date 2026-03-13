'use client';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useSignaling } from '@/hooks/useSignaling';
import { useWebRTC } from '@/hooks/useWebRTC';
import { generateKey, exportKey, importKey, encryptChunk, decryptChunk } from '@/hooks/useCrypto';
import SessionCode from '@/app/components/SessionCode';
import FileDropZone from '@/app/components/FileDropZone';
import ProgressBar from '@/app/components/ProgressBar';
import ConnectionStatus from '@/app/components/ConnectionStatus';

export default function Home() {
  const [mode, setMode] = useState(null);           // 'send' | 'receive'
  const [sessionCode, setSessionCode] = useState('');
  const [roomToken, setRoomToken] = useState('');
  const [encKeyString, setEncKeyString] = useState('');
  const [status, setStatus] = useState('idle');     // idle | waiting | connected | transferring | done | error
  const [progress, setProgress] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [receivedFile, setReceivedFile] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [connectionType, setConnectionType] = useState(null);

  const cryptoKeyRef = useRef(null);
  const autoJoinHandled = useRef(false);

  // ── Encryption wrappers ─────────────────────────────────────────────
  const encryptFn = useCallback(async (data) => {
    if (!cryptoKeyRef.current) return data;
    return encryptChunk(cryptoKeyRef.current, data);
  }, []);

  const decryptFn = useCallback(async (data) => {
    if (!cryptoKeyRef.current) return data;
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
      setReceivedFile({ blob, name, size });
      setStatus('done');
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
    const hashKey = window.location.hash.slice(1); // Remove the #

    if (joinToken) {
      autoJoinHandled.current = true;
      setMode('receive');

      // Import encryption key from URL hash
      if (hashKey) {
        importKey(hashKey).then((key) => {
          cryptoKeyRef.current = key;
          setEncKeyString(hashKey);
        }).catch(() => {
          // Invalid key — proceed without encryption
        });
      }

      // Join room using token
      send({ type: 'join', payload: { token: joinToken } });

      // Clean URL without reloading
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [wsState, send]);

  // ── Actions ─────────────────────────────────────────────────────────
  const startSend = async () => {
    try {
      setErrorMsg('');
      // Generate encryption key
      const key = await generateKey();
      cryptoKeyRef.current = key;
      const keyStr = await exportKey(key);
      setEncKeyString(keyStr);
      
      setMode('send');
      send({ type: 'create' });
    } catch (e) {
      console.error(e);
      setErrorMsg('Error: End-to-End Encryption requires a secure connection (localhost or HTTPS). Please access the app via http://localhost:3000 instead of your IP address, or deploy it to Vercel (HTTPS).');
      setStatus('error');
    }
  };

  const startReceive = () => {
    setErrorMsg('');
    setMode('receive');
    setStatus('idle');
  };

  const joinRoom = (code) => {
    setErrorMsg('');
    send({ type: 'join', payload: { code } });
  };

  const handleFileSelect = async (file) => {
    setSelectedFile(file);
    if (status === 'connected') {
      setStatus('transferring');
      await sendFile(file);
      setStatus('done');
    }
  };

  const downloadFile = () => {
    if (!receivedFile) return;
    const url = URL.createObjectURL(receivedFile.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = receivedFile.name;
    a.click();
    URL.revokeObjectURL(url);
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
    setEncKeyString('');
    setProgress(null);
    setSelectedFile(null);
    setReceivedFile(null);
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
    <main className="relative min-h-screen overflow-hidden px-4 py-10 sm:px-6">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-36 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-teal-500/15 blur-3xl" />
      </div>

      <section className="relative mx-auto w-full max-w-2xl rounded-3xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-8">
        <header className="mb-8 text-center" style={{ animation: 'fadeIn 0.5s ease-out' }}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300/90">Secure Peer-to-Peer Transfer</p>
          <h1 className="text-3xl font-semibold text-white sm:text-4xl">P2P FileShare</h1>
          <p className="mx-auto mt-2 max-w-xl text-sm text-slate-300">
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
          <div className="grid gap-4 sm:grid-cols-2" style={{ animation: 'slideUp 0.45s ease-out' }}>
            <button
              onClick={startSend}
              id="btn-send"
              className="rounded-2xl bg-cyan-600 px-6 py-5 text-base font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-cyan-500 hover:shadow-lg hover:shadow-cyan-500/30"
            >
              Send File
            </button>
            <button
              onClick={startReceive}
              id="btn-receive"
              className="rounded-2xl border border-white/15 bg-white/5 px-6 py-5 text-base font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:border-cyan-300/50 hover:bg-white/10"
            >
              Receive File
            </button>
          </div>
        )}

        {mode === 'send' && (
          <div className="space-y-6" style={{ animation: 'slideUp 0.4s ease-out' }}>
            <SessionCode mode="send" code={sessionCode} token={roomToken} encryptionKey={encKeyString} />

            {status === 'connected' && !selectedFile && (
              <div>
                <p className="mb-4 text-center text-sm text-emerald-300">Receiver connected. Select a file to send.</p>
                <FileDropZone onFileSelect={handleFileSelect} disabled={false} />
              </div>
            )}

            {status === 'transferring' && selectedFile && (
              <div>
                <FileDropZone selectedFile={selectedFile} disabled={true} />
                <div className="mt-4">
                  <ProgressBar progress={progress} />
                </div>
              </div>
            )}

            {status === 'done' && (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4 text-center" style={{ animation: 'scaleIn 0.3s ease-out' }}>
                <p className="text-lg font-semibold text-emerald-300">Transfer complete</p>
                {selectedFile && (
                  <p className="mt-1 text-sm text-emerald-100/80">{selectedFile.name} • {formatSize(selectedFile.size)}</p>
                )}
              </div>
            )}
          </div>
        )}

        {mode === 'receive' && (
          <div className="space-y-6" style={{ animation: 'slideUp 0.4s ease-out' }}>
            {status === 'idle' && <SessionCode mode="receive" onJoin={joinRoom} />}

            {status === 'waiting' && (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-7 text-center">
                <p className="text-sm text-slate-300">Waiting for sender...</p>
              </div>
            )}

            {status === 'connected' && (
              <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-5 py-7 text-center" style={{ animation: 'fadeIn 0.3s ease-out' }}>
                <p className="font-medium text-emerald-300">Connected. Waiting for file data.</p>
              </div>
            )}

            {status === 'transferring' && (
              <div>
                <div className="mb-4 text-center">
                  <p className="font-medium text-slate-200">Receiving file</p>
                </div>
                <ProgressBar progress={progress} />
              </div>
            )}

            {status === 'done' && receivedFile && (
              <div className="space-y-5 text-center" style={{ animation: 'scaleIn 0.3s ease-out' }}>
                <div className="inline-block rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
                  <p className="font-medium text-slate-100">{receivedFile.name}</p>
                  <p className="text-sm text-slate-400">{formatSize(receivedFile.size)}</p>
                </div>
                <div>
                  <button
                    onClick={downloadFile}
                    id="btn-download"
                    className="rounded-xl bg-cyan-600 px-8 py-3.5 font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-cyan-500 hover:shadow-lg hover:shadow-cyan-500/30"
                  >
                    Download File
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {errorMsg && (
          <div className="mt-6 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-center" style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <p className="text-sm text-amber-200">{errorMsg}</p>
          </div>
        )}

        {mode && (
          <button
            onClick={reset}
            id="btn-reset"
            className="mt-8 w-full rounded-xl border border-white/15 bg-white/5 py-2.5 text-sm text-slate-300 transition-all duration-300 hover:bg-white/10"
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
