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
        <div className="overflow-hidden rounded-3xl bg-bg-primary/95 p-5 shadow-xl shadow-bg-tertiary/10 dark:bg-bg-secondary/90 sm:p-6">
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-primary">
              Share this code
            </p>
            <h2 className="mt-1 text-2xl font-semibold text-text-primary dark:text-text-primary">
              Your session is ready
            </h2>
            <p className="mt-1 text-sm text-text-secondary dark:text-text-secondary">
              Send this code or link to anyone you want to invite.
            </p>
          </div>

          {code ? (
            <>
              <div className="rounded-2xl bg-bg-secondary/80 p-4 dark:bg-bg-tertiary/80">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-secondary dark:text-text-secondary">
                  Session code
                </p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className="font-mono text-4xl font-bold leading-none tracking-[0.2em] text-text-primary dark:text-text-primary sm:text-5xl">
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
            <div className="flex min-h-41 flex-col items-center justify-center gap-3 rounded-2xl bg-bg-secondary/80 p-6 dark:bg-bg-tertiary/80">
              <div className="h-8 w-8 rounded-full border-4 border-brand-primary/10 border-t-brand-primary animate-spin" />
              <span className="text-sm font-medium text-text-secondary dark:text-text-secondary">Creating your session code...</span>
            </div>
          )}
        </div>

      </>
    );
  }

  // Receive mode
  return (
    <div className="rounded-2xl bg-bg-primary dark:bg-bg-secondary shadow-sm overflow-hidden">
      <div className="bg-brand-primary px-5 py-2.5">
        <p className="text-xs font-bold uppercase tracking-widest text-white/80 text-center">
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
          className="w-full rounded-xl border-2 border-border-secondary dark:border-border-primary bg-bg-secondary dark:bg-bg-tertiary px-4 py-4 text-center font-mono text-3xl font-black tracking-widest text-text-primary dark:text-text-primary outline-none focus:border-brand-primary focus:bg-bg-primary dark:focus:border-brand-primary transition-all placeholder:text-text-secondary/30 dark:placeholder:text-text-secondary/30 mb-4"
        />
        <button
          onClick={handleJoin}
          disabled={inputCode.trim().length < 4}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-primary py-4 text-base font-bold text-white shadow-lg transition-all hover:scale-[1.02] hover:bg-brand-primary-hover disabled:scale-100 disabled:opacity-50 disabled:shadow-none active:scale-[0.98]"
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
          ? 'bg-brand-success text-white shadow-md shadow-brand-success/30'
          : 'bg-brand-primary text-white shadow-md shadow-brand-primary/30 hover:bg-brand-primary-hover'
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
          ? 'bg-brand-success text-white shadow-md shadow-brand-success/25'
          : 'bg-brand-primary text-white shadow-md shadow-brand-primary/25 hover:shadow-lg hover:bg-brand-primary-hover'
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
