'use client';
import { useState, useRef } from 'react';
import QRCodeModal from '@/app/components/lobby/QRCodeModal';

export default function SessionCode({ mode, code, token, onJoin }) {
  const [inputCode, setInputCode] = useState('');
  const [showQR, setShowQR]       = useState(false);
  const inputRef                  = useRef(null);

  const joinUrl = code && token
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}?join=${token}&code=${code}`
    : null;

  const handleJoin = () => {
    const trimmed = inputCode.trim().toUpperCase();
    if (trimmed.length < 4) return;
    onJoin?.(trimmed);
  };

  if (mode === 'send') {
    return (
      <>
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-5 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">
            Room Code
          </p>

          {code ? (
            <>
              <p className="font-mono text-4xl font-bold tracking-widest text-slate-900 dark:text-slate-100 mb-4">
                {code}
              </p>

              <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">
                Share this code with your peer so they can join
              </p>

              <div className="flex flex-col gap-2">
                {/* Copy link */}
                {joinUrl && (
                  <CopyButton url={joinUrl} />
                )}

                {/* QR Code */}
                {joinUrl && (
                  <button
                    onClick={() => setShowQR(true)}
                    className="flex items-center justify-center gap-2 w-full rounded-xl border border-slate-300 dark:border-slate-600 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                    </svg>
                    Show QR Code
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center gap-2 py-4">
              <div className="h-4 w-4 rounded-full border-2 border-slate-300 border-t-slate-700 animate-spin" />
              <span className="text-sm text-slate-400">Generating room…</span>
            </div>
          )}
        </div>

        {showQR && joinUrl && (
          <QRCodeModal
            url={joinUrl}
            code={code}
            onClose={() => setShowQR(false)}
          />
        )}
      </>
    );
  }

  // Receive mode
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3 text-center">
        Enter Room Code
      </p>
      <input
        ref={inputRef}
        type="text"
        value={inputCode}
        onChange={(e) => setInputCode(e.target.value.toUpperCase())}
        onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
        placeholder="e.g. AB12"
        maxLength={8}
        className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-3 text-center font-mono text-2xl font-bold tracking-widest text-slate-900 dark:text-slate-100 outline-none focus:border-slate-500 dark:focus:border-slate-400 focus:ring-1 focus:ring-slate-400 transition-colors mb-3"
      />
      <button
        onClick={handleJoin}
        disabled={inputCode.trim().length < 4}
        className="w-full rounded-xl bg-slate-900 dark:bg-slate-100 py-3 text-sm font-semibold text-white dark:text-slate-900 hover:bg-slate-700 dark:hover:bg-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        Join Session
      </button>
    </div>
  );
}

function CopyButton({ url }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* silent */ }
  };

  return (
    <button
      onClick={copy}
      className={`w-full rounded-xl py-2.5 text-sm font-semibold transition-all ${
        copied
          ? 'bg-emerald-500 text-white'
          : 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-700 dark:hover:bg-slate-300'
      }`}
    >
      {copied ? '✓ Link Copied!' : 'Copy Invite Link'}
    </button>
  );
}
