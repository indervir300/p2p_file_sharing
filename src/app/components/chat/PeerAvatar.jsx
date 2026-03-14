export default function PeerAvatar({ connectionType }) {
  const isRelay     = connectionType?.type === 'relay';
  const isConnected = !!connectionType;

  const ringColor = !isConnected ? 'ring-slate-300 dark:ring-slate-600'
    : isRelay ? 'ring-amber-400'
    : 'ring-emerald-400';

  const pingColor = !isConnected ? '' : isRelay ? 'bg-amber-400' : 'bg-emerald-400';

  return (
    <div className="relative shrink-0">
      {isConnected && (
        <span className={`absolute inset-0 rounded-full ${pingColor} animate-ping opacity-50`} />
      )}
      <div className={`relative flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 ring-2 ${ringColor}`}>
        <svg className="h-5 w-5 text-slate-500 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      </div>
    </div>
  );
}
