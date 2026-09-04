'use client';
import { useState } from 'react';

/** Stable hue from a name so the same peer always looks the same. */
function hueOf(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return Math.abs(hash) % 360;
}

export function avatarUrl(seed = '') {
  return `https://api.dicebear.com/7.x/lorelei/svg?seed=${encodeURIComponent(seed)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffdfbf,ffd5dc`;
}

/**
 * Peer avatar — DiceBear illustration with a graceful gradient-initial fallback
 * (offline, blocked requests, empty name).
 */
export default function Avatar({ name = '', size = 40, rounded = 'rounded-2xl', className = '', ring = true }) {
  const [failed, setFailed] = useState(false);
  const hue = hueOf(name);
  const initial = (name || '?').charAt(0).toUpperCase();

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden ${rounded} ${ring ? 'ring-2 ring-white/70 dark:ring-white/10' : ''} ${className}`}
      style={{
        width: size,
        height: size,
        background: `linear-gradient(140deg, hsl(${hue} 82% 62%), hsl(${(hue + 48) % 360} 78% 52%))`,
      }}
    >
      {!failed && name ? (
        <img
          src={avatarUrl(name)}
          alt=""
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
          draggable={false}
        />
      ) : (
        <span
          className="font-bold text-white drop-shadow-sm"
          style={{ fontSize: Math.max(11, size * 0.42) }}
        >
          {initial}
        </span>
      )}
    </span>
  );
}
