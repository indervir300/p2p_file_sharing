'use client';
import { motion } from 'framer-motion';

/**
 * Compact accessible on/off switch.
 * Renders as a real <button role="switch"> so keyboard + screen readers work.
 */
export default function Switch({ checked, onChange, label, description, id, size = 'md' }) {
  const dims = size === 'sm'
    ? { track: 'h-5 w-9', knob: 'h-3.5 w-3.5', travel: 16 }
    : { track: 'h-6 w-11', knob: 'h-4.5 w-4.5', travel: 20 };

  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      title={description || label}
      className={`relative inline-flex ${dims.track} shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors duration-300
        ${checked
          ? 'bg-gradient-brand shadow-[0_0_0_1px_rgba(var(--brand-primary-rgb),0.35),var(--shadow-glow)]'
          : 'bg-bg-tertiary ring-1 ring-inset ring-border-secondary dark:ring-border-primary'}`}
    >
      <motion.span
        animate={{ x: checked ? dims.travel : 0 }}
        transition={{ type: 'spring', stiffness: 520, damping: 34 }}
        className={`${dims.knob} rounded-full bg-white shadow-sm`}
      />
    </button>
  );
}
