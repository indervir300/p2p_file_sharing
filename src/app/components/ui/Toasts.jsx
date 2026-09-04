'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertTriangle, Info, Download } from 'lucide-react';

const TONES = {
  session: { Icon: CheckCircle2, accent: 'text-brand-success', bar: 'bg-brand-success' },
  warning: { Icon: AlertTriangle, accent: 'text-brand-warning', bar: 'bg-brand-warning' },
  download: { Icon: Download, accent: 'text-brand-primary', bar: 'bg-brand-primary' },
  info: { Icon: Info, accent: 'text-brand-primary', bar: 'bg-brand-primary' },
};

export default function Toasts({ toasts }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-3 sm:inset-x-auto sm:right-5 sm:items-end">
      <AnimatePresence initial={false}>
        {toasts.map((toast) => {
          const tone = TONES[toast.tone] || TONES.info;
          const { Icon } = tone;
          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              className="glass pointer-events-auto relative w-[min(92vw,22rem)] overflow-hidden rounded-2xl border border-[var(--glass-border)] px-3.5 py-3 shadow-lg"
            >
              <div className="flex items-start gap-2.5">
                <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tone.accent}`} strokeWidth={2.2} />
                <p className="text-[13px] font-medium leading-snug text-text-primary">{toast.text}</p>
              </div>
              <motion.span
                initial={{ scaleX: 1 }}
                animate={{ scaleX: 0 }}
                transition={{ duration: 3.2, ease: 'linear' }}
                className={`absolute bottom-0 left-0 h-0.5 w-full origin-left ${tone.bar} opacity-60`}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
