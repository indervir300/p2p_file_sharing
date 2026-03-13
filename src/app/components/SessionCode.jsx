'use client';
import { useState } from 'react';

export default function SessionCode({ mode, code, token, encryptionKey, onJoin }) {
  const [input, setInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

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

  if (mode === 'send') {
    return (
      <div className="text-center space-y-5">
        <p className="text-sm text-slate-400">Share this code or link with your friend</p>

        {/* Room Code */}
        <div className="relative inline-block">
          <div
            onClick={copyCode}
            className="text-4xl font-mono font-bold tracking-widest text-indigo-400 bg-slate-800/80 border border-slate-700/50 px-8 py-4 rounded-2xl cursor-pointer hover:border-indigo-500/50 transition-all duration-300"
            style={{ textShadow: '0 0 20px rgba(99, 102, 241, 0.5)' }}
          >
            {code || (
              <span className="inline-flex gap-1">
                {[...Array(6)].map((_, i) => (
                  <span key={i} className="w-3 h-5 bg-slate-700 rounded animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />
                ))}
              </span>
            )}
          </div>
          {copiedCode && (
            <span className="absolute -top-8 left-1/2 -translate-x-1/2 text-xs text-emerald-400 bg-slate-800 px-2 py-1 rounded-lg">
              Code copied!
            </span>
          )}
        </div>

        {/* Shareable Link */}
        {shareableLink && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 max-w-full">
              <div className="flex-1 bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-2.5 text-xs text-slate-500 truncate font-mono">
                {shareableLink}
              </div>
              <button
                onClick={copyLink}
                className={`shrink-0 font-semibold px-5 py-2.5 rounded-xl text-sm transition-all duration-300 ${
                  copied
                    ? 'bg-emerald-600 text-white'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white hover:shadow-lg hover:shadow-indigo-500/25'
                }`}
              >
                {copied ? '✓ Copied!' : '🔗 Copy Link'}
              </button>
            </div>
            <p className="text-xs text-slate-600 flex items-center justify-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/>
              </svg>
              Link contains encrypted room code &amp; encryption key
            </p>
          </div>
        )}

        <p className="text-xs text-slate-500 animate-pulse">Waiting for friend to join...</p>
      </div>
    );
  }

  // Receive mode
  return (
    <div className="text-center space-y-4">
      <p className="text-sm text-slate-400">Enter the code from your friend</p>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value.toUpperCase())}
        maxLength={6}
        placeholder="ABC123"
        className="text-center text-2xl font-mono tracking-widest bg-slate-800/80 border border-slate-700/50 rounded-xl px-5 py-3.5 w-52 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:shadow-lg focus:shadow-indigo-500/10 transition-all duration-300"
      />
      <br />
      <button
        onClick={() => onJoin(input)}
        disabled={input.length < 6}
        className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-semibold px-10 py-3 rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-indigo-500/25"
      >
        Connect
      </button>
      <p className="text-xs text-slate-600">Or ask your friend to send you a link</p>
    </div>
  );
}
