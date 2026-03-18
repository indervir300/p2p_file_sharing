'use client';
import { useState, useMemo } from 'react';

export default function MediaGallery({ messages, onClose, onDownload, onScrollTo }) {
  const [filter, setFilter] = useState('all'); // all, images, files

  const mediaItems = useMemo(() => {
    return messages.filter(m => m.type === 'file' && !m.deleted);
  }, [messages]);

  const filteredItems = useMemo(() => {
    if (filter === 'all') return mediaItems;
    if (filter === 'images') {
      return mediaItems.filter(m => {
        const type = m.mimeType || '';
        return type.startsWith('image/') || type.startsWith('video/');
      });
    }
    if (filter === 'files') {
      return mediaItems.filter(m => {
        const type = m.mimeType || '';
        return !type.startsWith('image/') && !type.startsWith('video/');
      });
    }
    return mediaItems;
  }, [mediaItems, filter]);

  return (
    <div className="flex h-full w-full flex-col bg-white/70 backdrop-blur-3xl border-l border-white/20 dark:bg-black/70 dark:border-white/10 shadow-3xl animate-in slide-in-from-right duration-500 ease-out">
      {/* Header Area */}
      <div className="flex items-center justify-between p-4 gap-4">
        {/* Tabs - Icons only */}
        <div className="flex flex-1 p-1 bg-black/5 dark:bg-white/5 rounded-2xl gap-1">
          {[
            { id: 'all', icon: (
              <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            )},
            { id: 'images', icon: (
              <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            )},
            { id: 'files', icon: (
              <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            )},
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setFilter(t.id)}
              title={t.id.charAt(0).toUpperCase() + t.id.slice(1)}
              className={`flex flex-1 items-center justify-center h-9 rounded-xl transition-all duration-300 ${
                filter === t.id 
                  ? 'bg-white text-brand-primary shadow-md scale-100 dark:bg-bg-secondary dark:text-brand-primary' 
                  : 'text-text-secondary hover:text-text-primary hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              {t.icon}
            </button>
          ))}
        </div>

        <button 
          onClick={onClose}
          className="p-2.5 rounded-2xl bg-black/5 dark:bg-white/5 hover:bg-brand-danger/10 hover:text-brand-danger transition-all duration-300"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-60 text-text-secondary/40">
            <svg className="h-12 w-12 mb-3 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-sm font-medium">No items shared yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {filteredItems.map(item => {
              const isMedia = item.mimeType?.startsWith('image/') || item.mimeType?.startsWith('video/');
              return (
                <div 
                  key={item.id}
                  className="group relative aspect-square rounded-xl border border-border-secondary bg-bg-tertiary dark:border-border-primary overflow-hidden hover:ring-2 hover:ring-brand-primary transition-all cursor-pointer"
                >
                  {isMedia && item.previewUrl ? (
                    <img 
                      src={item.previewUrl} 
                      className="h-full w-full object-cover" 
                      alt="" 
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center p-2 text-center">
                      <svg className="h-8 w-8 text-brand-primary/50 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      <span className="text-[10px] font-medium text-text-secondary truncate w-full px-1">
                        {item.name || item.fileName}
                      </span>
                    </div>
                  )}
                  {/* Hover Overlay */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[2px]">
                    {item.sender !== 'me' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDownload(item);
                        }}
                        className="flex h-7 w-28 items-center justify-center gap-1.5 rounded-lg bg-white text-[10px] font-bold text-brand-primary shadow-lg hover:bg-brand-primary hover:text-white transition-all duration-300"
                      >
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onScrollTo(item.id);
                      }}
                      className="flex h-7 w-28 items-center justify-center gap-1.5 rounded-lg bg-brand-primary text-[10px] font-bold text-white shadow-lg hover:bg-brand-primary-hover transition-all duration-300"
                    >
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      Go to Chat
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
