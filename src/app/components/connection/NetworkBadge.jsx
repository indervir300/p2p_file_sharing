export default function NetworkBadge({ connectionType, rtt }) {
  if (!connectionType) return null;

  const isRelay = connectionType.type === 'relay';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
      isRelay
        ? 'bg-amber-100 text-amber-700'
        : 'bg-emerald-100 text-emerald-700'
    }`}>
      <span className={`h-1.5 w-1.5 rounded-full ${isRelay ? 'bg-amber-500' : 'bg-emerald-500'}`} />
      {isRelay
        ? 'Server Relay · WSS'
        : `Direct P2P · ${(connectionType.protocol || 'udp').toUpperCase()}${rtt != null ? ` · ${rtt}ms` : ''}`
      }
    </span>
  );
}
