'use client';
import { motion } from 'framer-motion';

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

  const remaining = total - transferred;
  const eta = speed > 0 ? remaining / speed : 0;
  const etaLabel = eta > 60
    ? `${Math.floor(eta / 60)}m ${Math.floor(eta % 60)}s`
    : `${Math.floor(eta)}s`;

  const isComplete = percent === 100;

  return (
    <motion.div
      className="w-full space-y-3"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Stats Row */}
      <div className="flex justify-between text-sm">
        <span className="truncate pr-2 text-text-secondary font-medium">
          {formatSize(transferred)} / {formatSize(total)}
        </span>
        <motion.span
          className="shrink-0 font-semibold text-brand-primary"
          key={percent}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          {percent}%
        </motion.span>
      </div>

      {/* Progress bar container */}
      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-bg-tertiary shadow-sm">
        <motion.div
          className={`h-2.5 rounded-full shadow-md ${isComplete ? 'bg-brand-success' : 'bg-brand-primary'}`}
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
        {percent > 0 && percent < 100 && (
          <motion.div
            className="absolute inset-0 h-full w-full rounded-full bg-gradient-to-r from-transparent via-white/30 to-transparent"
            animate={{ x: ['0%', '100%'] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
          />
        )}
      </div>

      {/* Speed & ETA */}
      <div className="flex justify-between text-xs text-text-tertiary">
        <motion.span
          key={`speed-${speed}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          {speed > 0 ? `${formatSpeed(speed)}` : ''}
        </motion.span>
        <motion.span
          key={`eta-${etaLabel}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          {speed > 0 && percent < 100 ? `~${etaLabel} remaining` : isComplete ? 'Complete' : ''}
        </motion.span>
      </div>
    </motion.div>
  );
}