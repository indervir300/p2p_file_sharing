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
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm overflow-hidden">
          {/* Label strip */}
          <div className="bg-linear-to-r from-blue-600 to-indigo-600 px-5 py-2.5">
            <p className="text-xs font-bold uppercase tracking-widest text-blue-100 text-center">
              Share this code
            </p>
          </div>

          {code ? (
            <>
              {/* Code + inline copy */}
              <div className="flex items-center justify-between gap-3 px-5 py-5 border-b border-slate-100 dark:border-slate-700">
                <p className="font-mono text-5xl font-black tracking-widest text-slate-900 dark:text-slate-100 leading-none">
                  {code}
                </p>
                <CopyCodeButton code={code} />
              </div>

              {/* Action row */}
              <div className="flex gap-2 p-4">
                {joinUrl && <CopyLinkButton url={joinUrl} />}
                {joinUrl && (
                  <button
                    onClick={() => setShowQR(true)}
                    title="Show QR Code"
                    className="flex items-center justify-center gap-1.5 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:border-slate-300 hover:bg-slate-50 dark:hover:border-slate-600 dark:hover:bg-slate-700 transition-all active:scale-[0.97] shrink-0"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                    </svg>
                    QR
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 py-10">
              <div className="h-8 w-8 rounded-full border-4 border-blue-100 border-t-blue-600 animate-spin dark:border-blue-900 dark:border-t-blue-500" />
              <span className="text-sm font-medium text-slate-500">Generating secure room...</span>
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
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm overflow-hidden">
      <div className="bg-linear-to-r from-blue-600 to-indigo-600 px-5 py-2.5">
        <p className="text-xs font-bold uppercase tracking-widest text-blue-100 text-center">
          Enter Room Code
        </p>
      </div>
      <div className="p-5">
        <input
          ref={inputRef}
          type="text"
          value={inputCode}
          onChange={(e) => setInputCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
          placeholder="e.g. AB12"
          maxLength={8}
          className="w-full rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-4 text-center font-mono text-3xl font-black tracking-widest text-slate-900 dark:text-white outline-none focus:border-blue-500 focus:bg-white dark:focus:border-blue-500 transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600 mb-4"
        />
        <button
          onClick={handleJoin}
          disabled={inputCode.trim().length < 4}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-blue-600 to-indigo-600 py-4 text-base font-bold text-white shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl disabled:scale-100 disabled:opacity-50 disabled:shadow-none active:scale-[0.98]"
        >
          <span>Join Session</span>
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function CopyCodeButton({ code }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* silent */ }
  };
  return (
    <button
      onClick={copy}
      title="Copy code"
      className={`flex flex-col items-center justify-center gap-1 rounded-xl border-2 px-4 py-3 text-xs font-bold transition-all active:scale-95 shrink-0 ${
        copied
          ? 'border-emerald-400 bg-emerald-50 text-emerald-600 dark:border-emerald-600 dark:bg-emerald-950 dark:text-emerald-400'
          : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-blue-600 dark:hover:bg-blue-950 dark:hover:text-blue-400'
      }`}
    >
      {copied ? (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      )}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

function CopyLinkButton({ url }) {
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
      className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-all active:scale-[0.97] ${
        copied
          ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/25'
          : 'bg-linear-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 hover:shadow-lg hover:shadow-blue-500/30'
      }`}
    >
      {copied ? (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      )}
      {copied ? 'Copied!' : 'Copy Invite Link'}
    </button>
  );
}
