'use client';
import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';

export default function QRCodeModal({ url, code, onClose }) {
  const canvasRef = useRef(null);
  const [copied, setCopied]   = useState(false);
  const [error, setError]     = useState(false);

  useEffect(() => {
    if (!canvasRef.current || !url) return;
    QRCode.toCanvas(canvasRef.current, url, {
      width:            240,
      margin:           2,
      color: {
        dark:  '#0f172a',
        light: '#ffffff',
      },
    }).catch(() => setError(true));
  }, [url]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* silent */ }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xs rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-700"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute right-3 top-3 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">
          Scan to Join
        </h2>
        <p className="text-xs text-slate-400 dark:text-slate-500 mb-5">
          Point your phone camera at this QR code
        </p>

        {/* QR canvas */}
        <div className="flex justify-center mb-4">
          <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 p-2 bg-white">
            {error
              ? <p className="text-xs text-red-500 p-4">Could not generate QR code.</p>
              : <canvas ref={canvasRef} />
            }
          </div>
        </div>

        {/* Room code badge */}
        <div className="flex items-center justify-center gap-2 rounded-xl bg-slate-50 dark:bg-slate-800 px-4 py-3 mb-4">
          <span className="text-xs text-slate-400">Room code</span>
          <span className="font-mono text-lg font-bold tracking-widest text-slate-900 dark:text-slate-100">
            {code}
          </span>
        </div>

        {/* Copy link */}
        <button
          onClick={copyLink}
          className={`w-full rounded-xl py-2.5 text-sm font-semibold transition-all ${
            copied
              ? 'bg-emerald-500 text-white'
              : 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-700 dark:hover:bg-slate-300'
          }`}
        >
          {copied ? '✓ Copied!' : 'Copy invite link'}
        </button>
      </div>
    </div>
  );
}
