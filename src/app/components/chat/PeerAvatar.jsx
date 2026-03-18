export default function PeerAvatar({ connectionType }) {
  const isRelay     = connectionType?.type === 'relay';
  const isConnected = !!connectionType;

  const dotColor = !isConnected
    ? 'bg-bg-tertiary'
    : isRelay
    ? 'bg-brand-warning'
    : 'bg-brand-success';

  return (
    <div className="relative shrink-0">
      {/* Avatar */}
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-bg-secondary dark:bg-bg-tertiary">
        <svg
          className="h-5 w-5 text-text-secondary"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
      </div>

      {/* Status dot — bottom right */}
      <span className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-bg-primary dark:border-bg-secondary ${dotColor}`} />
    </div>
  );
}
