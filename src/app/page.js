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
        break;
      case 'joined':
        setStatus('waiting');
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
        setStatus('error');
        setErrorMsg('Peer disconnected.');
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
    setMode('receive');
    setStatus('idle');
  };

  const joinRoom = (code) => {
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

  const reset = () => {
    cleanup();
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
    <main className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background gradient orbs */}
      <div className="absolute top-[-50%] left-[-20%] w-[600px] h-[600px] rounded-full opacity-[0.07]"
        style={{ background: 'radial-gradient(circle, #6366f1, transparent 70%)' }} />
      <div className="absolute bottom-[-40%] right-[-15%] w-[500px] h-[500px] rounded-full opacity-[0.05]"
        style={{ background: 'radial-gradient(circle, #8b5cf6, transparent 70%)' }} />

      <div className="w-full max-w-md relative z-10">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-white mb-2"
            style={{ textShadow: '0 0 40px rgba(99, 102, 241, 0.3)' }}>
            ⚡ P2P FileShare
          </h1>
          <p className="text-slate-500 text-sm">Encrypted direct transfer — no cloud, no limits, no tracking</p>
        </div>

        {/* Connection Status */}
        <div className="mb-8">
          <ConnectionStatus
            wsState={wsState}
            encrypted={!!cryptoKeyRef.current}
            connectionType={connectionType}
          />
        </div>

        {/* Mode selection */}
        {!mode && (
          <div className="flex gap-4" style={{ animation: 'fadeIn 0.5s ease-out' }}>
            <button onClick={startSend} id="btn-send"
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-5 rounded-2xl text-lg transition-all duration-300 hover:shadow-lg hover:shadow-indigo-500/25 hover:-translate-y-0.5 active:translate-y-0">
              📤 Send File
            </button>
            <button onClick={startReceive} id="btn-receive"
              className="flex-1 bg-slate-800/80 border border-slate-700/50 hover:bg-slate-700/80 hover:border-slate-600 text-white font-semibold py-5 rounded-2xl text-lg transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0">
              📥 Receive
            </button>
          </div>
        )}

        {/* Send flow */}
        {mode === 'send' && (
          <div className="space-y-6" style={{ animation: 'slideUp 0.4s ease-out' }}>
            <SessionCode mode="send" code={sessionCode} token={roomToken} encryptionKey={encKeyString} />

            {status === 'connected' && !selectedFile && (
              <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
                <p className="text-emerald-400 text-center text-sm mb-4 flex items-center justify-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" /> Friend connected! Select a file to send.
                </p>
                <FileDropZone onFileSelect={handleFileSelect} disabled={false} />
              </div>
            )}

            {status === 'transferring' && selectedFile && (
              <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
                <FileDropZone selectedFile={selectedFile} disabled={true} />
                <div className="mt-4">
                  <ProgressBar progress={progress} />
                </div>
              </div>
            )}

            {status === 'done' && (
              <div className="text-center py-6" style={{ animation: 'scaleIn 0.3s ease-out' }}>
                <div className="text-5xl mb-3">✅</div>
                <p className="text-emerald-400 font-semibold text-lg">File sent successfully!</p>
                {selectedFile && (
                  <p className="text-slate-500 text-sm mt-1">{selectedFile.name} • {formatSize(selectedFile.size)}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Receive flow */}
        {mode === 'receive' && (
          <div className="space-y-6" style={{ animation: 'slideUp 0.4s ease-out' }}>
            {status === 'idle' && <SessionCode mode="receive" onJoin={joinRoom} />}

            {status === 'waiting' && (
              <div className="text-center py-8">
                <div className="text-4xl mb-3 animate-pulse">🔗</div>
                <p className="text-slate-400">Connecting to sender...</p>
              </div>
            )}

            {status === 'connected' && (
              <div className="text-center py-8" style={{ animation: 'fadeIn 0.3s ease-out' }}>
                <div className="text-4xl mb-3">✅</div>
                <p className="text-emerald-400 font-medium">Connected! Waiting for file...</p>
              </div>
            )}

            {status === 'transferring' && (
              <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
                <div className="text-center mb-4">
                  <p className="text-slate-300 font-medium">Receiving file...</p>
                </div>
                <ProgressBar progress={progress} />
              </div>
            )}

            {status === 'done' && receivedFile && (
              <div className="text-center space-y-5" style={{ animation: 'scaleIn 0.3s ease-out' }}>
                <div className="text-5xl mb-2">🎉</div>
                <p className="text-emerald-400 font-semibold text-lg">File received!</p>
                <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-3 inline-block">
                  <p className="text-slate-200 font-medium">{receivedFile.name}</p>
                  <p className="text-slate-500 text-sm">{formatSize(receivedFile.size)}</p>
                </div>
                <div>
                  <button onClick={downloadFile} id="btn-download"
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-10 py-3.5 rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-indigo-500/25 hover:-translate-y-0.5">
                    ⬇️ Download File
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {errorMsg && (
          <div className="mt-6 bg-red-950/30 border border-red-500/20 rounded-xl px-4 py-3 text-center"
            style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <p className="text-red-400 text-sm">{errorMsg}</p>
          </div>
        )}

        {/* Back button */}
        {mode && (
          <button onClick={reset} id="btn-reset"
            className="mt-8 w-full text-slate-600 hover:text-slate-300 text-sm transition-all duration-300 py-2">
            ← Start Over
          </button>
        )}

        {/* Footer */}
        <div className="mt-12 text-center">
          <p className="text-slate-700 text-xs">
            Files transfer directly between devices via WebRTC.
            <br />Nothing is stored on any server. End-to-end encrypted.
          </p>
        </div>
      </div>
    </main>
  );
}
