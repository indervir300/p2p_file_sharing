'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Radar, Send } from 'lucide-react';
import Avatar from '@/app/components/ui/Avatar';

/**
 * Spread peers over one or two rings so avatars and labels never collide.
 * Angles are evenly spaced (no jitter) and the outer ring is offset by half a
 * step so it interleaves with the inner one.
 */
function layoutPeers(peers) {
  const total = peers.length;
  if (total === 0) return [];

  const rings = total <= 6
    ? [{ radius: 34, count: total, offset: 0 }]
    : (() => {
        // Split proportionally to each ring's circumference.
        const inner = Math.max(3, Math.round(total * 0.42));
        return [
          { radius: 27, count: inner, offset: 0 },
          { radius: 42, count: total - inner, offset: 0.5 },
        ];
      })();

  const placed = [];
  let index = 0;
  rings.forEach(({ radius, count, offset }) => {
    for (let i = 0; i < count; i++) {
      const angle = ((i + offset) * 360) / count - 90;
      const rad = angle * (Math.PI / 180);
      placed.push({
        ...peers[index++],
        x: 50 + radius * Math.cos(rad),
        y: 50 + radius * Math.sin(rad),
      });
    }
  });
  return placed;
}

/**
 * Radar-style peer discovery. Peers orbit the local node; clicking one sends an invite.
 */
const DiscoveryNetwork = ({ peers = [], onConnect, nickname = 'You', busy = false }) => {
  // Nodes shrink on phones so a full ring still fits without overlapping.
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const apply = () => setCompact(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const peersWithPositions = useMemo(() => layoutPeers(peers), [peers]);

  return (
    <div className="relative flex w-full flex-1 items-center justify-center px-4 py-2">
      <div className="relative flex aspect-square w-full max-w-[min(88vw,34rem)] items-center justify-center">

        {/* Range rings */}
        <div className="pointer-events-none absolute inset-0">
          {[100, 74, 48].map((size, i) => (
            <div
              key={size}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border-secondary/70 dark:border-border-primary/50"
              style={{ width: `${size}%`, height: `${size}%`, opacity: 0.9 - i * 0.2 }}
            />
          ))}
          {/* sonar sweep */}
          <div
            className="absolute left-1/2 top-1/2 h-full w-full rounded-full"
            style={{
              background: 'conic-gradient(from 0deg, transparent 0deg, transparent 300deg, rgba(var(--brand-primary-rgb),0.14) 352deg, rgba(var(--brand-primary-rgb),0.28) 360deg)',
              animation: 'radarSweep 6s linear infinite',
              maskImage: 'radial-gradient(circle, #000 0%, #000 50%, transparent 51%)',
              WebkitMaskImage: 'radial-gradient(circle, #000 0%, #000 50%, transparent 51%)',
            }}
          />
        </div>

        {/* Local node */}
        <div className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
          <div className="relative flex flex-col items-center">
            <span className="absolute inset-0 -z-10 scale-[1.8] rounded-full bg-brand-primary/25 blur-2xl" />
            <span className="absolute left-1/2 top-1/2 h-17 w-17 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-3xl border-2 border-brand-primary/40" />
            <div className="relative rounded-3xl p-0.5" style={{ background: 'linear-gradient(140deg, var(--brand-primary), var(--brand-accent))' }}>
              <Avatar name={nickname} size={compact ? 52 : 64} rounded="rounded-[1.35rem]" ring={false} className="bg-bg-primary" />
            </div>
            <span className="mt-2 max-w-24 truncate whitespace-nowrap rounded-full border border-border-secondary bg-bg-primary/90 px-2.5 py-1 text-[11px] font-bold text-text-primary shadow-sm backdrop-blur sm:max-w-none dark:border-border-primary dark:bg-bg-secondary/90">
              {nickname} · you
            </span>
          </div>
        </div>

        {/* Peers */}
        {peersWithPositions.map((peer, i) => (
          <div
            key={peer.id}
            className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${peer.x}%`, top: `${peer.y}%` }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20, delay: i * 0.05 }}
            >
              <button
                onClick={() => onConnect(peer)}
                disabled={busy}
                title={`Send files to ${peer.nickname}`}
                className="group relative flex flex-col items-center outline-none disabled:opacity-60"
              >
                <span className="absolute inset-0 -z-10 scale-[1.6] rounded-full bg-brand-success/0 blur-lg transition-colors duration-300 group-hover:bg-brand-success/30" />

                <span className="relative block transition-transform duration-300 group-hover:scale-110 group-focus-visible:scale-110">
                  <Avatar name={peer.nickname} size={compact ? 40 : 52} rounded="rounded-2xl" ring={false} className="shadow-md ring-2 ring-border-secondary transition-colors group-hover:ring-brand-success dark:ring-border-primary" />
                  <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-brand-success text-white opacity-0 shadow-sm ring-2 ring-bg-canvas transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
                    <Send className="h-2.5 w-2.5" strokeWidth={2.6} />
                  </span>
                </span>

                <span className="mt-1.5 max-w-20 truncate whitespace-nowrap rounded-full border border-border-secondary bg-bg-primary/85 px-2 py-0.5 text-[10px] font-semibold text-text-primary shadow-sm backdrop-blur transition-colors group-hover:border-brand-success/60 sm:mt-2 sm:max-w-30 sm:px-2.5 sm:text-[11px] dark:border-border-primary dark:bg-bg-secondary/85">
                  {peer.nickname}
                </span>
              </button>
            </motion.div>
          </div>
        ))}

        {/* Empty state */}
        {peers.length === 0 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-2 flex flex-col items-center gap-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border-secondary bg-bg-primary/70 px-3 py-1.5 text-[11px] font-medium text-text-secondary backdrop-blur dark:border-border-primary dark:bg-bg-secondary/70">
              <Radar className="h-3.5 w-3.5 animate-pulse text-brand-primary" strokeWidth={2.2} />
              Scanning your network for nearby devices…
            </span>
            <span className="text-[11px] text-text-tertiary">Open this page on another device to see it appear here</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default DiscoveryNetwork;
