import React, { useMemo } from 'react';

const DiscoveryRadar = ({ peers = [], onConnect, nickname = 'You' }) => {
  // Generate random stable positions for peers if they don't have them
  const peersWithPositions = useMemo(() => {
    return peers.map((peer, index) => {
      // Use index and id hash to create a somewhat stable but "random" orbit
      const angle = (index * (360 / Math.max(peers.length, 1))) + (parseInt(peer.id.slice(0, 2), 16) % 20);
      const distance = 35 + (parseInt(peer.id.slice(-2), 16) % 45); // distance from center in %
      return { ...peer, angle, distance };
    });
  }, [peers]);

  return (
    <div className="relative flex flex-col items-center justify-center p-8">
      {/* Radar Container */}
      <div className="relative h-64 w-64 rounded-full border border-border-secondary bg-bg-secondary/30 backdrop-blur-sm sm:h-80 sm:w-80 lg:h-96 lg:w-96">
        
        {/* Radar Sweep Animation */}
        <div className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,transparent_0deg,var(--brand-primary)_15deg,transparent_16deg)] opacity-10 animate-[spin_4s_linear_infinite]" />
        
        {/* Radar Grid Circles */}
        <div className="absolute inset-[25%] rounded-full border border-border-secondary/30" />
        <div className="absolute inset-[50%] rounded-full border border-border-secondary/30" />
        <div className="absolute inset-[75%] rounded-full border border-border-secondary/30" />

        {/* Center Point (You) */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
          <div className="relative flex flex-col items-center">
            <div className="h-4 w-4 rounded-full bg-brand-primary shadow-[0_0_15px_rgba(var(--brand-primary-rgb),0.5)] animate-pulse" />
            <span className="mt-2 whitespace-nowrap text-xs font-bold text-text-primary bg-bg-primary/80 px-2 py-0.5 rounded-full border border-border-secondary">
              {nickname} (You)
            </span>
          </div>
        </div>

        {/* Peer Points */}
        {peersWithPositions.map((peer) => (
          <div
            key={peer.id}
            className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 transition-all duration-1000 ease-in-out"
            style={{
              transform: `translate(-50%, -50%) rotate(${peer.angle}deg) translateY(-${peer.distance}%) rotate(-${peer.angle}deg)`,
            }}
          >
            <button
              onClick={() => onConnect(peer)}
              className="group relative flex flex-col items-center"
            >
              {/* Peer Dot */}
              <div className="h-3 w-3 rounded-full bg-brand-success shadow-[0_0_10px_rgba(var(--brand-success-rgb),0.4)] transition-transform group-hover:scale-125" />
              
              {/* Peer Label */}
              <div className="mt-2 scale-90 opacity-80 transition-all group-hover:scale-100 group-hover:opacity-100">
                <span className="whitespace-nowrap text-[10px] font-medium text-text-secondary bg-bg-primary/60 px-2 py-0.5 rounded-full border border-border-secondary backdrop-blur-sm group-hover:text-text-primary group-hover:border-brand-primary">
                  {peer.nickname}
                </span>
              </div>

              {/* Ping Ring Animation */}
              <div className="absolute top-1.5 left-1.5 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-brand-success animate-ping opacity-40 pointer-events-none" />
            </button>
          </div>
        ))}

        {peers.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-xs text-text-secondary animate-pulse px-8 text-center italic">
              Searching for peers... <br/>
              Make sure your friends are on the website.
            </p>
          </div>
        )}
      </div>

      <div className="mt-8 text-center">
        <h3 className="text-lg font-semibold text-text-primary">Discovery Radar</h3>
        <p className="text-sm text-text-secondary mt-1 max-w-xs mx-auto">
          You are visible to others. Click on a peer to start a fast file-sharing session.
        </p>
      </div>
    </div>
  );
};

export default DiscoveryRadar;
