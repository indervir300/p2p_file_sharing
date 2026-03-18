import React, { useMemo } from 'react';

const DiscoveryNetwork = ({ peers = [], onConnect, nickname = 'You' }) => {
  // Helper to safely parse hex from id
  const safeParseHex = (id, start, end) => {
    if (!id || typeof id !== 'string' || id.length < end) return 0;
    const parsed = parseInt(id.slice(start, end), 16);
    return isNaN(parsed) ? 0 : parsed;
  };

  // Generate random stable positions for peers in a circular layout
  const peersWithPositions = useMemo(() => {
    return peers.map((peer, index) => {
      // Calculate angle ensuring even spacing, plus a little deterministic jitter
      const baseAngle = (index * (360 / Math.max(peers.length, 1)));
      const jitter = (safeParseHex(peer.id, 0, 2) % 30) - 15;
      const angle = baseAngle + jitter;

      // Distance from center (radius)
      // Vary radius between 40% and 48%
      const distance = 40 + (safeParseHex(peer.id, -2, peer.id?.length) % 8);

      const rad = (angle - 90) * (Math.PI / 180); // -90 to start from top
      const x = 50 + (distance * Math.cos(rad));
      const y = 50 + (distance * Math.sin(rad));

      return { ...peer, angle, distance, x, y };
    });
  }, [peers]);

  // Helper to generate a deterministic avatar URL based on nickname/id
  const getAvatarUrl = (seed) => {
    // using lorelei style from dicebear for a modern look
    return `https://api.dicebear.com/7.x/lorelei/svg?seed=${encodeURIComponent(seed)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffdfbf,ffd5dc`;
  };

  return (
    <div className="relative flex flex-col items-center justify-center p-4 sm:p-6 w-full flex-1 min-h-0">
      {/* Network Container */}
      <div className="relative h-full w-full max-h-[60vh] sm:max-h-[70vh] lg:max-h-[75vh] aspect-square flex items-center justify-center">
        
        {/* Connection Lines (SVG) */}
        <svg className="absolute inset-0 h-full w-full pointer-events-none" style={{ filter: 'drop-shadow(0 0 4px rgba(var(--brand-primary-rgb), 0.3))' }}>
          <defs>
            <linearGradient id="line-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--brand-primary)" stopOpacity="0.6" />
              <stop offset="100%" stopColor="var(--brand-success)" stopOpacity="0.2" />
            </linearGradient>
            <linearGradient id="line-gradient-hover" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--brand-primary)" stopOpacity="1" />
              <stop offset="100%" stopColor="var(--brand-success)" stopOpacity="0.8" />
            </linearGradient>
          </defs>
          
          {peersWithPositions.map((peer) => {
            return (
              <line
                key={`line-${peer.id}`}
                x1="50%"
                y1="50%"
                x2={`${peer.x}%`}
                y2={`${peer.y}%`}
                stroke="url(#line-gradient)"
                strokeWidth="1.5"
                strokeDasharray="4 4"
                className="transition-all duration-700 ease-in-out opacity-60"
              />
            );
          })}
        </svg>

        {/* Center Point (You) */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
          <div className="relative flex flex-col items-center group">
            {/* Hexagon/Circle glow backdrop */}
            <div className="absolute inset-0 rounded-full bg-brand-primary/20 blur-xl scale-150 animate-pulse pointer-events-none" />
            
            {/* Avatar */}
            <div className="relative h-16 w-16 rounded-2xl overflow-hidden border-2 border-brand-primary shadow-[0_0_20px_rgba(var(--brand-primary-rgb),0.4)] bg-bg-primary transition-transform duration-300 group-hover:scale-105">
              <img src={getAvatarUrl(nickname)} alt="Your Avatar" className="w-full h-full object-cover" />
            </div>
            
            {/* Label */}
            <div className="absolute -bottom-6 w-max opacity-90 transition-opacity group-hover:opacity-100">
               <span className="whitespace-nowrap text-xs font-bold text-text-primary bg-bg-secondary/90 px-3 py-1 rounded-lg border border-border-secondary shadow-lg backdrop-blur-md">
                {nickname} (You)
              </span>
            </div>
            
            {/* Active Ping */}
            <div className="absolute top-1/2 left-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-2xl border-2 border-brand-primary animate-ping opacity-30 pointer-events-none" />
          </div>
        </div>

        {/* Peer Nodes */}
        {peersWithPositions.map((peer) => {
          const delay = safeParseHex(peer.id, -1, peer.id?.length) % 3; // 0, 1, or 2 seconds
          
          return (
            <div
              key={peer.id}
              className="absolute transition-all duration-1000 ease-in-out z-10"
              style={{
                left: `${peer.x}%`,
                top: `${peer.y}%`,
                transform: `translate(-50%, -50%)`,
              }}
            >
              <button
                onClick={() => onConnect(peer)}
                className="group relative flex flex-col items-center"
                style={{ animationDelay: `${delay}s` }}
              >
                {/* Node Glow on Hover */}
                <div className="absolute inset-0 rounded-full bg-brand-success/0 group-hover:bg-brand-success/30 blur-md transition-colors duration-300 pointer-events-none scale-150" />

                {/* Peer Avatar */}
                <div className="relative h-12 w-12 rounded-full overflow-hidden border-2 border-border-secondary group-hover:border-brand-success shadow-md group-hover:shadow-[0_0_15px_rgba(var(--brand-success-rgb),0.5)] bg-bg-tertiary transition-all duration-300 group-hover:scale-110">
                  <img src={getAvatarUrl(peer.nickname)} alt={`${peer.nickname} Avatar`} className="w-full h-full object-cover" />
                </div>
                
                {/* Peer Label */}
                <div className="absolute -bottom-7 scale-95 opacity-80 transition-all duration-300 group-hover:scale-100 group-hover:opacity-100 group-hover:-bottom-8">
                  <span className="whitespace-nowrap text-xs font-medium text-text-primary bg-bg-secondary/80 px-3 py-1 rounded-full border border-border-secondary backdrop-blur-md group-hover:border-brand-success shadow-lg">
                    {peer.nickname}
                  </span>
                </div>
              </button>
            </div>
          );
        })}

        {/* Empty State */}
        {peers.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none mix-blend-screen">
            <div className="absolute h-full w-full rounded-full border-[0.5px] border-border-secondary/20 border-dashed animate-[spin_20s_linear_infinite]" />
            <div className="absolute h-3/4 w-3/4 rounded-full border-[0.5px] border-border-secondary/30 border-dashed animate-[spin_15s_linear_infinite_reverse]" />
            
            <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-text-secondary animate-pulse text-center whitespace-nowrap">
              Waiting for peers to join the network...
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DiscoveryNetwork;
