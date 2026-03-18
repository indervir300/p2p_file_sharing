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
        className="relative w-full max-w-xs rounded-2xl bg-bg-primary p-6 shadow-2xl border border-border-secondary dark:border-border-primary"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute right-3 top-3 rounded-full p-1.5 text-text-secondary hover:bg-bg-secondary dark:hover:bg-bg-tertiary transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h2 className="text-base font-semibold text-text-primary dark:text-text-primary mb-1">
          Scan to Join
        </h2>
        <p className="text-xs text-text-secondary dark:text-text-secondary mb-5">
          Point your phone camera at this QR code
        </p>

        {/* QR canvas */}
        <div className="flex justify-center mb-4">
          <div className="rounded-2xl overflow-hidden border border-border-secondary dark:border-border-primary p-2 bg-white">
            {error
              ? <p className="text-xs text-brand-danger p-4">Could not generate QR code.</p>
              : <canvas ref={canvasRef} />
            }
          </div>
        </div>

        {/* Room code badge */}
        <div className="flex items-center justify-center gap-2 rounded-xl bg-bg-secondary dark:bg-bg-tertiary px-4 py-3 mb-4">
          <span className="text-xs text-text-secondary">Room code</span>
          <span className="font-mono text-lg font-bold tracking-widest text-text-primary dark:text-text-primary">
            {code}
          </span>
        </div>

        {/* Copy link */}
        <button
          onClick={copyLink}
          className={`w-full rounded-xl py-2.5 text-sm font-semibold transition-all ${
            copied
              ? 'bg-brand-success text-white'
              : 'bg-brand-primary text-white hover:bg-brand-primary-hover'
          }`}
        >
          {copied ? '✓ Copied!' : 'Copy invite link'}
        </button>
      </div>
    </div>
  );
}
