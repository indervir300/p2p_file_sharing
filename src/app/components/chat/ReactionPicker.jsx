const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '👏', '🎉'];

export default function ReactionPicker({ onSelect, onClose, alignRight = false }) {
  return (
    <>
      {/* invisible backdrop to close picker on outside click */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      <div className={`absolute bottom-full mb-1.5 z-50 flex items-center gap-0.5
        rounded-2xl bg-white border border-slate-200 shadow-xl px-2 py-1.5
        ${alignRight ? 'right-0' : 'left-0'}`}
      >
        {EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => { onSelect(emoji); onClose(); }}
            className="text-lg p-1 rounded-lg hover:bg-slate-100 hover:scale-125 transition-all"
          >
            {emoji}
          </button>
        ))}
      </div>
    </>
  );
}
