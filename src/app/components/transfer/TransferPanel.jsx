'use client';
import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Inbox, Send, Layers, CloudDownload } from 'lucide-react';
import TransferRow from './TransferRow';
import { formatSize } from '@/utils/format';

const TABS = [
  { id: 'received', label: 'Received', Icon: Inbox },
  { id: 'sent', label: 'Sent', Icon: Send },
  { id: 'all', label: 'All', Icon: Layers },
];

const EMPTY_COPY = {
  received: { title: 'Nothing received yet', body: 'Files your peer sends will land here, ready to save.' },
  sent: { title: 'Nothing sent yet', body: 'Drop files on the left and they will show up here once delivered.' },
  all: { title: 'No activity yet', body: 'Everything you send and receive in this session appears here.' },
};

function matchesTab(item, tab) {
  if (tab === 'all') return true;
  if (tab === 'received') return item.sender === 'peer';
  return item.sender === 'me';
}

/**
 * Right-hand activity panel. Docked column on desktop (lg+), slide-over drawer below that.
 */
export default function TransferPanel({
  open,
  onClose,
  tab,
  onTabChange,
  items,
  onDownload,
  onDragOut,
  onDownloadAll,
}) {
  const [query, setQuery] = useState('');

  const counts = useMemo(() => ({
    received: items.filter((t) => t.sender === 'peer').length,
    sent: items.filter((t) => t.sender === 'me').length,
    all: items.length,
  }), [items]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((t) => matchesTab(t, tab))
      .filter((t) => !q || t.name?.toLowerCase().includes(q))
      .slice()
      .reverse();
  }, [items, tab, query]);

  const pendingSaves = useMemo(
    () => items.filter((t) => t.status === 'received' && t.blob && !t.downloaded),
    [items],
  );

  const totalBytes = useMemo(
    () => visible.reduce((sum, t) => sum + (t.size || 0), 0),
    [visible],
  );

  const totalSession = useMemo(
    () => items.reduce((sum, t) => sum + (t.size || 0), 0),
    [items],
  );

  if (!open) return null;

  return (
    <>
      {/* Scrim — drawer mode only */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
      />

      <motion.aside
        initial={{ x: '100%', opacity: 0.6 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: '100%', opacity: 0.6 }}
        transition={{ type: 'spring', stiffness: 380, damping: 38 }}
        className="glass fixed inset-y-0 right-0 z-50 flex w-[min(94vw,26rem)] flex-col border-l border-[var(--glass-border)] shadow-premium
                   lg:static lg:z-auto lg:w-[24rem] lg:shrink-0 lg:shadow-none xl:w-[26rem]"
        aria-label="Transfer activity"
      >
        {/* ── Header ── */}
        <div className="flex items-center gap-2 border-b border-border-secondary px-3 py-2 dark:border-border-primary">
          <h2 className="shrink-0 text-[13px] font-bold tracking-tight text-text-primary">Activity</h2>
          <span className="truncate text-[11px] text-text-tertiary">
            {counts.all} {counts.all === 1 ? 'item' : 'items'} · {formatSize(totalSession)}
          </span>
          <button
            onClick={onClose}
            title="Hide panel"
            className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-text-primary"
          >
            <X className="h-4 w-4" strokeWidth={2.2} />
          </button>
        </div>

        {/* ── Tabs ── */}
        <div className="px-3 pt-2.5">
          <div className="flex gap-1 rounded-xl bg-bg-tertiary/70 p-1">
            {TABS.map(({ id, label, Icon }) => {
              const active = tab === id;
              return (
                <button
                  key={id}
                  onClick={() => onTabChange(id)}
                  className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors
                    ${active ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary'}`}
                >
                  {active && (
                    <motion.span
                      layoutId="panel-tab-pill"
                      transition={{ type: 'spring', stiffness: 480, damping: 36 }}
                      className="absolute inset-0 rounded-lg bg-bg-primary shadow-sm ring-1 ring-border-secondary dark:ring-border-primary"
                    />
                  )}
                  <span className="relative flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5" strokeWidth={2.2} />
                    {label}
                    <span className={`rounded-full px-1.5 py-px text-[10px] tabular-nums ${active ? 'bg-brand-primary/12 text-brand-primary' : 'bg-bg-primary/60 text-text-tertiary'}`}>
                      {counts[id]}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Search ── */}
        {items.length > 4 && (
          <div className="px-3 pt-2.5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-tertiary" strokeWidth={2} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter by file name…"
                className="w-full rounded-xl border border-border-secondary bg-bg-primary/50 py-2 pl-9 pr-3 text-xs text-text-primary outline-none transition-colors placeholder:text-text-tertiary focus:border-brand-primary dark:border-border-primary"
              />
            </div>
          </div>
        )}

        {/* ── List ── */}
        <div className="custom-scrollbar mt-2.5 flex-1 space-y-2 overflow-y-auto px-3 pb-4">
          <AnimatePresence initial={false} mode="popLayout">
            {visible.map((item) => (
              <TransferRow
                key={item.id}
                item={item}
                onDownload={onDownload}
                onDragOut={onDragOut}
              />
            ))}
          </AnimatePresence>

          {visible.length === 0 && (
            <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
              <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-bg-tertiary text-text-tertiary">
                <Inbox className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <p className="text-sm font-semibold text-text-primary">
                {query ? 'No matches' : EMPTY_COPY[tab].title}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-text-tertiary">
                {query ? `Nothing here matches “${query}”.` : EMPTY_COPY[tab].body}
              </p>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        {pendingSaves.length > 0 && (
          <div className="border-t border-border-secondary p-3 dark:border-border-primary">
            <button
              onClick={onDownloadAll}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-brand py-2.5 text-sm font-semibold text-white shadow-md shadow-brand-primary/25 transition-transform hover:scale-[1.01] active:scale-[0.99]"
            >
              <CloudDownload className="h-4 w-4" strokeWidth={2.2} />
              Save all {pendingSaves.length} file{pendingSaves.length > 1 ? 's' : ''}
            </button>
          </div>
        )}

        {pendingSaves.length === 0 && visible.length > 0 && (
          <div className="border-t border-border-secondary px-4 py-2.5 text-center text-[11px] text-text-tertiary dark:border-border-primary">
            {visible.length} shown · {formatSize(totalBytes)}
          </div>
        )}
      </motion.aside>
    </>
  );
}
