'use client';
import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { UploadCloud, FolderUp, ShieldCheck, Infinity as InfinityIcon } from 'lucide-react';

const HINTS = [
  { Icon: ShieldCheck, label: 'End-to-end encrypted' },
  { Icon: InfinityIcon, label: 'No size limit' },
  { Icon: FolderUp, label: 'Folders auto-zipped' },
];

/**
 * Primary drop target. The actual drop parsing happens on the page (folders vs files),
 * this component owns the visual state and the file picker.
 */
export default function FileDropZone({ onFilesSelect, disabled, compact = false }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);
  const depth = useRef(0);

  const handleDragEnter = (e) => {
    if (disabled) return;
    if (!Array.from(e.dataTransfer?.types || []).includes('Files')) return;
    depth.current += 1;
    setDragging(true);
  };

  const handleDragLeave = () => {
    depth.current = Math.max(0, depth.current - 1);
    if (depth.current === 0) setDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    depth.current = 0;
    setDragging(false);
  };

  return (
    <motion.div
      onDragEnter={handleDragEnter}
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click(); }
      }}
      animate={{ scale: dragging ? 1.008 : 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={`group relative isolate cursor-pointer overflow-hidden rounded-3xl text-center transition-colors duration-200
        ${compact ? 'px-6 py-8' : 'px-6 py-12 sm:py-14'}
        ${dragging
          ? 'bg-brand-primary/[0.07]'
          : 'bg-bg-primary/60 hover:bg-bg-primary/80 dark:bg-bg-secondary/40 dark:hover:bg-bg-secondary/60'}
        ${disabled ? 'pointer-events-none opacity-50' : ''}`}
      style={{ boxShadow: dragging ? 'var(--shadow-glow), var(--shadow-lg)' : 'var(--shadow-sm)' }}
    >
      {/* dashed border drawn as an overlay so it can animate colour independently */}
      <span
        className={`pointer-events-none absolute inset-0 -z-10 rounded-3xl border-2 border-dashed transition-colors duration-200
          ${dragging
            ? 'border-brand-primary'
            : 'border-border-primary/70 group-hover:border-brand-primary/50 dark:border-border-primary'}`}
      />

      {/* soft radial wash on hover / drag */}
      <span
        className={`pointer-events-none absolute inset-0 -z-10 opacity-0 transition-opacity duration-300 ${dragging ? 'opacity-100' : 'group-hover:opacity-60'}`}
        style={{ background: 'radial-gradient(50% 70% at 50% 0%, rgba(var(--brand-primary-rgb),0.14), transparent 70%)' }}
      />

      <input
        ref={inputRef}
        type="file"
        multiple
        disabled={disabled}
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          if (files.length > 0) onFilesSelect(files);
          e.target.value = '';
        }}
      />

      <motion.div
        animate={dragging ? { y: -6, scale: 1.08 } : { y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 18 }}
        className={`relative mx-auto mb-5 flex items-center justify-center rounded-2xl text-white shadow-lg
          ${compact ? 'h-14 w-14' : 'h-16 w-16'} bg-gradient-brand`}
        style={{ boxShadow: 'var(--shadow-glow)' }}
      >
        <UploadCloud className={compact ? 'h-6 w-6' : 'h-7 w-7'} strokeWidth={1.8} />
        {dragging && (
          <span className="absolute inset-0 -z-10 animate-ping rounded-2xl bg-brand-primary/40" />
        )}
      </motion.div>

      <p className={`font-bold tracking-tight text-text-primary ${compact ? 'text-base' : 'text-lg'}`}>
        {dragging ? 'Release to beam it over' : 'Drop files or folders'}
      </p>
      <p className="mt-1 text-sm text-text-secondary">
        {disabled ? 'Transfer in progress…' : (
          <>or <span className="font-semibold text-brand-primary underline-offset-2 group-hover:underline">browse your device</span></>
        )}
      </p>

      {!compact && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {HINTS.map(({ Icon, label }) => (
            <span
              key={label}
              className="inline-flex items-center gap-1.5 rounded-full border border-border-secondary bg-bg-primary/70 px-2.5 py-1 text-[11px] font-medium text-text-secondary dark:border-border-primary dark:bg-bg-secondary/60"
            >
              <Icon className="h-3 w-3 text-brand-primary" strokeWidth={2.2} />
              {label}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
}
