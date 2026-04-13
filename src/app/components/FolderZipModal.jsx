'use client';

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Modal that appears when a folder is dropped.
 * Shows a simple progress while compressing, then lets the user send.
 */
export default function FolderZipModal({ items, onSend, onCancel }) {
  if (!items || items.length === 0) return null;

  const allDone = items.every((i) => i.state === 'ready' || i.state === 'error');
  const hasReady = items.some((i) => i.state === 'ready');

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="w-full max-w-sm rounded-3xl border border-border-secondary bg-bg-secondary shadow-2xl dark:border-border-primary dark:bg-bg-secondary overflow-hidden">

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border-secondary dark:border-border-primary">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-primary/10 text-brand-primary">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-text-primary text-base">
                {allDone ? 'Ready to send' : 'Preparing...'}
              </h3>
              <p className="text-xs text-text-secondary mt-0.5">
                {allDone
                  ? `${items.length} ${items.length === 1 ? 'item' : 'items'} ready`
                  : 'Compressing files…'}
              </p>
            </div>
          </div>
        </div>

        {/* Items list */}
        <div className="px-6 py-4 flex flex-col gap-3">
          {items.map((item, idx) => (
            <div key={idx} className="flex items-center gap-3 rounded-2xl border border-border-secondary dark:border-border-primary bg-bg-primary dark:bg-bg-tertiary/50 px-4 py-3">

              {/* Status icon */}
              <div className="shrink-0">
                {item.state === 'zipping' && (
                  <div className="h-5 w-5 rounded-full border-2 border-brand-primary border-t-transparent animate-spin" />
                )}
                {item.state === 'ready' && (
                  <svg className="h-5 w-5 text-brand-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {item.state === 'error' && (
                  <svg className="h-5 w-5 text-brand-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-text-primary">
                  {item.state === 'ready' ? `${item.name}.zip` : item.name}
                </p>
                <p className="text-xs text-text-secondary mt-0.5">
                  {item.state === 'zipping' && 'Compressing…'}
                  {item.state === 'ready' && item.zipFile && formatSize(item.zipFile.size)}
                  {item.state === 'error' && (item.error || 'Failed')}
                </p>
              </div>

              {/* Per-item send button (only when multiple items and this one is ready) */}
              {items.length > 1 && item.state === 'ready' && item.zipFile && (
                <button
                  onClick={() => onSend(item.zipFile)}
                  className="shrink-0 rounded-full bg-brand-primary px-3 py-1 text-xs font-semibold text-white hover:bg-brand-primary-hover transition-colors"
                >
                  Send
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-full border border-border-secondary py-2.5 text-sm font-semibold text-text-secondary hover:bg-bg-tertiary transition-colors dark:border-border-primary"
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
              className={`flex-1 rounded-full py-2.5 text-sm font-semibold text-white transition-colors shadow-md
                ${allDone
                  ? 'bg-brand-primary hover:bg-brand-primary-hover shadow-brand-primary/20 cursor-pointer'
                  : 'bg-brand-primary/50 cursor-not-allowed'
                }`}
            >
              {!allDone ? 'Preparing…' : 'Send'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
