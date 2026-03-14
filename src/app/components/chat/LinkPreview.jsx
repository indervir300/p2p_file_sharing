export default function LinkPreview({ preview, isMine }) {
  if (!preview || preview.error) return null;
  const { url, title, description, image, siteName, favicon } = preview;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`mt-2 block rounded-xl overflow-hidden border transition-opacity hover:opacity-90 ${
        isMine
          ? 'border-white/10 bg-white/10'
          : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900'
      }`}
    >
      {image && (
        <img
          src={image}
          alt={title || 'Preview'}
          className="w-full max-h-36 object-cover"
          onError={(e) => { e.target.style.display = 'none'; }}
        />
      )}
      <div className="flex items-start gap-2 px-3 py-2">
        {favicon && (
          <img src={favicon} alt="" className="h-4 w-4 rounded-sm mt-0.5 shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <p className={`text-[10px] font-semibold uppercase tracking-wide mb-0.5 truncate ${
            isMine ? 'text-white/50' : 'text-slate-400 dark:text-slate-500'
          }`}>
            {siteName}
          </p>
          {title && (
            <p className={`text-xs font-semibold leading-snug line-clamp-2 ${
              isMine ? 'text-white' : 'text-slate-800 dark:text-slate-100'
            }`}>
              {title}
            </p>
          )}
          {description && (
            <p className={`text-xs mt-0.5 line-clamp-2 leading-snug ${
              isMine ? 'text-white/50' : 'text-slate-500 dark:text-slate-400'
            }`}>
              {description}
            </p>
          )}
        </div>
      </div>
    </a>
  );
}
