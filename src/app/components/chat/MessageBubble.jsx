'use client';
import { useState, useRef, useCallback } from 'react';
import ReactionPicker from './ReactionPicker';

export default function MessageBubble({ msg, isMine, onReact }) {
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
      {/* Bubble */}
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

      {/* Hover react button */}
      <button
        onClick={() => setShowPicker((s) => !s)}
        className={`absolute top-1/2 -translate-y-1/2
          opacity-0 group-hover:opacity-100 transition-opacity
          text-base p-1 rounded-full
          hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400
          ${isMine ? '-left-8' : '-right-8'}`}
        title="React"
      >
        🙂
      </button>

      {/* Picker */}
      {showPicker && (
        <ReactionPicker
          alignRight={isMine}
          myCurrentEmoji={Object.keys(reactions).find((e) => reactions[e].mine) || null}
          onSelect={(emoji) => { onReact?.(msg.id, emoji); setShowPicker(false); }}
          onClose={() => setShowPicker(false)}
        />
      )}

      {/* Reaction bubbles */}
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
