'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock } from 'lucide-react';
import FileGlyph from '@/app/components/ui/FileGlyph';
import { formatSize } from '@/utils/format';

/** Files waiting their turn in the send queue. */
export default function QueueList({ items, onCancel, onClearAll }) {
  if (!items.length) return null;

  const totalBytes = items.reduce((sum, t) => sum + (t.size || 0), 0);

  return (
    <motion.section
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="overflow-hidden rounded-2xl border border-border-secondary bg-bg-primary/70 dark:border-border-primary dark:bg-bg-secondary/50"
    >
      <div className="flex items-center justify-between gap-3 border-b border-border-secondary px-4 py-2.5 dark:border-border-primary">
        <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-text-secondary">
          <Clock className="h-3.5 w-3.5 text-brand-warning" strokeWidth={2.4} />
          Queued
          <span className="rounded-full bg-brand-warning/12 px-1.5 py-px text-[10px] tabular-nums text-brand-warning">
            {items.length}
          </span>
        </p>
        <div className="flex items-center gap-3">
          <span className="text-[11px] tabular-nums text-text-tertiary">{formatSize(totalBytes)}</span>
          <button
            onClick={onClearAll}
            className="text-[11px] font-semibold text-text-tertiary transition-colors hover:text-brand-danger"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="custom-scrollbar max-h-64 space-y-1 overflow-y-auto p-2">
        <AnimatePresence initial={false} mode="popLayout">
          {items.map((item, idx) => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12, transition: { duration: 0.15 } }}
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-bg-tertiary/60"
            >
              <span className="w-4 shrink-0 text-center text-[11px] font-bold tabular-nums text-text-tertiary">
                {idx + 1}
              </span>
              <FileGlyph name={item.name} mimeType={item.mimeType} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-text-primary" title={item.name}>{item.name}</p>
                <p className="text-[11px] tabular-nums text-text-tertiary">{formatSize(item.size)}</p>
              </div>
              <button
                onClick={() => onCancel(item.id)}
                title="Remove from queue"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-text-tertiary opacity-0 transition-all hover:bg-brand-danger/10 hover:text-brand-danger focus-visible:opacity-100 group-hover:opacity-100 sm:opacity-100"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2.4} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.section>
  );
}
