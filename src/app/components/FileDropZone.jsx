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

export default function FileDropZone({ onFileSelect, disabled, selectedFile }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && !disabled) onFileSelect(file);
  };

  if (selectedFile) {
    return (
      <div className="border border-slate-700/50 bg-slate-800/40 rounded-2xl p-6 text-center">
        <div className="text-4xl mb-3">{getFileIcon(selectedFile)}</div>
        <p className="text-slate-200 font-medium truncate">{selectedFile.name}</p>
        <p className="text-slate-500 text-sm mt-1">{formatSize(selectedFile.size)}</p>
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-300
        ${dragging
          ? 'border-indigo-400 bg-indigo-950/50 shadow-lg shadow-indigo-500/10 scale-[1.02]'
          : 'border-slate-700 hover:border-indigo-500/50 bg-slate-800/30 hover:bg-slate-800/50'
        }
        ${disabled ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}`}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => e.target.files[0] && onFileSelect(e.target.files[0])}
      />
      <div className={`text-4xl mb-3 transition-transform duration-300 ${dragging ? 'scale-110' : ''}`}>
        {dragging ? '⬇️' : '📁'}
      </div>
      <p className="text-slate-300 font-medium">
        {dragging ? 'Drop it here!' : 'Drop file here or click to select'}
      </p>
      <p className="text-slate-600 text-sm mt-1">Any file type • Any size</p>
    </div>
  );
}
