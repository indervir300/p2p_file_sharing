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
    // Do NOT stopPropagation — let it bubble up to the parent <main> which
    // has a robust parseDataTransfer logic that handles both plain files and folders.
    setDragging(false);
  };

  if (selectedFile) {
    return (
      <div className="rounded-2xl border border-border-secondary bg-bg-secondary p-6 text-center">
        <div className="text-4xl mb-3">{getFileIcon(selectedFile)}</div>
        <p className="truncate font-medium text-text-primary">{selectedFile.name}</p>
        <p className="mt-1 text-sm text-text-secondary">{formatSize(selectedFile.size)}</p>
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
          ? 'scale-[1.01] border-brand-primary bg-bg-primary/80 shadow-2xl shadow-brand-primary/10 dark:bg-bg-secondary/80'
          : 'border-border-primary/90 bg-bg-secondary/65 hover:border-brand-primary hover:bg-bg-primary/80 dark:border-border-primary dark:bg-bg-secondary/65 dark:hover:border-brand-primary dark:hover:bg-bg-secondary/80'
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
      <div className={`mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-border-secondary bg-bg-primary/90 text-text-primary shadow-lg transition-transform duration-300 dark:border-border-primary dark:bg-bg-secondary dark:text-text-primary ${dragging ? 'scale-110' : ''}`}>
        <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M7 16a4 4 0 01-.88-7.903A5 5 0 0115.9 6L16 6a5 5 0 011 9.9M12 12v9m0 0l-3-3m3 3l3-3" />
        </svg>
      </div>
      <p className="font-semibold text-text-primary dark:text-text-primary">
        {dragging ? 'Release to send' : 'Drop files or folders here'}
      </p>
      <p className="mt-1 text-sm text-text-secondary dark:text-text-secondary">Or click to browse your files</p>
    </div>
  );
}
