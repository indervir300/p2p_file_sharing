'use client';
import { useState, useRef, useCallback } from 'react';
import ReactionPicker from './ReactionPicker';

export default function MessageBubble({ msg, isMine, onReact, onReply }) {
  const [showPicker, setShowPicker] = useState(false);
  const longPressTimer = useRef(null);

  const onTouchStart = useCallback(() => {
    longPressTimer.current = setTimeout(() => setShowPicker(true), 600);
  }, []);
  const onTouchEnd = useCallback(() => clearTimeout(longPressTimer.current), []);

  const reactions    = msg.reactions || {};
  const reactionList = Object.entries(reactions).filter(([, r]) => r.mine || r.peer);

  return (
    <div className="relative group">

      {/* ── Reply quote (if this message is a reply) ──────────────── */}
      {msg.replyTo && (
        <div className={`mb-1 flex ${isMine ? 'justify-end' : 'justify-start'}`}>
          <div className={`max-w-[90%] rounded-xl px-3 py-1.5 text-xs border-l-2 cursor-default select-none ${
            isMine
              ? 'bg-slate-800/60 dark:bg-slate-700/60 border-slate-400 text-slate-300'
              : 'bg-slate-100 dark:bg-slate-700 border-slate-400 text-slate-500 dark:text-slate-400'
          }`}>
            <p className="font-semibold mb-0.5 text-[10px] uppercase tracking-wide opacity-70">
              {msg.replyTo.sender === 'me' ? 'You' : 'Peer'}
            </p>
            <p className="truncate">
              {msg.replyTo.type === 'file' ? `📎 ${msg.replyTo.name}` : msg.replyTo.text}
            </p>
          </div>
        </div>
      )}

      {/* ── Bubble ───────────────────────────────────────────────── */}
      <div
        className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words select-none ${
          isMine
            ? 'rounded-br-sm bg-slate-900 dark:bg-slate-700 text-white'
            : 'rounded-bl-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100'
        }`}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onTouchMove={onTouchEnd}
      >
        {msg.text}
      </div>

      {/* ── Action buttons (hover, desktop) ──────────────────────── */}
      <div className={`absolute top-1/2 -translate-y-1/2 flex items-center gap-0.5
        opacity-0 group-hover:opacity-100 transition-opacity
        ${isMine ? '-left-16' : '-right-16'}`}
      >
        {/* Reply */}
        <button
          onClick={() => onReply?.(msg)}
          title="Reply"
          className="p-1 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
        </button>

        {/* React */}
        <button
          onClick={() => setShowPicker((s) => !s)}
          title="React"
          className="p-1 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-base"
        >
          🙂
        </button>
      </div>

      {/* ── Reaction picker ───────────────────────────────────────── */}
      {showPicker && (
        <ReactionPicker
          alignRight={isMine}
          myCurrentEmoji={Object.keys(reactions).find((e) => reactions[e].mine) || null}
          onSelect={(emoji) => { onReact?.(msg.id, emoji); setShowPicker(false); }}
          onClose={() => setShowPicker(false)}
        />
      )}

      {/* ── Reaction bubbles ──────────────────────────────────────── */}
      {reactionList.length > 0 && (
        <div className={`flex flex-wrap gap-1 mt-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
          {reactionList.map(([emoji, r]) => {
            const count = (r.mine ? 1 : 0) + (r.peer ? 1 : 0);
            return (
              <button
                key={emoji}
                onClick={() => onReact?.(msg.id, emoji)}
                className={`flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-xs shadow-sm transition-colors ${
                  r.mine
                    ? 'bg-indigo-50 dark:bg-indigo-900/50 border-indigo-200 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                <span>{emoji}</span>
                {count > 1 && <span className="font-medium">{count}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
