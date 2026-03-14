'use client';
import { useState, useRef, useCallback } from 'react';

function formatSize(bytes) {
  if (bytes < 1024)      return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

export default function SendQueue({ queue, onReorder, onCancel }) {
  const [draggingIdx, setDraggingIdx] = useState(null);
  const [overIdx, setOverIdx]         = useState(null);
  const dragNode                       = useRef(null);

  // ── Drag handlers ──────────────────────────────────────────────────
  const onDragStart = useCallback((e, idx) => {
    if (idx === 0) { e.preventDefault(); return; } // can't move in-progress item
    dragNode.current = idx;
    setDraggingIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const onDragOver = useCallback((e, idx) => {
    e.preventDefault();
    if (idx === 0) return; // can't drag onto in-progress slot
    if (idx !== draggingIdx) setOverIdx(idx);
  }, [draggingIdx]);

  const onDrop = useCallback((e, idx) => {
    e.preventDefault();
    if (draggingIdx === null || idx === draggingIdx || idx === 0) return;
    onReorder(draggingIdx, idx);
    setDraggingIdx(null);
    setOverIdx(null);
  }, [draggingIdx, onReorder]);

  const onDragEnd = useCallback(() => {
    setDraggingIdx(null);
    setOverIdx(null);
  }, []);

  // ── Touch drag (mobile) ────────────────────────────────────────────
  const touchStart  = useRef(null);
  const touchMsgId  = useRef(null);

  const onTouchStart = useCallback((e, idx) => {
    if (idx === 0) return;
    touchStart.current = { y: e.touches[0].clientY, idx };
    touchMsgId.current = idx;
    setDraggingIdx(idx);
  }, []);

  const onTouchMove = useCallback((e) => {
    if (touchStart.current === null) return;
    const el = document.elementFromPoint(
      e.touches[0].clientX, e.touches[0].clientY
    );
    const row = el?.closest('[data-queue-idx]');
    if (row) {
      const newIdx = parseInt(row.dataset.queueIdx, 10);
      if (!isNaN(newIdx) && newIdx !== 0) setOverIdx(newIdx);
    }
  }, []);

  const onTouchEnd = useCallback(() => {
    if (touchStart.current !== null && overIdx !== null && overIdx !== touchStart.current.idx) {
      onReorder(touchStart.current.idx, overIdx);
    }
    touchStart.current = null;
    touchMsgId.current = null;
    setDraggingIdx(null);
    setOverIdx(null);
  }, [overIdx, onReorder]);

  if (!queue.length) return null;

  return (
    <div className="shrink-0 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1.5">
        Send Queue — drag to reorder
      </p>
      <div className="flex flex-col gap-1">
        {queue.map(({ file, msgId, status, progress }, idx) => (
          <div
            key={msgId}
            data-queue-idx={idx}
            draggable={idx !== 0}
            onDragStart={(e) => onDragStart(e, idx)}
            onDragOver={(e) => onDragOver(e, idx)}
            onDrop={(e) => onDrop(e, idx)}
            onDragEnd={onDragEnd}
            onTouchStart={(e) => onTouchStart(e, idx)}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-all select-none ${
              draggingIdx === idx
                ? 'opacity-40'
                : overIdx === idx
                ? 'bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700'
                : 'bg-slate-50 dark:bg-slate-800'
            } ${idx === 0 ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'}`}
          >
            {/* Drag handle — hidden for active item */}
            {idx !== 0 && (
              <svg className="h-3.5 w-3.5 shrink-0 text-slate-300 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
              </svg>
            )}

            {idx === 0 && (
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
            )}

            <span className="truncate flex-1 text-slate-700 dark:text-slate-200">
              {file.name}
            </span>
            <span className="shrink-0 text-slate-400 dark:text-slate-500">
              {formatSize(file.size)}
            </span>

            {idx === 0 && progress > 0 && (
              <span className="shrink-0 text-emerald-500 font-medium">
                {progress}%
              </span>
            )}

            {idx !== 0 && (
              <button
                onClick={() => onCancel(msgId)}
                className="shrink-0 rounded p-0.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
