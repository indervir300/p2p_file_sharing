import React, { useEffect, useRef, useState, useCallback } from 'react';

/* ── tiny icon helpers ─────────────────────────────────────────────────── */
function IconMicOff() {
  return (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
  );
}
function IconMicOn() {
  return (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
    </svg>
  );
}
function IconCamOff() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3l18 18" />
    </svg>
  );
}
function IconCamOn() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );
}
function IconScreen() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}
function IconLeave() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  );
}

/* ── Avatar placeholder for no-video states ────────────────────────────── */
function AvatarPlaceholder({ label, size = 'lg' }) {
  const initials = label ? label.slice(0, 2).toUpperCase() : '?';
  const szMap = { lg: 'w-24 h-24 text-3xl', sm: 'w-12 h-12 text-base' };
  return (
    <div className={`${szMap[size]} rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-bold text-white shadow-xl`}>
      {initials}
    </div>
  );
}

/* ── Tooltip wrapper ───────────────────────────────────────────────────── */
function Tip({ label, children }) {
  return (
    <div className="relative group flex items-center justify-center">
      {children}
      <span className="pointer-events-none absolute bottom-full mb-2 whitespace-nowrap rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-medium text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
        {label}
      </span>
    </div>
  );
}

/* ── Control button ─────────────────────────────────────────────────────── */
function CtrlBtn({ onClick, active, danger, title, children, className = '' }) {
  const base = 'relative flex items-center justify-center w-11 h-11 rounded-full transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 active:scale-95';
  const color = danger
    ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/40 shadow-lg'
    : active
      ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/40 shadow-lg'
      : 'bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm border border-white/10';
  return (
    <Tip label={title}>
      <button onClick={onClick} className={`${base} ${color} ${className}`}>
        {children}
      </button>
    </Tip>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Main component
═══════════════════════════════════════════════════════════════════════ */
export default function MeetingPanel({
  isHost,
  meetingActive,
  localStream,
  remoteStream,
  onStartMeeting,
  mediaError,
  toggleAudio,
  toggleVideo,
  toggleScreenShare,
  isAudioMuted,
  isVideoOff,
  isScreenSharing,
  remoteAudioMuted,
  remoteVideoOff,
  onLeaveMeeting,
}) {
  const localVideoRef  = useRef(null);
  const remoteVideoRef = useRef(null);

  const [preJoinAudio, setPreJoinAudio] = useState(true);
  const [preJoinVideo, setPreJoinVideo] = useState(true);
  const [hasJoined,    setHasJoined]    = useState(false);
  const [showControls, setShowControls] = useState(true);
  const controlsTimerRef = useRef(null);

  /* ─ wire streams to <video> ─ */
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  /* ─ auto-hide controls on inactivity ─ */
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    clearTimeout(controlsTimerRef.current);
    if (hasJoined) {
      controlsTimerRef.current = setTimeout(() => setShowControls(false), 3500);
    }
  }, [hasJoined]);

  useEffect(() => {
    resetControlsTimer();
    return () => clearTimeout(controlsTimerRef.current);
  }, [hasJoined, resetControlsTimer]);

  const handleJoin = async () => {
    setHasJoined(true);
    await onStartMeeting({ audio: preJoinAudio, video: preJoinVideo });
  };

  /* ─ remote display label ─ */
  const remoteLabel = isHost ? 'Peer' : 'Host';

  /* ════════════════════════════════════════════════════════════════════
     PRE-JOIN SCREEN
  ════════════════════════════════════════════════════════════════════ */
  if (!hasJoined) {
    const canJoin = isHost || meetingActive;
    return (
      <div className="flex h-full w-full flex-col items-center justify-center bg-slate-950 text-white px-6 gap-8">

        {/* Waiting state for joiners */}
        {!canJoin && (
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="relative flex items-center justify-center w-20 h-20">
              <span className="absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-20 animate-ping" />
              <div className="relative w-16 h-16 rounded-full bg-blue-600/30 border border-blue-500/40 flex items-center justify-center">
                <svg className="w-7 h-7 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.653-.125-1.278-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.653.125-1.278.356-1.857m0 0a5.002 5.002 0 019.288 0" />
                </svg>
              </div>
            </div>
            <p className="text-slate-300 text-sm font-medium">Waiting for the host to start the meeting…</p>
          </div>
        )}

        {/* Join controls */}
        {canJoin && (
          <div className="w-full max-w-sm flex flex-col items-center gap-6">
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="w-16 h-16 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center mb-1">
                <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white">Ready to {isHost ? 'start' : 'join'}?</h2>
              <p className="text-sm text-slate-400">Configure your devices before entering</p>
            </div>

            {/* Device toggles */}
            <div className="w-full flex items-center justify-center gap-4 py-4 px-6 rounded-2xl bg-white/5 border border-white/10">
              <Tip label={preJoinAudio ? 'Mute mic' : 'Unmute mic'}>
                <button
                  onClick={() => setPreJoinAudio(p => !p)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all ${preJoinAudio ? 'bg-white/10 text-white hover:bg-white/15' : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'}`}
                >
                  {preJoinAudio ? <IconMicOn /> : <IconMicOff />}
                  <span className="text-[10px] font-medium">{preJoinAudio ? 'Mic On' : 'Mic Off'}</span>
                </button>
              </Tip>

              <Tip label={preJoinVideo ? 'Turn off camera' : 'Turn on camera'}>
                <button
                  onClick={() => setPreJoinVideo(p => !p)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all ${preJoinVideo ? 'bg-white/10 text-white hover:bg-white/15' : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'}`}
                >
                  {preJoinVideo ? <IconCamOn /> : <IconCamOff />}
                  <span className="text-[10px] font-medium">{preJoinVideo ? 'Cam On' : 'Cam Off'}</span>
                </button>
              </Tip>
            </div>

            {mediaError && (
              <p className="text-xs text-red-400 text-center bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">{mediaError}</p>
            )}

            <button
              onClick={handleJoin}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-base transition-all hover:shadow-lg hover:shadow-blue-500/30 active:scale-95"
            >
              {isHost ? '🎥 Start Meeting' : '🚀 Join Meeting'}
            </button>
          </div>
        )}
      </div>
    );
  }

  /* ════════════════════════════════════════════════════════════════════
     IN-MEETING SCREEN  –  Cinema layout
  ════════════════════════════════════════════════════════════════════ */
  return (
    <div
      className="relative flex h-full w-full flex-col bg-slate-950 overflow-hidden select-none"
      onMouseMove={resetControlsTimer}
      onClick={resetControlsTimer}
    >
      {/* ── REMOTE video (fills all available space) ───────────────── */}
      <div className="relative flex-1 bg-black overflow-hidden">

        {remoteStream ? (
          <>
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="absolute inset-0 w-full h-full object-contain"
            />

            {/* Camera-off overlay */}
            {remoteVideoOff && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 gap-4 z-10">
                <AvatarPlaceholder label={remoteLabel} size="lg" />
                <span className="text-slate-400 text-sm font-medium">
                  {remoteLabel}&apos;s camera is off
                </span>
              </div>
            )}

            {/* Screen-sharing badge */}
            {!remoteVideoOff && (
              <div className="absolute top-4 left-4 z-20 flex items-center gap-1.5 rounded-full bg-blue-600/80 backdrop-blur px-3 py-1 text-xs font-semibold text-white shadow-lg opacity-80 pointer-events-none">
                <IconScreen />
                <span className="hidden sm:inline">Screen sharing</span>
              </div>
            )}

            {/* Remote muted badge */}
            {remoteAudioMuted && (
              <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5 rounded-full bg-slate-900/80 backdrop-blur px-3 py-1 text-xs font-semibold text-red-400 shadow-lg border border-slate-700/50">
                <IconMicOff />
                <span className="hidden sm:inline">Muted</span>
              </div>
            )}
          </>
        ) : (
          /* Waiting for remote ─────────────────────────────────── */
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-5">
            <div className="relative flex items-center justify-center w-28 h-28">
              <span className="absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-10 animate-ping" />
              <span className="absolute inline-flex h-20 w-20 rounded-full bg-blue-400 opacity-10 animate-ping" style={{ animationDelay: '0.4s' }} />
              <AvatarPlaceholder label={remoteLabel} size="lg" />
            </div>
            <p className="text-slate-400 text-sm font-medium">
              Waiting for {remoteLabel} to join the meeting…
            </p>
          </div>
        )}

        {/* ── LOCAL video  –  floating PiP ─────────────────────── */}
        <div
          className="absolute bottom-6 right-4 z-30 rounded-2xl overflow-hidden border-2 border-white/10 shadow-2xl transition-shadow hover:shadow-blue-500/20 group"
          style={{ width: '180px', aspectRatio: '16/9' }}
        >
          {localStream ? (
            <>
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {isVideoOff && (
                <div className="absolute inset-0 bg-slate-800 flex items-center justify-center">
                  <AvatarPlaceholder label="Me" size="sm" />
                </div>
              )}
              {/* PiP label */}
              <div className="absolute bottom-1.5 left-2 text-[10px] text-white/60 font-semibold">You</div>
            </>
          ) : (
            <div className="absolute inset-0 bg-slate-800 flex items-center justify-center">
              <AvatarPlaceholder label="Me" size="sm" />
            </div>
          )}

          {/* Muted mic badge in PiP */}
          {isAudioMuted && (
            <div className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-red-500 flex items-center justify-center shadow">
              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </div>
          )}

          {/* Screen-sharing glow ring */}
          {isScreenSharing && (
            <div className="absolute inset-0 rounded-2xl border-2 border-blue-500 pointer-events-none animate-pulse" />
          )}
        </div>
      </div>

      {/* ── TOOLBAR ──────────────────────────────────────────────────── */}
      <div
        className={`shrink-0 flex items-center justify-center gap-3 py-4 px-6 bg-gradient-to-t from-slate-950 to-slate-900/80 backdrop-blur-xl border-t border-white/5 transition-all duration-300 ${hasJoined && !showControls ? 'opacity-0 pointer-events-none translate-y-2' : 'opacity-100 pointer-events-auto translate-y-0'}`}
      >
        {/* Screen-share indicator chip */}
        {isScreenSharing && (
          <div className="mr-2 flex items-center gap-1.5 rounded-full bg-blue-600/20 border border-blue-500/40 px-3 py-1 text-xs font-semibold text-blue-400">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse inline-block" />
            Sharing screen
          </div>
        )}

        <CtrlBtn
          onClick={toggleAudio}
          active={false}
          danger={isAudioMuted}
          title={isAudioMuted ? 'Unmute microphone' : 'Mute microphone'}
        >
          {isAudioMuted ? <IconMicOff /> : <IconMicOn />}
        </CtrlBtn>

        <CtrlBtn
          onClick={toggleVideo}
          active={false}
          danger={isVideoOff}
          title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
        >
          {isVideoOff ? <IconCamOff /> : <IconCamOn />}
        </CtrlBtn>

        <CtrlBtn
          onClick={toggleScreenShare}
          active={isScreenSharing}
          title={isScreenSharing ? 'Stop sharing screen' : 'Share your screen'}
        >
          <IconScreen />
        </CtrlBtn>

        {/* Spacer + Leave */}
        <div className="ml-4 pl-4 border-l border-white/10">
          <CtrlBtn
            onClick={onLeaveMeeting}
            danger
            title="Leave meeting"
          >
            <IconLeave />
          </CtrlBtn>
        </div>
      </div>
    </div>
  );
}
