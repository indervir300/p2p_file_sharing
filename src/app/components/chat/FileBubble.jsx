function formatSize(bytes) {
  if (bytes < 1024)       return `${bytes} B`;
  if (bytes < 1024 ** 2)  return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3)  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

export default function FileBubble({ msg, isMine, onDownload, onPreview, onCancel }) {
  const { mimeType = '', previewUrl, name, size, status = 'queued', progress = 0 } = msg;
  const isImg      = mimeType.startsWith('image/');
  const isVid      = mimeType.startsWith('video/');
  const isAud      = mimeType.startsWith('audio/');
  const isBusy     = status === 'sending' || status === 'receiving';
  const hasPreview = (isImg || isVid || isAud) && previewUrl;
  const bubble     = isMine
    ? 'bg-slate-900 text-white'
    : 'bg-white border border-slate-200 text-slate-800';

  return (
    <div className={`w-64 sm:w-72 max-w-[80vw] rounded-2xl overflow-hidden shadow-sm ${bubble}`}>

      {isImg && previewUrl && (
        <button className="block w-full focus:outline-none" onClick={() => onPreview?.(previewUrl)}>
          <img
            src={previewUrl} alt={name}
            className={`block w-full max-h-52 object-cover ${isBusy ? 'opacity-50' : 'hover:opacity-90 transition-opacity'}`}
          />
        </button>
      )}

      {isVid && previewUrl && !isBusy && (
        <video src={previewUrl} controls className="block w-full max-h-52 bg-black" />
      )}

      {isAud && previewUrl && !isBusy && (
        <div className="px-3 pt-3">
          <audio src={previewUrl} controls style={{ width: '100%', minWidth: 0 }} />
        </div>
      )}

      {!hasPreview && (
        <div className="flex items-center gap-3 px-4 py-3">
          <div className={`shrink-0 rounded-xl p-2.5 ${isMine ? 'bg-white/10' : 'bg-slate-100'}`}>
            <svg className={`h-5 w-5 ${isMine ? 'text-white' : 'text-slate-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className={`truncate text-sm font-medium ${isMine ? 'text-white' : 'text-slate-800'}`}>{name}</p>
            <p className={`text-xs ${isMine ? 'text-white/60' : 'text-slate-500'}`}>{formatSize(size)}</p>
          </div>
        </div>
      )}

      {hasPreview && (
        <p className={`truncate px-3 pt-1.5 text-xs ${isMine ? 'text-white/60' : 'text-slate-500'}`}>
          {name} · {formatSize(size)}
        </p>
      )}

      {/* Resumable progress — shows even on pause */}
      {(isBusy || status === 'paused') && (
        <div className={`mx-3 my-2 h-1.5 rounded-full ${isMine ? 'bg-white/20' : 'bg-slate-200'}`}>
          <div
            className={`h-1.5 rounded-full transition-all duration-300 ${
              status === 'paused'
                ? 'bg-amber-400'
                : isMine ? 'bg-white' : 'bg-slate-700'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      <div className="flex items-center justify-between gap-2 px-3 pb-3 pt-1">
        <span className={`text-xs ${isMine ? 'text-white/50' : 'text-slate-400'}`}>
          {status === 'queued'    && 'Queued…'}
          {status === 'sending'   && `Sending ${progress}%`}
          {status === 'paused'    && `Paused · ${progress}% — resuming…`}
          {status === 'sent'      && '✓ Sent'}
          {status === 'receiving' && `Receiving ${progress}%`}
          {status === 'error'     && '✗ Error'}
        </span>
        <div className="flex items-center gap-1.5">
          {status === 'queued' && isMine && onCancel && (
            <button onClick={() => onCancel(msg.id)}
              className="rounded-lg border border-white/20 px-2 py-0.5 text-xs text-white/60 hover:bg-white/10 transition-colors">
              Cancel
            </button>
          )}
          {!isMine && status === 'received' && (
            <button onClick={() => onDownload?.(msg)}
              className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors">
              {isImg || isVid ? 'Save' : 'Download'}
            </button>
          )}
          {isMine && status === 'sent' && isImg && previewUrl && (
            <button onClick={() => onDownload?.(msg)}
              className="rounded-lg border border-white/20 px-3 py-1 text-xs font-medium text-white/70 hover:bg-white/10 transition-colors">
              Save
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
