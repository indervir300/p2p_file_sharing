'use client';
import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Radar, Send } from 'lucide-react';
import Avatar from '@/app/components/ui/Avatar';

function safeParseHex(id, start, end) {
  if (!id || typeof id !== 'string' || id.length < Math.abs(end)) return 0;
  const parsed = parseInt(id.slice(start, end), 16);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Radar-style peer discovery. Peers orbit the local node; clicking one sends an invite.
 */
const DiscoveryNetwork = ({ peers = [], onConnect, nickname = 'You', busy = false }) => {
  const peersWithPositions = useMemo(() => {
    return peers.map((peer, index) => {
      const baseAngle = index * (360 / Math.max(peers.length, 1));
      const jitter = (safeParseHex(peer.id, 0, 2) % 24) - 12;
      const angle = baseAngle + jitter;
      const distance = 34 + (safeParseHex(peer.id, -2, peer.id?.length) % 8);
      const rad = (angle - 90) * (Math.PI / 180);
      return {
        ...peer,
        x: 50 + distance * Math.cos(rad),
        y: 50 + distance * Math.sin(rad),
      };
    });
  }, [peers]);

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

        {/* Links */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full">
          <defs>
            <linearGradient id="dn-link" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--brand-primary)" stopOpacity="0.55" />
              <stop offset="100%" stopColor="var(--brand-accent-2)" stopOpacity="0.2" />
            </linearGradient>
          </defs>
          {peersWithPositions.map((peer) => (
            <line
              key={`link-${peer.id}`}
              x1="50%" y1="50%"
              x2={`${peer.x}%`} y2={`${peer.y}%`}
              stroke="url(#dn-link)"
              strokeWidth="1.5"
              strokeDasharray="5 6"
              className="transition-all duration-700"
            />
          ))}
        </svg>

        {/* Local node */}
        <div className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
          <div className="relative flex flex-col items-center">
            <span className="absolute inset-0 -z-10 scale-[1.8] rounded-full bg-brand-primary/25 blur-2xl" />
            <span className="absolute left-1/2 top-1/2 h-17 w-17 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-3xl border-2 border-brand-primary/40" />
            <div className="relative rounded-3xl p-0.5" style={{ background: 'linear-gradient(140deg, var(--brand-primary), var(--brand-accent))' }}>
              <Avatar name={nickname} size={64} rounded="rounded-[1.35rem]" ring={false} className="bg-bg-primary" />
            </div>
            <span className="mt-2 whitespace-nowrap rounded-full border border-border-secondary bg-bg-primary/90 px-2.5 py-1 text-[11px] font-bold text-text-primary shadow-sm backdrop-blur dark:border-border-primary dark:bg-bg-secondary/90">
              {nickname} · you
            </span>
          </div>
        </div>

        {/* Peers */}
        {peersWithPositions.map((peer, i) => (
          <motion.div
            key={peer.id}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20, delay: i * 0.05 }}
            className="absolute z-10"
            style={{ left: `${peer.x}%`, top: `${peer.y}%`, transform: 'translate(-50%, -50%)' }}
          >
            <button
              onClick={() => onConnect(peer)}
              disabled={busy}
              title={`Send files to ${peer.nickname}`}
              className="group relative flex flex-col items-center outline-none disabled:opacity-60"
            >
              <span className="absolute inset-0 -z-10 scale-[1.6] rounded-full bg-brand-success/0 blur-lg transition-colors duration-300 group-hover:bg-brand-success/30" />

              <span className="relative block transition-transform duration-300 group-hover:scale-110 group-focus-visible:scale-110">
                <Avatar name={peer.nickname} size={52} rounded="rounded-2xl" ring={false} className="shadow-md ring-2 ring-border-secondary transition-colors group-hover:ring-brand-success dark:ring-border-primary" />
                <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-brand-success text-white opacity-0 shadow-sm ring-2 ring-bg-canvas transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
                  <Send className="h-2.5 w-2.5" strokeWidth={2.6} />
                </span>
              </span>

              <span className="mt-2 max-w-30 truncate whitespace-nowrap rounded-full border border-border-secondary bg-bg-primary/85 px-2.5 py-0.5 text-[11px] font-semibold text-text-primary shadow-sm backdrop-blur transition-colors group-hover:border-brand-success/60 dark:border-border-primary dark:bg-bg-secondary/85">
                {peer.nickname}
              </span>
            </button>
          </motion.div>
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
