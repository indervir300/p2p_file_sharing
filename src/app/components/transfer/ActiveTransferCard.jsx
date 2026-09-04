'use client';
import { motion } from 'framer-motion';
import { X, Pause, ArrowUp, ArrowDown } from 'lucide-react';
import FileGlyph from '@/app/components/ui/FileGlyph';
import { formatSize, formatSpeed, formatEta } from '@/utils/format';

/** Live send/receive card with progress, throughput and ETA. */
export default function ActiveTransferCard({ item, onCancel }) {
  const isMine = item.sender === 'me';
  const paused = item.status === 'paused';
  const percent = Math.min(100, Math.max(0, item.progress || 0));
  const transferred = item.transferred ?? Math.round((item.size || 0) * (percent / 100));
  const eta = item.speed > 0 ? formatEta(((item.size || 0) - transferred) / item.speed) : '';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 400, damping: 32 }}
      className={`relative overflow-hidden rounded-2xl border p-4 shadow-sm
        ${paused
          ? 'border-brand-warning/30 bg-brand-warning/[0.06]'
          : 'border-brand-primary/25 bg-bg-primary dark:bg-bg-secondary'}`}
    >
      {/* ambient glow follows progress */}
      {!paused && (
        <div
          className="pointer-events-none absolute inset-y-0 left-0 -z-0 transition-all duration-500"
          style={{
            width: `${percent}%`,
            background: 'linear-gradient(90deg, rgba(var(--brand-primary-rgb),0.10), transparent)',
          }}
        />
      )}

      <div className="relative flex items-center gap-3">
        <div className="relative">
          <FileGlyph name={item.name} mimeType={item.mimeType} size="md" />
          <span className={`absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full text-white shadow-sm ring-2 ring-bg-primary dark:ring-bg-secondary
            ${paused ? 'bg-brand-warning' : isMine ? 'bg-brand-primary' : 'bg-brand-success'}`}>
            {paused
              ? <Pause className="h-2.5 w-2.5" strokeWidth={3} fill="currentColor" />
              : isMine
                ? <ArrowUp className="h-3 w-3" strokeWidth={3} />
                : <ArrowDown className="h-3 w-3" strokeWidth={3} />}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <p className="truncate text-sm font-semibold text-text-primary" title={item.name}>
              {item.name}
            </p>
            <span className={`shrink-0 text-sm font-bold tabular-nums ${paused ? 'text-brand-warning' : 'text-brand-primary'}`}>
              {paused ? 'Paused' : `${percent}%`}
            </span>
          </div>

          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-text-tertiary">
            <span className="tabular-nums">{formatSize(transferred)} / {formatSize(item.size)}</span>
            {item.speed > 0 && !paused && (
              <>
                <span>·</span>
                <span className="font-medium tabular-nums text-text-secondary">{formatSpeed(item.speed)}</span>
              </>
            )}
            {eta && !paused && (
              <>
                <span>·</span>
                <span className="tabular-nums">{eta} left</span>
              </>
            )}
          </div>
        </div>

        <button
          onClick={() => onCancel(item.id)}
          title="Cancel transfer"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-text-tertiary transition-colors hover:bg-brand-danger/10 hover:text-brand-danger"
        >
          <X className="h-4 w-4" strokeWidth={2.2} />
        </button>
      </div>

      {/* Progress track */}
      <div className={`relative mt-3 h-1.5 overflow-hidden rounded-full ${paused ? 'bg-brand-warning/20' : 'bg-bg-tertiary'}`}>
        <motion.div
          className={`relative h-full rounded-full ${paused ? 'bg-brand-warning' : 'bg-gradient-brand progress-stripes'}`}
          animate={{ width: `${percent}%` }}
          transition={{ ease: 'easeOut', duration: 0.35 }}
        />
      </div>
    </motion.div>
  );
}
