export function formatSize(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

export function formatSpeed(bytesPerSec) {
  const n = Number(bytesPerSec) || 0;
  if (n < 1024) return `${n.toFixed(0)} B/s`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB/s`;
  return `${(n / 1024 ** 2).toFixed(1)} MB/s`;
}

export function formatTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Seconds remaining → "1m 04s" / "42s". Returns '' when not computable. */
export function formatEta(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  if (seconds > 3600) return '> 1h';
  if (seconds < 1) return '< 1s';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return m > 0 ? `${m}m ${String(s).padStart(2, '0')}s` : `${s}s`;
}

/** Broad category used for icons / previews. */
export function fileKind(name = '', mimeType = '') {
  const type = mimeType || '';
  if (type.startsWith('image/')) return 'image';
  if (type.startsWith('video/')) return 'video';
  if (type.startsWith('audio/')) return 'audio';
  if (type === 'application/pdf' || /\.pdf$/i.test(name)) return 'pdf';
  if (/\.(zip|rar|7z|tar|gz|bz2)$/i.test(name)) return 'archive';
  if (/\.(txt|md|csv|log|rtf|docx?)$/i.test(name)) return 'text';
  if (/\.(js|jsx|ts|tsx|py|java|c|cpp|cs|go|rs|rb|php|html|css|json|xml|yml|yaml|sh)$/i.test(name)) return 'code';
  return 'file';
}

export function fileExtension(name = '') {
  const idx = name.lastIndexOf('.');
  if (idx <= 0 || idx === name.length - 1) return '';
  return name.slice(idx + 1).toUpperCase().slice(0, 4);
}
