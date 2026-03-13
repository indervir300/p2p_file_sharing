'use client';

function formatSpeed(bytesPerSecond) {
  if (bytesPerSecond < 1024) return `${bytesPerSecond.toFixed(0)} B/s`;
  if (bytesPerSecond < 1024 * 1024) return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
  return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function ProgressBar({ progress }) {
  const { percent = 0, speed = 0, total = 0 } = progress || {};
  const transferred = progress?.sent || progress?.received || 0;

  // ETA calculation
  const remaining = total - transferred;
  const eta = speed > 0 ? remaining / speed : 0;
  const etaLabel = eta > 60
    ? `${Math.floor(eta / 60)}m ${Math.floor(eta % 60)}s`
    : `${Math.floor(eta)}s`;

  return (
    <div className="w-full space-y-2">
      <div className="flex justify-between text-sm text-slate-400">
        <span className="truncate pr-2">
          {formatSize(transferred)} / {formatSize(total)}
        </span>
        <span className="shrink-0">{percent}%</span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden relative">
        <div
          className="h-3 rounded-full transition-all duration-300 relative overflow-hidden"
          style={{
            width: `${percent}%`,
            background: 'linear-gradient(90deg, #6366f1, #8b5cf6, #a78bfa)',
          }}
        >
          {/* Shimmer effect */}
          <div
            className="absolute inset-0 opacity-30"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
              animation: 'shimmer 1.5s infinite',
            }}
          />
        </div>
      </div>

      {/* Speed & ETA */}
      <div className="flex justify-between text-xs text-slate-500">
        <span>{speed > 0 ? `⚡ ${formatSpeed(speed)}` : ''}</span>
        <span>{speed > 0 && percent < 100 ? `~${etaLabel} remaining` : ''}</span>
      </div>
    </div>
  );
}
