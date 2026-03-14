'use client';
import { useState, useRef, useCallback } from 'react';
import ReactionPicker from './ReactionPicker';

export default function MessageBubble({ msg, isMine, onReact }) {
  const [showPicker, setShowPicker] = useState(false);
  const longPressTimer = useRef(null);

  // ── Long press (mobile) ────────────────────────────────────────────
  const onTouchStart = useCallback(() => {
    longPressTimer.current = setTimeout(() => setShowPicker(true), 600);
  }, []);

  const onTouchEnd = useCallback(() => {
    clearTimeout(longPressTimer.current);
  }, []);

  const reactions   = msg.reactions || {};
  const hasReactions = Object.keys(reactions).length > 0;

  return (
    <div className="relative group">

      {/* Bubble */}
      <div
        className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words select-none ${
          isMine
            ? 'rounded-br-sm bg-slate-900 text-white'
            : 'rounded-bl-sm bg-white border border-slate-200 text-slate-800'
        }`}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onTouchMove={onTouchEnd}
      >
        {msg.text}
      </div>

      {/* React button — appears on hover (desktop) */}
      <button
        onClick={() => setShowPicker((s) => !s)}
        className={`absolute top-1/2 -translate-y-1/2
          opacity-0 group-hover:opacity-100 transition-opacity
          text-base p-1 rounded-full hover:bg-slate-100 text-slate-400
          ${isMine ? '-left-8' : '-right-8'}`}
        title="React"
      >
        🙂
      </button>

      {/* Reaction picker */}
      {showPicker && (
        <ReactionPicker
          alignRight={isMine}
          onSelect={(emoji) => onReact?.(msg.id, emoji)}
          onClose={() => setShowPicker(false)}
        />
      )}

      {/* Reaction count bubbles */}
      {hasReactions && (
        <div className={`flex flex-wrap gap-1 mt-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
          {Object.entries(reactions).map(([emoji, { count, mine }]) => (
            <button
              key={emoji}
              onClick={() => onReact?.(msg.id, emoji)}
              className={`flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-xs shadow-sm transition-colors ${
                mine
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span>{emoji}</span>
              {count > 1 && <span className="font-medium">{count}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
