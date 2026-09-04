'use client';
import { motion } from 'framer-motion';
import { LogOut, Lock, Zap, PanelRight, ArrowUp, ArrowDown } from 'lucide-react';
import Avatar from '@/app/components/ui/Avatar';
import Switch from '@/app/components/ui/Switch';
import DarkModeToggle from '@/app/components/ui/DarkModeToggle';
import { useIsCompact } from '@/hooks/useMediaQuery';

const DOT = {
  error: 'bg-brand-danger',
  connected: 'bg-brand-success',
  transferring: 'bg-brand-primary',
  default: 'bg-brand-warning',
};

/** Top bar for the connected session: peer identity, link quality, session controls. */
export default function SessionHeader({
  peerNickname,
  status,
  connectionLabel,
  isRelay,
  sentCount,
  receivedCount,
  autoDownload,
  onAutoDownloadChange,
  panelOpen,
  onTogglePanel,
  unreadCount,
  onLeave,
}) {
  const dot = DOT[status] || DOT.default;
  const live = status === 'transferring';
  const compact = useIsCompact();

  return (
    <header className="glass sticky top-0 z-30 flex shrink-0 items-center justify-between gap-2 border-b border-[var(--glass-border)] px-2.5 py-2 sm:gap-3 sm:px-4 sm:py-2.5 lg:px-5">
      {/* Identity */}
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        <button
          onClick={onLeave}
          title="Leave this session"
          className="group flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-border-secondary bg-bg-primary/70 px-2.5 text-xs font-semibold text-text-secondary transition-all hover:border-brand-danger/40 hover:text-brand-danger sm:h-9 sm:px-3 dark:border-border-primary dark:bg-bg-secondary/60"
        >
          <LogOut className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" strokeWidth={2.2} />
          <span className="hidden sm:inline">Leave</span>
        </button>

        <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
          <div className="relative shrink-0">
            <Avatar name={peerNickname} size={compact ? 32 : 38} />
            <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-[var(--bg-primary)] ${dot} ${status !== 'connected' ? 'animate-pulse' : ''}`} />
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-bold leading-tight text-text-primary">
              {peerNickname || 'Connecting…'}
            </p>
            <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
              <span className={`inline-flex min-w-0 max-w-full items-center gap-1 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide
                ${isRelay ? 'bg-brand-warning/12 text-brand-warning' : 'bg-brand-success/12 text-brand-success'}`}>
                <Lock className="h-2.5 w-2.5 shrink-0" strokeWidth={3} />
                <span className="truncate">{connectionLabel}</span>
              </span>
              {live && (
                <span className="hidden items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-brand-primary sm:inline-flex">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-primary" />
                  Live
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        {/* Session counters */}
        <div className="mr-1 hidden items-center gap-1 rounded-full border border-border-secondary bg-bg-primary/60 px-2.5 py-1.5 md:flex dark:border-border-primary dark:bg-bg-secondary/50">
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold tabular-nums text-brand-primary">
            <ArrowUp className="h-3 w-3" strokeWidth={2.8} />{sentCount}
          </span>
          <span className="text-border-primary">|</span>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold tabular-nums text-brand-success">
            <ArrowDown className="h-3 w-3" strokeWidth={2.8} />{receivedCount}
          </span>
        </div>

        {/* Auto-download quick switch — the only place this lives */}
        <div
          className={`flex shrink-0 items-center gap-1 rounded-full border py-1 pl-1.5 pr-1.5 transition-colors sm:gap-2 sm:py-1.5 sm:pl-2.5 sm:pr-2
            ${autoDownload
              ? 'border-brand-primary/30 bg-brand-primary/[0.07]'
              : 'border-border-secondary bg-bg-primary/60 dark:border-border-primary dark:bg-bg-secondary/50'}`}
          title={autoDownload
            ? 'Auto-download is on — incoming files save to your device automatically'
            : 'Manual download — you pick which incoming files to save'}
        >
          <Zap className={`h-3.5 w-3.5 shrink-0 ${autoDownload ? 'text-brand-primary' : 'text-text-tertiary'}`} strokeWidth={2.4} />
          <span className={`hidden text-[11px] font-bold uppercase tracking-wide sm:inline ${autoDownload ? 'text-brand-primary' : 'text-text-tertiary'}`}>
            Auto
          </span>
          <Switch checked={autoDownload} onChange={onAutoDownloadChange} label="Auto-download incoming files" size="sm" />
        </div>

        {/* Panel toggle */}
        <motion.button
          whileTap={{ scale: 0.94 }}
          onClick={onTogglePanel}
          title={panelOpen ? 'Hide activity panel' : 'Show activity panel'}
          aria-pressed={panelOpen}
          className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors sm:h-9 sm:w-9
            ${panelOpen
              ? 'border-brand-primary/40 bg-brand-primary/10 text-brand-primary'
              : 'border-border-secondary bg-bg-primary/60 text-text-secondary hover:text-text-primary dark:border-border-primary dark:bg-bg-secondary/50'}`}
        >
          <PanelRight className="h-4 w-4" strokeWidth={2} />
          {!panelOpen && unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-danger px-1 text-[9px] font-bold text-white ring-2 ring-[var(--bg-primary)]">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </motion.button>

        <DarkModeToggle />
      </div>
    </header>
  );
}
