'use client';
import { motion } from 'framer-motion';

export default function SessionCode({ code, onCopy }) {
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    onCopy?.();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-xl border border-border-secondary bg-bg-secondary/60 p-4 backdrop-blur-sm shadow-sm"
    >
      <p className="text-xs uppercase tracking-wide text-text-tertiary mb-2">Session Code</p>
      <div className="flex items-center gap-3">
        <code className="flex-1 font-mono text-lg font-semibold text-brand-primary tracking-widest">
          {code}
        </code>
        <motion.button
          onClick={handleCopy}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="rounded-lg bg-brand-primary/10 px-3 py-2 text-sm font-medium text-brand-primary hover:bg-brand-primary/20 transition-colors"
        >
          Copy
        </motion.button>
      </div>
    </motion.div>
  );
}