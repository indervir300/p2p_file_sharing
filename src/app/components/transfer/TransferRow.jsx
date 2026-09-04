'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Download, Check, ArrowUpRight, ArrowDownLeft, Ban, AlertCircle, Eye, EyeOff } from 'lucide-react';
import FileGlyph from '@/app/components/ui/FileGlyph';
import MediaPreview from './MediaPreview';
import { formatSize, formatTime, fileKind } from '@/utils/format';

const STATUS_META = {
  sent: { label: 'Sent', Icon: ArrowUpRight, cls: 'text-brand-primary bg-brand-primary/10' },
  received: { label: 'Received', Icon: ArrowDownLeft, cls: 'text-brand-success bg-brand-success/10' },
  canceled: { label: 'Canceled', Icon: Ban, cls: 'text-text-tertiary bg-bg-tertiary' },
  error: { label: 'Failed', Icon: AlertCircle, cls: 'text-brand-danger bg-brand-danger/10' },
};

/** One finished transfer, as shown in the side panel. */
export default function TransferRow({ item, onDownload, onDragOut }) {
  const [showPreview, setShowPreview] = useState(false);

  const meta = STATUS_META[item.status] || STATUS_META.sent;
  const { Icon } = meta;
  const isFailed = item.status === 'error' || item.status === 'canceled';
  const canDownload = item.status === 'received' && !!item.blob;
  const previewable = canDownload && ['image', 'video', 'audio'].includes(fileKind(item.name, item.mimeType));
  const isNew = item.status === 'received' && !item.downloaded;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 20, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
      className={`group relative overflow-hidden rounded-2xl border p-3 transition-colors
        ${isFailed
          ? 'border-brand-danger/20 bg-brand-danger/[0.04]'
          : 'surface hover:border-brand-primary/30'}`}
    >
      {isNew && (
        <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-brand-success shadow-[0_0_0_3px_rgba(var(--brand-success-rgb),0.18)]" />
      )}

      <div className="flex items-start gap-3">
        <FileGlyph name={item.name} mimeType={item.mimeType} size="sm" />

        <div className="min-w-0 flex-1">
          <p className="truncate pr-4 text-sm font-semibold text-text-primary" title={item.name}>
            {item.name}
          </p>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${meta.cls}`}>
              <Icon className="h-3 w-3" strokeWidth={2.5} />
              {meta.label}
            </span>
            <span className="text-[11px] tabular-nums text-text-tertiary">{formatSize(item.size)}</span>
            <span className="text-[11px] text-text-tertiary">·</span>
            <span className="text-[11px] tabular-nums text-text-tertiary">{formatTime(item.timestamp)}</span>
          </div>
        </div>
      </div>

      {(canDownload || previewable) && (
        <div className="mt-3 flex items-center gap-2 pl-12">
          {canDownload && (
            <button
              draggable
              onDragStart={(e) => onDragOut?.(e, item)}
              onClick={() => onDownload(item)}
              title="Click to download — or drag straight to your desktop"
              className={`inline-flex cursor-grab items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold shadow-sm transition-all active:cursor-grabbing active:scale-95
                ${item.downloaded
                  ? 'bg-bg-tertiary text-text-secondary hover:text-text-primary'
                  : 'bg-gradient-brand text-white shadow-brand-primary/25 hover:shadow-md'}`}
            >
              {item.downloaded
                ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                : <Download className="h-3.5 w-3.5" strokeWidth={2.5} />}
              {item.downloaded ? 'Saved' : 'Download'}
            </button>
          )}

          {previewable && (
            <button
              onClick={() => setShowPreview((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-text-primary"
            >
              {showPreview
                ? <EyeOff className="h-3.5 w-3.5" strokeWidth={2} />
                : <Eye className="h-3.5 w-3.5" strokeWidth={2} />}
              {showPreview ? 'Hide' : 'Preview'}
            </button>
          )}
        </div>
      )}

      {showPreview && previewable && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-3 pl-12"
        >
          <MediaPreview blob={item.blob} mimeType={item.mimeType} name={item.name} />
        </motion.div>
      )}
    </motion.div>
  );
}
