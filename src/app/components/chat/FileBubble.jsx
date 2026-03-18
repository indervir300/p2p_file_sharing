'use client';
import { useState } from 'react';
import FilePreviewModal, { canPreview } from './FilePreviewModal';
import AudioVisualizer from './AudioVisualizer';

function formatSize(bytes) {
  if (bytes < 1024)       return `${bytes} B`;
  if (bytes < 1024 ** 2)  return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3)  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

export default function FileBubble({ msg, isMine, onDownload, onPreview, onCancel, onDelete }) {
  const [showPreview, setShowPreview] = useState(false);
  const { mimeType = '', previewUrl, name, size, status = 'queued', progress = 0 } = msg;

  const isImg  = mimeType.startsWith('image/');
  const isVid  = mimeType.startsWith('video/');
  const isAud  = mimeType.startsWith('audio/');
  const isBusy = status === 'sending' || status === 'receiving';

  const previewKind    = canPreview(msg);
  const canShowPreview = previewKind &&
    (msg.blob || previewUrl) &&
    !['sending', 'receiving', 'queued'].includes(status);

  const bubble = isMine
    ? 'bg-brand-primary text-white'
    : 'bg-bg-primary dark:bg-bg-secondary border border-border-secondary dark:border-border-primary text-text-primary dark:text-text-primary';

  // ── Deleted placeholder ────────────────────────────────────────────
  if (msg.deleted) {
    return (
      <div className={`w-[16rem] sm:w-[18rem] max-w-[85vw] rounded-3xl px-4 py-3 text-sm italic shadow-sm select-none ${
        isMine
          ? 'rounded-br-md bg-bg-secondary/45 text-text-primary/30'
          : 'rounded-bl-md border border-border-secondary bg-bg-primary/90 text-text-secondary dark:border-border-primary dark:bg-bg-secondary dark:text-text-secondary'
      }`}>
        🚫 File deleted
      </div>
    );
  }

  return (
    <>
      <div className={`w-[16rem] sm:w-[18rem] max-w-[85vw] overflow-hidden rounded-[24px] shadow-sm ${bubble}`}>

        {/* ── Image preview ─────────────────────────────────────────── */}
        {isImg && previewUrl && (
          <button className="block w-full focus:outline-none" onClick={() => setShowPreview(true)}>
            <img src={previewUrl} alt={name}
              className={`block w-full max-h-52 object-cover ${isBusy ? 'opacity-50' : 'hover:opacity-90 transition-opacity'}`}
            />
          </button>
        )}

        {/* ── Video player ──────────────────────────────────────────── */}
        {isVid && previewUrl && !isBusy && (
          <video src={previewUrl} controls className="block w-full max-h-52 bg-black" />
        )}

        {/* ── Audio visualizer ──────────────────────────────────────── */}
        {isAud && previewUrl && !isBusy && (
          <AudioVisualizer src={previewUrl} isMine={isMine} />
        )}

        {/* ── Non-media file row ────────────────────────────────────── */}
        {!isImg && !isVid && !(isAud && previewUrl && !isBusy) && (
          <div className="flex items-center gap-3 px-4 py-3.5">
            <div className={`shrink-0 rounded-xl p-2.5 ${isMine ? 'bg-white/10' : 'bg-bg-secondary dark:bg-bg-tertiary'}`}>
              <svg className={`h-5 w-5 ${isMine ? 'text-white' : 'text-text-secondary'}`}
                 fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className={`truncate text-[13px] font-medium leading-tight ${isMine ? 'text-white' : 'text-text-primary'}`}>
                {name}
              </p>
              <p className={`mt-0.5 text-[11px] ${isMine ? 'text-white/60' : 'text-text-secondary'}`}>
                {formatSize(size)}
              </p>
            </div>
          </div>
        )}

        {/* Name + size under media */}
        {(isImg || isVid || (isAud && previewUrl && !isBusy)) && (
          <p className={`truncate px-4 pt-2 text-xs ${isMine ? 'text-white/60' : 'text-text-secondary'}`}>
            {name} · {formatSize(size)}
          </p>
        )}

        {/* ── Progress bar ──────────────────────────────────────────── */}
        {(isBusy || status === 'paused') && (
          <div className={`mx-4 my-2 h-1.5 rounded-full ${isMine ? 'bg-white/20' : 'bg-bg-tertiary dark:bg-bg-tertiary'}`}>
            <div
              className={`h-1.5 rounded-full transition-all duration-300 ${
                status === 'paused' ? 'bg-brand-warning'
                : isMine ? 'bg-white' : 'bg-brand-primary'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        <div className="flex items-center justify-between gap-2 px-4 pb-3 pt-1">
          <span className={`text-[10px] uppercase tracking-wider font-semibold ${isMine ? 'text-white/50' : 'text-text-secondary'}`}>
            {status === 'queued'    && 'Queued'}
            {status === 'sending'   && `Sending ${progress}%`}
            {status === 'paused'    && `Paused · ${progress}%`}
            {status === 'canceled'  && 'Canceled'}
            {status === 'sent'      && 'Sent'}
            {status === 'receiving' && `Receiving ${progress}%`}
            {status === 'error'     && 'Error'}
            {(status === 'read' || status === 'delivered') && (status.charAt(0).toUpperCase() + status.slice(1))}
          </span>

          <div className="flex items-center gap-2">
            {/* Ticks for outgoing files */}
            {isMine && !msg.deleted && (['sent', 'delivered', 'read'].includes(status)) && (
              <div className="flex items-center select-none mr-1">
                {status === 'sent' && (
                  <svg className="h-3 w-3 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {status === 'delivered' && (
                  <div className="flex -space-x-1.5">
                    <svg className="h-3 w-3 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    <svg className="h-3 w-3 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
                {status === 'read' && (
                  <div className="flex -space-x-1.5">
                    <svg className="h-3 w-3 text-white drop-shadow-md" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                    <svg className="h-3 w-3 text-white drop-shadow-md" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </div>
            )}
            
            <div className="flex items-center gap-1">
            {/* Cancel queued */}
            {['queued', 'sending', 'receiving', 'paused'].includes(status) && onCancel && (
              <button onClick={() => onCancel(msg.id)}
                title="Cancel"
                className={`rounded-full p-2.5 transition-colors ${
                  isMine
                    ? 'text-white/70 hover:bg-white/10'
                    : 'text-text-secondary hover:bg-bg-secondary dark:hover:bg-bg-tertiary'
                }`}>
                <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}

            {/* Preview */}
            {canShowPreview && (
              <button
                onClick={() => setShowPreview(true)}
                title="Preview"
                className={`rounded-full p-2.5 transition-colors ${
                  isMine
                    ? 'text-white/70 hover:bg-white/10'
                    : 'text-text-secondary hover:bg-bg-secondary dark:hover:bg-bg-tertiary'
                }`}
              >
                <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </button>
            )}

            {/* Download — peer received */}
            {!isMine && status === 'received' && (
              <button onClick={() => onDownload?.(msg)}
                title={isImg || isVid ? 'Save' : 'Download'}
                className="rounded-full p-2.5 text-text-secondary hover:bg-bg-secondary dark:hover:bg-bg-tertiary transition-colors">
                <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M7 10l5 5m0 0l5-5m-5 5V3" />
                </svg>
              </button>
            )}

            {/* Save — own sent image */}
            {isMine && status === 'sent' && isImg && previewUrl && (
              <button onClick={() => onDownload?.(msg)}
                title="Save"
                className="rounded-full p-2.5 text-white/70 hover:bg-white/10 transition-colors">
                <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M7 10l5 5m0 0l5-5m-5 5V3" />
                </svg>
              </button>
            )}

            {/* Delete — own messages only */}
            {isMine && !isBusy && status !== 'queued' && (
              <button onClick={() => onDelete?.(msg.id)}
                title="Delete"
                className={`rounded-full p-2.5 transition-colors ${
                  isMine
                    ? 'text-white/70 hover:bg-brand-danger/20 hover:text-white'
                    : 'text-text-secondary hover:bg-brand-danger/10 hover:text-brand-danger'
                }`}>
                <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>

      {/* ── Preview modal ────────────────────────────────────────────── */}
      {showPreview && (
        <FilePreviewModal msg={msg} onClose={() => setShowPreview(false)} />
      )}
    </>
  );
}
