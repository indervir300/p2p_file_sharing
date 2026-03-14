export default function TypingIndicator() {
  return (
    <div className="flex justify-start py-1">
      <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-3 shadow-sm">
        <div className="flex items-center gap-1">
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              className="h-2 w-2 rounded-full bg-slate-400 dark:bg-slate-500 animate-bounce"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </div>
        <span className="text-xs text-slate-400 dark:text-slate-500">typing…</span>
      </div>
    </div>
  );
}
