'use client';
import { useRef, useEffect, useCallback, useState } from 'react';

export default function AudioVisualizer({ src, isMine }) {
  const canvasRef   = useRef(null);
  const audioRef    = useRef(null);
  const ctxRef      = useRef(null);
  const analyserRef = useRef(null);
  const rafRef      = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent]   = useState(0);

  // ── Build AudioContext once ─────────────────────────────────────────
  const buildContext = useCallback(() => {
    if (ctxRef.current) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    const ctx      = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize           = 256;
    analyser.smoothingTimeConstant = 0.8;

    const source = ctx.createMediaElementSource(audioRef.current);
    source.connect(analyser);
    analyser.connect(ctx.destination);

    ctxRef.current    = ctx;
    analyserRef.current = analyser;
  }, []);

  // ── Animation loop ─────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas  = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const ctx    = canvas.getContext('2d');
    const W      = canvas.width;
    const H      = canvas.height;
    const data   = new Uint8Array(analyser.frequencyBinCount);

    const render = () => {
      rafRef.current = requestAnimationFrame(render);
      analyser.getByteFrequencyData(data);

      ctx.clearRect(0, 0, W, H);

      const barCount = 40;
      const barW     = (W / barCount) - 1.5;
      const step     = Math.floor(data.length / barCount);
      // Use text colors for a themed look
      const isDark   = document.documentElement.classList.contains('dark');
      const lightCol = 'rgba(31,35,40,0.75)'; // GitHub light primary text
      const darkCol  = 'rgba(201,209,217,0.75)'; // GitHub dark primary text
      const color    = isMine ? 'rgba(255,255,255,0.8)' : (isDark ? darkCol : lightCol);

      for (let i = 0; i < barCount; i++) {
        const val    = data[i * step] / 255;
        const barH   = Math.max(3, val * H * 0.9);
        const x      = i * (barW + 1.5);
        const y      = (H - barH) / 2;
        const radius = barW / 2;

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect
          ? ctx.roundRect(x, y, barW, barH, radius)
          : ctx.rect(x, y, barW, barH);
        ctx.fill();
      }
    };

    render();
  }, [isMine]);

  const stopDraw = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    // Draw flat idle bars
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx    = canvas.getContext('2d');
    const W      = canvas.width;
    const H      = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const barCount = 40;
    const barW     = (W / barCount) - 1.5;
    const isDark   = document.documentElement.classList.contains('dark');
    const lightCol = 'rgba(31,35,40,0.2)';
    const darkCol  = 'rgba(201,209,217,0.2)';
    const color    = isMine ? 'rgba(255,255,255,0.3)' : (isDark ? darkCol : lightCol);

    for (let i = 0; i < barCount; i++) {
      const x      = i * (barW + 1.5);
      const barH   = 3;
      const y      = (H - barH) / 2;
      const radius = barW / 2;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect
        ? ctx.roundRect(x, y, barW, barH, radius)
        : ctx.rect(x, y, barW, barH);
      ctx.fill();
    }
  }, [isMine]);

  // Draw idle bars on mount
  useEffect(() => {
    stopDraw();
  }, [stopDraw]);

  // ── Playback controls ──────────────────────────────────────────────
  const toggle = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    buildContext();
    if (ctxRef.current?.state === 'suspended') await ctxRef.current.resume();

    if (audio.paused) {
      await audio.play();
      setPlaying(true);
      draw();
    } else {
      audio.pause();
      setPlaying(false);
      stopDraw();
    }
  }, [buildContext, draw, stopDraw]);

  const handleSeek = useCallback((e) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect  = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    audio.currentTime = ratio * duration;
  }, [duration]);

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  return (
    <div className="px-3 py-3 flex flex-col gap-2">
      {/* Hidden native audio */}
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        onTimeUpdate={() => setCurrent(audioRef.current?.currentTime || 0)}
        onEnded={() => { setPlaying(false); stopDraw(); }}
      />

      {/* Controls row */}
      <div className="flex items-center gap-2">

        {/* Play/Pause */}
        <button
          onClick={toggle}
          className={`shrink-0 flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
            isMine
              ? 'bg-white/20 hover:bg-white/30 text-white'
              : 'bg-brand-primary hover:bg-brand-primary-hover text-white'
          }`}
        >
          {playing ? (
            <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Visualizer canvas */}
        <div className="flex-1 relative">
          <canvas
            ref={canvasRef}
            width={180}
            height={36}
            className="w-full h-9 rounded-lg cursor-pointer"
            onClick={handleSeek}
          />
        </div>

        {/* Time */}
        <span className={`shrink-0 text-[10px] font-medium tabular-nums ${
          isMine ? 'text-white/60' : 'text-text-secondary dark:text-text-secondary'
        }`}>
          {formatTime(current)}/{formatTime(duration)}
        </span>
      </div>

      {/* Seek bar */}
      <div
        className={`h-1 rounded-full cursor-pointer overflow-hidden ${
          isMine ? 'bg-white/20' : 'bg-bg-tertiary'
        }`}
        onClick={handleSeek}
      >
        <div
          className={`h-full rounded-full transition-all ${
            isMine ? 'bg-white' : 'bg-brand-primary'
          }`}
          style={{ width: duration ? `${(current / duration) * 100}%` : '0%' }}
        />
      </div>
    </div>
  );
}
