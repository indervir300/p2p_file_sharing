'use client';
import { useState, useRef } from 'react';

export default function SessionCode({ mode, code, token, onJoin }) {
  const [inputCode, setInputCode] = useState('');
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
        <div className="overflow-hidden rounded-3xl bg-white/95 p-5 shadow-xl shadow-slate-900/10 dark:bg-slate-900/90 sm:p-6">
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600 dark:text-blue-400">
              Share this code
            </p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">
              Your meeting is ready
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Send this code or link to anyone you want to invite.
            </p>
          </div>

          {code ? (
            <>
              <div className="rounded-2xl bg-slate-100/80 p-4 dark:bg-slate-800/80">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                  Meeting code
                </p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className="font-mono text-4xl font-bold leading-none tracking-[0.2em] text-slate-900 dark:text-slate-100 sm:text-5xl">
                    {code}
                  </p>
                  <CopyCodeButton code={code} />
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                {joinUrl && <CopyLinkButton url={joinUrl} />}
              </div>
            </>
          ) : (
            <div className="flex min-h-41 flex-col items-center justify-center gap-3 rounded-2xl bg-slate-100/80 p-6 dark:bg-slate-800/80">
              <div className="h-8 w-8 rounded-full border-4 border-blue-100 border-t-blue-600 animate-spin dark:border-blue-900 dark:border-t-blue-500" />
              <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Creating your meeting code...</span>
            </div>
          )}
        </div>

      </>
    );
  }

  // Receive mode
  return (
    <div className="rounded-2xl bg-white dark:bg-slate-800 shadow-sm overflow-hidden">
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
      className={`shrink-0 rounded-xl px-4 py-2 text-xs font-semibold transition-all active:scale-95 ${
        copied
          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
          : 'bg-blue-600 text-white shadow-md shadow-blue-600/30 hover:bg-blue-700'
      }`}
    >
      {copied ? 'Copied' : 'Copy code'}
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
      className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all active:scale-[0.97] ${
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
