'use client';
import { useState } from 'react';

export default function SessionCode({ mode, code, token, encryptionKey, onJoin }) {
  const [input, setInput] = useState('');
  const [manualKey, setManualKey] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const shareableLink = token && encryptionKey
    ? `${appUrl}/?join=${token}#${encryptionKey}`
    : '';

  const copyLink = async () => {
    if (!shareableLink) return;
    try {
      await navigator.clipboard.writeText(shareableLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard not available */ }
  };

  const copyCode = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch { /* clipboard not available */ }
  };

  const copyKey = async () => {
    if (!encryptionKey) return;
    try {
      await navigator.clipboard.writeText(encryptionKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } catch { /* clipboard not available */ }
  };

  if (mode === 'send') {
    return (
      <div className="space-y-5">
        <p className="text-sm text-slate-600 text-center">Share the room code and encryption key, or send the private link.</p>

        {/* Room Code */}
        <div className="relative">
          <div
            onClick={copyCode}
            className="w-full rounded-xl border border-slate-300 bg-white px-6 py-4 text-center font-mono text-3xl font-semibold tracking-[0.3em] text-slate-900 cursor-pointer hover:border-slate-400 transition-colors"
          >
            {code || (
              <span className="inline-flex gap-1">
                {[...Array(6)].map((_, i) => (
                  <span key={i} className="h-5 w-3 rounded bg-slate-300 animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />
                ))}
              </span>
            )}
          </div>
          {copiedCode && (
            <span className="absolute -top-8 left-1/2 -translate-x-1/2 rounded bg-emerald-100 px-2 py-1 text-xs text-emerald-700">
              Code copied!
            </span>
          )}
        </div>

        {!!encryptionKey && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex-1 truncate rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700">
                {encryptionKey}
              </div>
              <button
                onClick={copyKey}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100"
              >
                {copiedKey ? 'Copied' : 'Copy Key'}
              </button>
            </div>
            <p className="text-xs text-slate-500">Receiver needs this key when joining by code.</p>
          </div>
        )}

        {/* Shareable Link */}
        {shareableLink && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 max-w-full">
              <div className="flex-1 truncate rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 font-mono text-xs text-slate-700">
                {shareableLink}
              </div>
              <button
                onClick={copyLink}
                className={`shrink-0 font-semibold px-5 py-2.5 rounded-xl text-sm transition-all duration-300 ${
                  copied
                    ? 'bg-emerald-600 text-white'
                    : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                }`}
              >
                {copied ? 'Copied' : 'Copy Link'}
              </button>
            </div>
            <p className="text-xs text-slate-500">Private link includes room token and key.</p>
          </div>
        )}

        <p className="text-center text-xs text-slate-500 animate-pulse">Waiting for receiver to connect...</p>
      </div>
    );
  }

  // Receive mode
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600 text-center">Enter sender room code and encryption key</p>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value.toUpperCase())}
        maxLength={6}
        placeholder="ABC123"
        className="mx-auto block w-56 rounded-xl border border-slate-300 bg-white px-5 py-3.5 text-center font-mono text-2xl tracking-widest text-slate-900 placeholder-slate-400 focus:border-slate-500 focus:outline-none"
      />
      <textarea
        value={manualKey}
        onChange={(e) => setManualKey(e.target.value.trim())}
        placeholder="Paste encryption key"
        rows={3}
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-mono text-xs text-slate-800 placeholder-slate-400 focus:border-slate-500 focus:outline-none"
      />
      <button
        onClick={() => onJoin({ code: input, keyString: manualKey })}
        disabled={input.length < 6 || !manualKey}
        className="w-full rounded-xl bg-slate-900 px-10 py-3 font-semibold text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        Connect
      </button>
      <p className="text-center text-xs text-slate-500">Tip: private link auto-fills everything.</p>
    </div>
  );
}
