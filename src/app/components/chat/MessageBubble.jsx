'use client';
import { useState, useRef, useCallback } from 'react';
import ReactionPicker from './ReactionPicker';
import LinkPreview    from './LinkPreview';

export default function MessageBubble({ msg, isMine, onReact, onReply, onEdit, onDelete }) {
  const [showPicker, setShowPicker] = useState(false);
  const [isEditing,  setIsEditing]  = useState(false);
  const [editText,   setEditText]   = useState('');
  const longPressTimer = useRef(null);
  const editRef        = useRef(null);

  const onTouchStart = useCallback(() => {
    longPressTimer.current = setTimeout(() => setShowPicker(true), 600);
  }, []);
  const onTouchEnd = useCallback(() => clearTimeout(longPressTimer.current), []);

  const startEdit = () => {
    setEditText(msg.text);
    setIsEditing(true);
    setTimeout(() => { editRef.current?.focus(); editRef.current?.select(); }, 50);
  };

  const saveEdit = () => {
    const trimmed = editText.trim();
    if (trimmed && trimmed !== msg.text) onEdit?.(msg.id, trimmed);
    setIsEditing(false);
  };

  const reactions    = msg.reactions || {};
  const reactionList = Object.entries(reactions).filter(([, r]) => r.mine || r.peer);

  // ── Deleted placeholder ────────────────────────────────────────────
  if (msg.deleted) {
    return (
      <div className={`rounded-3xl px-4 py-3 text-sm italic shadow-sm select-none ${
        isMine
          ? 'rounded-br-md bg-slate-700/45 text-white/30'
          : 'rounded-bl-md border border-slate-200 bg-white/90 text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500'
      }`}>
        🚫 Message deleted
      </div>
    );
  }

  return (
    <div className="relative group">

      {/* ── Reply quote ─────────────────────────────────────────────── */}
      {msg.replyTo && (
        <div className={`mb-1 flex ${isMine ? 'justify-end' : 'justify-start'}`}>
          <div className={`max-w-[90%] rounded-2xl px-3 py-2 text-xs border-l-[3px] shadow-sm select-none ${
            isMine
              ? 'border-sky-300 bg-slate-800/60 text-slate-300 dark:bg-slate-700/60'
              : 'border-sky-400 bg-white/75 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
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

      {/* ── Bubble / Edit mode ──────────────────────────────────────── */}
      {isEditing ? (
        <div className={`rounded-3xl px-4 py-3 shadow-sm ${
          isMine
            ? 'rounded-br-md bg-slate-900 dark:bg-slate-700'
            : 'rounded-bl-md border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'
        }`}>
          <textarea
            ref={editRef}
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(); }
              if (e.key === 'Escape') setIsEditing(false);
            }}
            rows={Math.min(editText.split('\n').length + 1, 6)}
            className={`w-full resize-none bg-transparent text-sm outline-none leading-relaxed ${
              isMine ? 'text-white' : 'text-slate-800 dark:text-slate-100'
            }`}
          />
          <div className="flex justify-end gap-1.5 mt-1.5">
            <button
              onClick={() => setIsEditing(false)}
              className={`text-[11px] px-2 py-0.5 rounded-lg transition-colors ${
                isMine ? 'text-white/50 hover:bg-white/10' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              Cancel
            </button>
            <button
              onClick={saveEdit}
              className={`text-[11px] px-2 py-0.5 rounded-lg font-semibold transition-colors ${
                isMine
                  ? 'bg-white/20 text-white hover:bg-white/30'
                  : 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-700'
              }`}
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        <div
          className={`rounded-3xl px-4 py-3 text-sm leading-7 whitespace-pre-wrap break-words shadow-sm select-none ${
            isMine
              ? 'rounded-br-md bg-gradient-to-br from-slate-900 to-slate-800 text-white dark:from-slate-700 dark:to-slate-700'
              : 'rounded-bl-md border border-slate-200/90 bg-white/95 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'
          }`}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          onTouchMove={onTouchEnd}
        >
          {msg.text}
          {msg.edited && (
            <span className={`ml-1.5 text-[10px] italic ${isMine ? 'text-white/35' : 'text-slate-400'}`}>
              (edited)
            </span>
          )}

          {/* Link preview */}
          {msg.linkPreview && (
            <LinkPreview preview={msg.linkPreview} isMine={isMine} />
          )}
        </div>
      )}

      {/* ── Hover action buttons ─────────────────────────────────────── */}
      {!isEditing && (
        <div className={`absolute -top-3 flex items-center gap-1 rounded-full border border-slate-200 bg-white/95 px-1.5 py-1 shadow-lg shadow-slate-900/8 opacity-0 transition-all group-hover:opacity-100 dark:border-slate-700 dark:bg-slate-900/95 dark:shadow-black/20
          ${isMine ? 'left-2 group-hover:-translate-y-1' : 'right-2 group-hover:-translate-y-1'}`}
        >
          {/* Reply */}
          <button onClick={() => onReply?.(msg)} title="Reply"
            className="p-1 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
          </button>

          {/* React */}
          <button onClick={() => setShowPicker((s) => !s)} title="React"
            className="p-1 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-sm leading-none">
            🙂
          </button>

          {/* Edit — own messages only */}
          {isMine && (
            <button onClick={startEdit} title="Edit"
              className="p-1 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          )}

          {/* Delete — own messages only */}
          {isMine && (
            <button onClick={() => onDelete?.(msg.id)} title="Delete"
              className="p-1 rounded-full text-slate-400 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-500 transition-colors">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* ── Reaction picker ──────────────────────────────────────────── */}
      {showPicker && (
        <ReactionPicker
          alignRight={isMine}
          myCurrentEmoji={Object.keys(reactions).find((e) => reactions[e].mine) || null}
          onSelect={(emoji) => { onReact?.(msg.id, emoji); setShowPicker(false); }}
          onClose={() => setShowPicker(false)}
        />
      )}

      {/* ── Reaction bubbles ─────────────────────────────────────────── */}
      {reactionList.length > 0 && (
        <div className={`mt-1 flex flex-wrap gap-1.5 ${isMine ? 'justify-end' : 'justify-start'}`}>
          {reactionList.map(([emoji, r]) => {
            const count = (r.mine ? 1 : 0) + (r.peer ? 1 : 0);
            return (
              <button key={emoji} onClick={() => onReact?.(msg.id, emoji)}
                className={`flex items-center gap-0.5 rounded-full border px-2 py-1 text-xs shadow-sm transition-colors ${
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
