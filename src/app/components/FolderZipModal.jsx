'use client';
import { motion } from 'framer-motion';
import { FolderArchive, Check, X } from 'lucide-react';
import { formatSize } from '@/utils/format';

/**
 * Appears when a folder is dropped: shows compression progress, then lets the user send.
 */
export default function FolderZipModal({ items, onSend, onCancel }) {
  if (!items || items.length === 0) return null;

  const allDone = items.every((i) => i.state === 'ready' || i.state === 'error');
  const hasReady = items.some((i) => i.state === 'ready');
  const readyBytes = items.reduce((sum, i) => sum + (i.zipFile?.size || 0), 0);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/55 p-4 backdrop-blur-md"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      role="dialog"
      aria-modal="true"
    >
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 340, damping: 28 }}
        className="glass w-full max-w-sm overflow-hidden rounded-3xl border border-[var(--glass-border)] shadow-premium"
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border-secondary px-5 py-4 dark:border-border-primary">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-primary/12 text-brand-primary">
            <FolderArchive className="h-5 w-5" strokeWidth={1.9} />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-text-primary">
              {allDone ? 'Ready to send' : 'Packing folder…'}
            </h3>
            <p className="mt-0.5 text-[11px] text-text-tertiary">
              {allDone
                ? `${items.length} archive${items.length === 1 ? '' : 's'} · ${formatSize(readyBytes)}`
                : 'Folders are zipped before transfer'}
            </p>
          </div>
        </div>

        {/* Items */}
        <div className="custom-scrollbar max-h-64 space-y-2 overflow-y-auto px-5 py-4">
          {items.map((item, idx) => (
            <div
              key={idx}
              className="flex items-center gap-3 rounded-2xl border border-border-secondary bg-bg-primary/50 px-3.5 py-2.5 dark:border-border-primary dark:bg-bg-secondary/50"
            >
              <span className="shrink-0">
                {item.state === 'zipping' && (
                  <span className="block h-5 w-5 animate-spin rounded-full border-2 border-brand-primary border-t-transparent" />
                )}
                {item.state === 'ready' && <Check className="h-5 w-5 text-brand-success" strokeWidth={2.6} />}
                {item.state === 'error' && <X className="h-5 w-5 text-brand-danger" strokeWidth={2.6} />}
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-text-primary">
                  {item.state === 'ready' ? `${item.name}.zip` : item.name}
                </p>
                <p className="mt-0.5 text-[11px] text-text-tertiary">
                  {item.state === 'zipping' && 'Compressing…'}
                  {item.state === 'ready' && item.zipFile && formatSize(item.zipFile.size)}
                  {item.state === 'error' && (item.error || 'Failed to compress')}
                </p>
              </div>

              {items.length > 1 && item.state === 'ready' && item.zipFile && (
                <button
                  onClick={() => onSend(item.zipFile)}
                  className="shrink-0 rounded-full bg-brand-primary/10 px-3 py-1 text-[11px] font-bold text-brand-primary transition-colors hover:bg-brand-primary/20"
                >
                  Send
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 pb-5">
          <button
            onClick={onCancel}
            className="flex-1 rounded-full border border-border-secondary py-2.5 text-sm font-semibold text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-text-primary dark:border-border-primary"
          >
            Cancel
          </button>

          {hasReady && (
            <button
              disabled={!allDone}
              onClick={() => {
                items.forEach((item) => {
                  if (item.state === 'ready' && item.zipFile) onSend(item.zipFile);
                });
              }}
              className={`flex-1 rounded-full py-2.5 text-sm font-semibold text-white shadow-md transition-transform
                ${allDone
                  ? 'bg-gradient-brand shadow-brand-primary/25 hover:scale-[1.02] active:scale-95'
                  : 'cursor-not-allowed bg-brand-primary/50'}`}
            >
              {allDone ? 'Send all' : 'Preparing…'}
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
