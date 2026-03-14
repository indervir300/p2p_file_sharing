const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '👏', '🎉'];

export default function ReactionPicker({ onSelect, onClose, alignRight = false, myCurrentEmoji = null }) {
  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      <div className={`absolute bottom-full mb-1.5 z-50 flex items-center gap-0.5
        rounded-2xl bg-white border border-slate-200 shadow-xl px-2 py-1.5
        ${alignRight ? 'right-0' : 'left-0'}`}
      >
        {EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => onSelect(emoji)}
            className={`text-lg p-1 rounded-lg transition-all hover:scale-125 ${
              myCurrentEmoji === emoji
                ? 'bg-indigo-100 scale-110'
                : 'hover:bg-slate-100'
            }`}
            title={myCurrentEmoji === emoji ? 'Remove reaction' : emoji}
          >
            {emoji}
          </button>
        ))}
      </div>
    </>
  );
}
