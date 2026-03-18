export default function TypingIndicator() {
  return (
    <div className="flex justify-start py-1">
      <div className="flex items-center gap-2 rounded-3xl rounded-bl-md border border-border-secondary bg-bg-primary/95 px-4 py-3 shadow-sm dark:border-border-primary dark:bg-bg-secondary">
        <div className="flex items-center gap-1">
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              className="h-2 w-2 rounded-full bg-text-secondary animate-bounce"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </div>
        <span className="text-xs text-text-secondary">typing…</span>
      </div>
    </div>
  );
}
