'use client';
import { useRef, useState } from 'react';
import { motion } from 'framer-motion';

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
    setDragging(false);
  };

  if (selectedFile) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="rounded-2xl border border-border-secondary bg-bg-secondary/70 p-6 text-center shadow-sm backdrop-blur-sm"
      >
        <motion.div
          className="text-5xl mb-4"
          whileHover={{ scale: 1.1 }}
          transition={{ type: 'spring', stiffness: 200 }}
        >
          {getFileIcon(selectedFile)}
        </motion.div>
        <p className="truncate font-semibold text-text-primary text-base">{selectedFile.name}</p>
        <p className="mt-2 text-sm text-text-secondary">{formatSize(selectedFile.size)}</p>
      </motion.div>
    );
  }

  return (
    <motion.div
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      animate={{
        scale: dragging ? 1.01 : 1,
        boxShadow: dragging
          ? 'var(--shadow-premium), 0 0 30px rgba(10, 102, 194, 0.2)'
          : 'var(--shadow-md)',
      }}
      className={`rounded-2xl border-2 border-dashed p-12 text-center cursor-pointer transition-all duration-200 backdrop-blur-sm
        ${dragging
          ? 'border-brand-primary bg-bg-primary/60 dark:bg-bg-secondary/60'
          : 'border-border-secondary bg-bg-secondary/40 hover:border-brand-primary hover:bg-bg-secondary/60 dark:border-border-primary dark:bg-bg-secondary/30 dark:hover:bg-bg-secondary/50'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        disabled={disabled}
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          if (files.length > 0) onFilesSelect(files);
          e.target.value = '';
        }}
      />
      <motion.div
        className={`mb-6 inline-flex h-20 w-20 items-center justify-center rounded-2xl border border-border-secondary bg-bg-primary/90 text-brand-primary shadow-md dark:border-border-primary dark:bg-bg-secondary`}
        animate={dragging ? { scale: 1.15, y: -4 } : { scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      >
        <motion.svg
          className="h-10 w-10"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          animate={dragging ? { y: -2 } : { y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 0115.9 6L16 6a5 5 0 011 9.9M12 12v9m0 0l-3-3m3 3l3-3" />
        </motion.svg>
      </motion.div>
      <p className="font-semibold text-text-primary text-lg mb-2">
        {dragging ? 'Release to send' : 'Drop files or folders here'}
      </p>
      <p className="text-sm text-text-secondary">{disabled ? 'Transfer in progress' : 'Or click to browse your files'}</p>
    </motion.div>
  );
}