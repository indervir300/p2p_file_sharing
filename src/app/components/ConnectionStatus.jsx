'use client';

export default function ConnectionStatus({ wsState, encrypted, connectionType }) {
  const wsLabel =
    wsState === 'connected' ? 'Server Connected' :
    wsState === 'connecting' ? 'Connecting...' : 'Disconnected';

  const wsColor =
    wsState === 'connected' ? 'bg-emerald-500' :
    wsState === 'connecting' ? 'bg-amber-500 animate-pulse' : 'bg-red-500';

  return (
    <div className="flex items-center justify-center gap-4 text-xs text-slate-400 flex-wrap">
      {/* WebSocket status */}
      <div className="flex items-center gap-1.5">
        <span className={`w-2 h-2 rounded-full ${wsColor}`} />
        <span>{wsLabel}</span>
      </div>

      {/* Encryption status */}
      {encrypted && (
        <div className="flex items-center gap-1.5 text-emerald-400">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/>
          </svg>
          <span>E2E Encrypted</span>
        </div>
      )}

      {/* Connection type */}
      {connectionType && (
        <div className="flex items-center gap-1.5">
          <span>{connectionType.relayed ? '🔄' : '⚡'}</span>
          <span>{connectionType.relayed ? 'Relayed' : 'Direct P2P'}</span>
        </div>
      )}
    </div>
  );
}
