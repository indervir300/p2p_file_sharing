'use client';

export default function ConnectionStatus({ wsState, encrypted }) {
  const wsLabel =
    wsState === 'connected' ? 'Online' :
    wsState === 'connecting' ? 'Connecting...' : 'Disconnected';

  const wsColor =
    wsState === 'connected' ? 'bg-brand-success' :
    wsState === 'connecting' ? 'bg-brand-warning animate-pulse' : 'bg-brand-danger';

  return (
    <div className="flex items-center justify-center gap-3 text-xs text-text-secondary flex-wrap">
      {/* WebSocket status */}
      <div className="flex items-center gap-2 rounded-full border border-border-secondary bg-bg-primary px-3 py-1.5">
        <span className={`w-2 h-2 rounded-full ${wsColor}`} />
        <span className="text-text-primary">{wsLabel}</span>
      </div>

      {/* Encryption status */}
      {encrypted && (
        <div className="flex items-center gap-1.5 rounded-full border border-brand-success/20 bg-brand-success/10 px-3 py-1.5 text-brand-success">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/>
          </svg>
          <span>End-to-End Encrypted</span>
        </div>
      )}
    </div>
  );
}
