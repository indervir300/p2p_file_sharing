'use client';
import { useRef } from 'react';

export default function ChatInput({ onSendText, onFilesAttach, onTyping }) {
  const inputRef   = useRef(null);
  const fileRef    = useRef(null);
  const throttleRef = useRef(0);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const text = inputRef.current?.value.trim();
      if (text) {
        onSendText(text);
        inputRef.current.value = '';
      }
    }
  };

  const handleChange = () => {
    const now = Date.now();
    if (now - throttleRef.current > 1500) {
      throttleRef.current = now;
      onTyping?.();
    }
  };

  const handleSendClick = () => {
    const text = inputRef.current?.value.trim();
    if (text) {
      onSendText(text);
      inputRef.current.value = '';
    }
  };

  return (
    <div className="shrink-0 border-t border-slate-200 bg-white px-2 py-2 sm:px-4 sm:py-3">
      <div className="flex items-end gap-1.5 sm:gap-2">

        {/* Attach */}
        <button
          onClick={() => fileRef.current?.click()}
          title="Attach files"
          className="shrink-0 rounded-xl border border-slate-300 bg-white p-2 sm:p-2.5 text-slate-500 hover:bg-slate-100 transition-colors"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
        </button>
        <input ref={fileRef} type="file" multiple className="hidden"
          onChange={(e) => { onFilesAttach(Array.from(e.target.files || [])); e.target.value = ''; }}
        />

        {/* Text area */}
        <textarea
          ref={inputRef}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Message…"
          rows={1}
          className="flex-1 resize-none rounded-xl border border-slate-300 bg-white px-3 py-2 sm:px-4 sm:py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-400 transition-colors"
          style={{ maxHeight: '120px', overflowY: 'auto' }}
        />

        {/* Send */}
        <button
          onClick={handleSendClick}
          title="Send message"
          className="shrink-0 rounded-xl bg-slate-900 p-2 sm:p-2.5 text-white hover:bg-slate-700 transition-colors"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>
    </div>
  );
}
