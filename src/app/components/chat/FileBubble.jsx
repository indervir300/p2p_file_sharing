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

  const isMedia = isImg || isVid;

  return (
    <>
      <div className={`relative group/bubble w-[16rem] sm:w-[18rem] max-w-[85vw] overflow-hidden rounded-[28px] shadow-md transition-all duration-300 hover:shadow-lg ${bubble}`}>
        
        {/* ── Progress Overlay (for media being transferred) ────────── */}
        {(isBusy || status === 'paused') && isMedia && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px]">
            <div className="w-24 h-1.5 rounded-full bg-white/20 overflow-hidden">
               <div 
                 className="h-full bg-white transition-all duration-300" 
                 style={{ width: `${progress}%` }} 
               />
            </div>
            <p className="mt-2 text-[10px] font-bold text-white uppercase tracking-widest">
              {status === 'receiving' ? 'Receiving' : 'Sending'} {progress}%
            </p>
          </div>
        )}

        {/* ── Media Content ─────────────────────────────────────────── */}
        <div className="relative">
          {/* Image */}
          {isImg && previewUrl && (
            <button className="block w-full focus:outline-none" onClick={() => setShowPreview(true)}>
              <img src={previewUrl} alt={name}
                className={`block w-full max-h-[400px] object-cover transition-transform duration-500 group-hover/bubble:scale-105 ${isBusy ? 'opacity-50' : ''}`}
              />
            </button>
          )}

          {/* Video */}
          {isVid && previewUrl && !isBusy && (
            <video src={previewUrl} controls className="block w-full max-h-80 bg-black" />
          )}

          {/* Audio */}
          {isAud && previewUrl && !isBusy && (
            <div className="p-2">
              <AudioVisualizer src={previewUrl} isMine={isMine} />
            </div>
          )}

          {/* Media Overlays */}
          {isMedia && (
            <>
              {/* Top Overlay: Name & Size */}
              <div className="absolute top-0 inset-x-0 p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent opacity-0 group-hover/bubble:opacity-100 transition-all duration-300 -translate-y-2 group-hover/bubble:translate-y-0">
                <p className="truncate text-xs font-bold text-white drop-shadow-sm">{name}</p>
                <p className="text-[10px] text-white/70 font-medium uppercase tracking-wider">{formatSize(size)}</p>
              </div>

              {/* Bottom Actions & Status Overlay */}
              <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover/bubble:opacity-100 transition-all duration-300 translate-y-2 group-hover/bubble:translate-y-0 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-white/90 uppercase tracking-widest">
                    {status === 'read' || status === 'delivered' ? status : (isMine ? status : '')}
                  </span>
                  {isMine && (status === 'delivered' || status === 'read') && (
                    <div className="flex -space-x-1">
                       <svg className={`h-3 w-3 ${status === 'read' ? 'text-brand-primary' : 'text-white/60'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                       </svg>
                       <svg className={`h-3 w-3 ${status === 'read' ? 'text-brand-primary' : 'text-white/60'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                       </svg>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  {canShowPreview && (
                    <button onClick={() => setShowPreview(true)} className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors">
                       <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                       </svg>
                    </button>
                  )}
                  {!isMine && status === 'received' && (
                    <button onClick={() => onDownload?.(msg)} className="p-2 rounded-full bg-brand-primary text-white hover:bg-brand-primary-hover transition-colors">
                       <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M7 10l5 5m0 0l5-5m-5 5V3" />
                       </svg>
                    </button>
                  )}
                  {isMine && !isBusy && (
                    <button onClick={() => onDelete?.(msg.id)} className="p-2 rounded-full bg-red-500/20 hover:bg-red-500/40 text-red-100 transition-colors">
                       <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                       </svg>
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Non-media layout ────────────────────────────────────────── */}
        {!isMedia && (
          <div className="flex flex-col">
            <div className="flex items-center gap-3 px-4 py-4">
              <div className={`shrink-0 rounded-2xl p-3 ${isMine ? 'bg-white/10' : 'bg-bg-secondary dark:bg-bg-tertiary'}`}>
                <svg className={`h-6 w-6 ${isMine ? 'text-white' : 'text-brand-primary'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className={`truncate text-sm font-bold ${isMine ? 'text-white' : 'text-text-primary'}`}>{name}</p>
                <p className={`text-[11px] ${isMine ? 'text-white/60' : 'text-text-secondary'}`}>{formatSize(size)}</p>
              </div>
            </div>

            {/* Progress Bar */}
            {(isBusy || status === 'paused') && (
              <div className="px-4 pb-2">
                <div className={`h-1.5 rounded-full overflow-hidden ${isMine ? 'bg-white/20' : 'bg-bg-tertiary dark:bg-bg-tertiary'}`}>
                  <div className={`h-full transition-all duration-300 ${status === 'paused' ? 'bg-brand-warning' : (isMine ? 'bg-white' : 'bg-brand-primary')}`} style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between px-4 pb-4 pt-1">
              <span className={`text-[10px] font-bold uppercase tracking-wider ${isMine ? 'text-white/50' : 'text-text-secondary'}`}>
                {status === 'read' || status === 'delivered' ? status : status}
              </span>
              <div className="flex items-center gap-2">
                {isMine && (status === 'delivered' || status === 'read') && (
                  <div className="flex -space-x-1 mr-1">
                     <svg className={`h-3.5 w-3.5 ${status === 'read' ? 'text-white' : 'text-white/40'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                     </svg>
                     <svg className={`h-3.5 w-3.5 ${status === 'read' ? 'text-white' : 'text-white/40'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                     </svg>
                  </div>
                )}
                {/* Actions */}
                <div className="flex items-center gap-1">
                  {!isMine && status === 'received' && (
                    <button onClick={() => onDownload?.(msg)} className="p-2 rounded-full bg-brand-primary text-white hover:bg-brand-primary-hover transition-colors">
                       <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M7 10l5 5m0 0l5-5m-5 5V3" />
                       </svg>
                    </button>
                  )}
                  {isMine && !isBusy && (
                    <button onClick={() => onDelete?.(msg.id)} className={`p-2 rounded-full transition-colors ${isMine ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-red-50 text-red-500 hover:bg-red-100'}`}>
                       <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                       </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Preview modal ────────────────────────────────────────────── */}
      {showPreview && (
        <FilePreviewModal msg={msg} onClose={() => setShowPreview(false)} />
      )}
    </>
  );
}
