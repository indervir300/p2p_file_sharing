'use client';
import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Inbox } from 'lucide-react';
import { formatSize } from '@/utils/format';

/**
 * Receipt-style confirmation shown once the whole send queue drains.
 * `summary` = { count, bytes, peer, elapsedMs }
 */
export default function SendSuccessOverlay({ summary, onClose, onViewSent, autoCloseMs = 4200 }) {
  useEffect(() => {
    if (!summary || !autoCloseMs) return;
    const t = setTimeout(onClose, autoCloseMs);
    return () => clearTimeout(t);
  }, [summary, autoCloseMs, onClose]);

  useEffect(() => {
    if (!summary) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [summary, onClose]);

  if (!summary) return null;

  const { count = 0, bytes = 0, peer, elapsedMs = 0 } = summary;
  const seconds = elapsedMs / 1000;
  const avg = seconds > 0.05 ? bytes / seconds : 0;
  const avgLabel = avg >= 1024 ** 2
    ? `${(avg / 1024 ** 2).toFixed(1)} MB/s`
    : avg > 0
      ? `${(avg / 1024).toFixed(0)} KB/s`
      : '—';

  return (
    <motion.div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 p-4 backdrop-blur-md"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Transfer complete"
    >
      <motion.div
        initial={{ opacity: 0, y: 28, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
        className="glass w-full max-w-sm overflow-hidden rounded-[28px] border border-[var(--glass-border)] shadow-premium"
      >
        {/* Tick hero */}
        <div className="relative flex flex-col items-center px-8 pt-10 pb-7">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-40 opacity-70"
            style={{ background: 'radial-gradient(60% 100% at 50% 0%, rgba(var(--brand-success-rgb), 0.28), transparent 70%)' }}
          />

          <div className="relative mb-5 flex h-24 w-24 items-center justify-center">
            {/* burst rings */}
            <span
              className="absolute h-24 w-24 rounded-full border-2 border-brand-success/50"
              style={{ animation: 'ringBurst 1.1s cubic-bezier(0.16, 1, 0.3, 1) 0.15s both' }}
            />
            <span
              className="absolute h-24 w-24 rounded-full border-2 border-brand-success/30"
              style={{ animation: 'ringBurst 1.1s cubic-bezier(0.16, 1, 0.3, 1) 0.35s both' }}
            />

            <svg viewBox="0 0 104 104" className="relative h-24 w-24 -rotate-90">
              <circle cx="52" cy="52" r="48" fill="none" stroke="var(--brand-success)" strokeOpacity="0.14" strokeWidth="6" />
              <circle
                cx="52" cy="52" r="48" fill="none"
                stroke="var(--brand-success)" strokeWidth="6" strokeLinecap="round"
                strokeDasharray="302"
                style={{ animation: 'drawCircle 0.55s cubic-bezier(0.65, 0, 0.35, 1) both' }}
              />
            </svg>

            <svg viewBox="0 0 52 52" className="absolute h-12 w-12">
              <path
                d="M14 27.5 L22.5 36 L38.5 18"
                fill="none"
                stroke="var(--brand-success)"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="48"
                style={{ animation: 'drawCheck 0.3s cubic-bezier(0.65, 0, 0.35, 1) 0.34s both' }}
              />
            </svg>
          </div>

          <motion.h3
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.26 }}
            className="text-xl font-bold tracking-tight text-text-primary"
          >
            All files sent
          </motion.h3>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.32 }}
            className="mt-1 text-center text-sm text-text-secondary"
          >
            {count} {count === 1 ? 'file' : 'files'} delivered{peer ? ' to ' : ''}
            {peer && <span className="font-semibold text-text-primary">{peer}</span>}
          </motion.p>
        </div>

        {/* Receipt rows */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="border-t border-dashed border-border-secondary px-8 py-5 dark:border-border-primary"
        >
          <dl className="grid grid-cols-3 gap-3 text-center">
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">Files</dt>
              <dd className="mt-1 text-sm font-bold text-text-primary tabular-nums">{count}</dd>
            </div>
            <div className="border-x border-border-secondary dark:border-border-primary">
              <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">Volume</dt>
              <dd className="mt-1 text-sm font-bold text-text-primary tabular-nums">{formatSize(bytes)}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">Avg speed</dt>
              <dd className="mt-1 text-sm font-bold text-text-primary tabular-nums">{avgLabel}</dd>
            </div>
          </dl>

          <p className="mt-4 flex items-center justify-center gap-1.5 whitespace-nowrap text-[11px] font-medium text-brand-success">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
            Peer-to-peer · end-to-end encrypted
          </p>
        </motion.div>

        {/* Actions */}
        <div className="flex gap-3 px-6 pb-6">
          <button
            onClick={onViewSent}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full border border-border-secondary bg-bg-primary/60 py-2.5 text-sm font-semibold text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-text-primary dark:border-border-primary"
          >
            <Inbox className="h-4 w-4" strokeWidth={2} />
            View sent
          </button>
          <button
            onClick={onClose}
            className="flex-1 rounded-full bg-gradient-brand py-2.5 text-sm font-semibold text-white shadow-md shadow-brand-primary/25 transition-transform hover:scale-[1.02] active:scale-95"
          >
            Done
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
