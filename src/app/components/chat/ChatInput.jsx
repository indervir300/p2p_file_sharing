'use client';
import { useRef } from 'react';

export default function ChatInput({ onSendText, onFilesAttach, onTyping, replyingTo, onCancelReply }) {
  const inputRef    = useRef(null);
  const fileRef     = useRef(null);
  const throttleRef = useRef(0);

  const send = () => {
    const text = inputRef.current?.value.trim();
    if (!text) return;
    onSendText(text);
    inputRef.current.value = '';
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    if (e.key === 'Escape' && replyingTo)  onCancelReply?.();
  };

  const handleChange = () => {
    const now = Date.now();
    if (now - throttleRef.current > 1500) {
      throttleRef.current = now;
      onTyping?.();
    }
  };

  return (
    <div className="shrink-0">

      {/* ── Replying-to banner ─────────────────────────────────────── */}
      {replyingTo && (
        <div className="mb-3 flex items-center gap-3 rounded-2xl bg-transparent px-3 py-2.5">
          <div className="w-1 self-stretch rounded-full bg-brand-primary shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-text-secondary">
              Replying to {replyingTo.sender === 'me' ? 'yourself' : 'Peer'}
            </p>
            <p className="truncate text-xs text-text-secondary dark:text-text-secondary">
              {replyingTo.type === 'file' ? `📎 ${replyingTo.name}` : replyingTo.text}
            </p>
          </div>
          <button
            onClick={onCancelReply}
            className="shrink-0 rounded-full p-1 text-text-secondary hover:bg-bg-secondary dark:hover:bg-bg-tertiary transition-colors"
            title="Cancel reply"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* ── Input row ─────────────────────────────────────────────── */}
      <div className="flex items-end gap-2 rounded-[28px] border border-border-secondary p-1.5 shadow-sm dark:border-border-primary dark:bg-bg-secondary/60 sm:gap-3 sm:p-2">

        <button
          onClick={() => fileRef.current?.click()}
          title="Attach files"
          className="shrink-0 rounded-2xl p-2.5 text-text-secondary transition-colors hover:bg-bg-secondary dark:bg-bg-tertiary/70 dark:text-text-secondary dark:hover:bg-bg-tertiary sm:p-3"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
        </button>
        <input ref={fileRef} type="file" multiple className="hidden"
          onChange={(e) => { onFilesAttach(Array.from(e.target.files || [])); e.target.value = ''; }}
        />

        <textarea
          ref={inputRef}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={replyingTo ? 'Write a reply…' : 'Message…'}
          rows={1}
          className="min-h-12 flex-1 resize-none rounded-2xl border border-transparent bg-transparent px-2 py-2.5 text-sm leading-6 text-text-primary placeholder-text-secondary/50 outline-none transition-colors focus:border-border-secondary dark:text-text-primary dark:placeholder-text-secondary/50 dark:focus:border-border-primary sm:px-3"
          style={{ maxHeight: '120px', overflowY: 'auto' }}
        />

        <button
          onClick={send}
          title="Send"
          className="shrink-0 rounded-2xl bg-brand-primary p-2.5 text-white shadow-lg shadow-brand-primary/25 transition-transform hover:scale-[1.03] hover:bg-brand-primary-hover active:scale-[0.98] sm:p-3"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>

      </div>
    </div>
  );
}
