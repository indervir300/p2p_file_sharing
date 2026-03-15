'use client';
import { useRef, useState } from 'react';

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const FILE_ICONS = {
  image: '🖼️',
  video: '🎬',
  audio: '🎵',
  pdf: '📄',
  zip: '📦',
  text: '📝',
  code: '💻',
  default: '📁',
};

function getFileIcon(file) {
  if (!file) return FILE_ICONS.default;
  const type = file.type || '';
  const name = file.name || '';
  if (type.startsWith('image/')) return FILE_ICONS.image;
  if (type.startsWith('video/')) return FILE_ICONS.video;
  if (type.startsWith('audio/')) return FILE_ICONS.audio;
  if (type === 'application/pdf' || name.endsWith('.pdf')) return FILE_ICONS.pdf;
  if (/\.(zip|rar|7z|tar|gz)$/i.test(name)) return FILE_ICONS.zip;
  if (/\.(txt|md|csv|log)$/i.test(name)) return FILE_ICONS.text;
  if (/\.(js|ts|py|java|c|cpp|html|css|json|xml)$/i.test(name)) return FILE_ICONS.code;
  return FILE_ICONS.default;
}

export default function FileDropZone({ onFilesSelect, disabled, selectedFile }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length > 0 && !disabled) onFilesSelect(files);
  };

  if (selectedFile) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center">
        <div className="text-4xl mb-3">{getFileIcon(selectedFile)}</div>
        <p className="truncate font-medium text-slate-900">{selectedFile.name}</p>
        <p className="mt-1 text-sm text-slate-500">{formatSize(selectedFile.size)}</p>
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      className={`rounded-[28px] border-2 border-dashed p-10 text-center cursor-pointer transition-all duration-300 backdrop-blur-xl
        ${dragging
          ? 'scale-[1.01] border-blue-500 bg-white/80 shadow-2xl shadow-blue-500/10 dark:bg-slate-900/80'
          : 'border-slate-300/90 bg-white/65 hover:border-blue-400 hover:bg-white/80 dark:border-slate-700 dark:bg-slate-900/65 dark:hover:border-blue-500 dark:hover:bg-slate-900/80'
        }
        ${disabled ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}`}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          if (files.length > 0) onFilesSelect(files);
          e.target.value = '';
        }}
      />
      <div className={`mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-white/80 bg-white/90 text-slate-700 shadow-lg transition-transform duration-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 ${dragging ? 'scale-110' : ''}`}>
        <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M7 16a4 4 0 01-.88-7.903A5 5 0 0115.9 6L16 6a5 5 0 011 9.9M12 12v9m0 0l-3-3m3 3l3-3" />
        </svg>
      </div>
      <p className="font-semibold text-slate-900 dark:text-slate-100">
        {dragging ? 'Release to add files to chat' : 'Drop files anywhere in the chat'}
      </p>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Browse locally or drag multiple files in one step</p>
    </div>
  );
}
