'use client';
import { motion } from 'framer-motion';
import { ShieldCheck, X, Check } from 'lucide-react';
import Avatar from '@/app/components/ui/Avatar';

/** Full-screen prompt when another device wants to open a session with you. */
export default function IncomingInviteModal({ invite, onAccept, onDecline }) {
  if (!invite) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
        className="glass w-full max-w-sm overflow-hidden rounded-[28px] border border-[var(--glass-border)] shadow-premium"
      >
        <div className="relative flex flex-col items-center px-8 pt-9 pb-6">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-36"
            style={{ background: 'radial-gradient(60% 100% at 50% 0%, rgba(var(--brand-primary-rgb),0.28), transparent 70%)' }}
          />

          <div className="relative mb-4">
            <span className="absolute -inset-3 animate-ping rounded-full bg-brand-primary/20" />
            <Avatar name={invite.fromNick} size={80} rounded="rounded-[28px]" ring={false} className="shadow-lg" />
          </div>

          <h3 className="text-lg font-bold tracking-tight text-text-primary">Incoming transfer request</h3>
          <p className="mt-1.5 text-center text-sm text-text-secondary">
            <span className="font-semibold text-text-primary">{invite.fromNick}</span> wants to open a
            secure channel and share files with you.
          </p>

          <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-brand-success/10 px-2.5 py-1 text-[11px] font-semibold text-brand-success">
            <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2.2} />
            Peer-to-peer · end-to-end encrypted
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 px-6 pb-6">
          <button
            onClick={onDecline}
            className="inline-flex items-center justify-center gap-1.5 rounded-full border border-border-secondary bg-bg-primary/50 py-2.5 text-sm font-semibold text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-text-primary dark:border-border-primary"
          >
            <X className="h-4 w-4" strokeWidth={2.2} />
            Decline
          </button>
          <button
            onClick={onAccept}
            autoFocus
            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-gradient-brand py-2.5 text-sm font-semibold text-white shadow-md shadow-brand-primary/30 transition-transform hover:scale-[1.02] active:scale-95"
          >
            <Check className="h-4 w-4" strokeWidth={2.6} />
            Accept
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
