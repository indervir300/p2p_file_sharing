'use client';
import { motion } from 'framer-motion';
import { Lock } from 'lucide-react';
import Avatar from '@/app/components/ui/Avatar';

const STEPS = ['Signalling', 'Negotiating', 'Securing'];

/** Waiting-room screen shown between "invite sent" and "data channel open". */
export default function ConnectingState({ title, subtitle, peerName, step = 0, onCancel }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 text-center">
      <div className="relative mb-8 flex h-32 w-32 items-center justify-center">
        <span className="absolute inset-0 rounded-full bg-brand-primary/15 blur-2xl" />
        <svg viewBox="0 0 128 128" className="absolute inset-0 h-32 w-32 -rotate-90">
          <circle cx="64" cy="64" r="58" fill="none" stroke="var(--border-secondary)" strokeWidth="3" />
          <motion.circle
            cx="64" cy="64" r="58" fill="none"
            stroke="url(#connect-grad)" strokeWidth="3" strokeLinecap="round"
            strokeDasharray="120 244"
            animate={{ rotate: 360 }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' }}
            style={{ transformOrigin: '64px 64px' }}
          />
          <defs>
            <linearGradient id="connect-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--brand-primary)" />
              <stop offset="100%" stopColor="var(--brand-accent-2)" />
            </linearGradient>
          </defs>
        </svg>
        <Avatar name={peerName} size={76} rounded="rounded-[26px]" ring={false} className="shadow-lg" />
      </div>

      <h1 className="text-2xl font-bold tracking-tight text-text-primary">{title}</h1>
      <p className="mt-2 max-w-xs text-sm text-text-secondary">{subtitle}</p>

      {/* Handshake steps */}
      <div className="mt-7 flex items-center gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors
              ${i <= step
                ? 'bg-brand-primary/12 text-brand-primary'
                : 'bg-bg-tertiary text-text-tertiary'}`}>
              {i === step && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-primary" />}
              {label}
            </span>
            {i < STEPS.length - 1 && <span className="h-px w-3 bg-border-primary" />}
          </div>
        ))}
      </div>

      <p className="mt-5 inline-flex items-center gap-1.5 text-[11px] font-medium text-text-tertiary">
        <Lock className="h-3 w-3" strokeWidth={2.4} />
        Keys are derived on-device — the relay never sees your files
      </p>

      <button
        onClick={onCancel}
        className="mt-8 rounded-full border border-border-secondary px-6 py-2.5 text-sm font-semibold text-text-secondary transition-colors hover:border-brand-danger/40 hover:text-brand-danger dark:border-border-primary"
      >
        Cancel
      </button>
    </div>
  );
}
