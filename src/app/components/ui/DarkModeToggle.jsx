'use client';
import { motion } from 'framer-motion';
import { Sun, Moon } from 'lucide-react';
import { useDarkMode } from '@/hooks/useDarkMode';

export default function DarkModeToggle() {
  const { isDark, toggle } = useDarkMode();

  return (
    <motion.button
      onClick={toggle}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.94 }}
      className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg border border-border-secondary bg-bg-primary/60 text-text-secondary transition-colors hover:text-brand-primary dark:border-border-primary dark:bg-bg-secondary/50"
    >
      <motion.span
        key={isDark ? 'sun' : 'moon'}
        initial={{ rotate: -90, opacity: 0.4 }}
        animate={{ rotate: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 22 }}
        className="flex items-center justify-center"
      >
        {isDark
          ? <Sun className="h-4 w-4" strokeWidth={2.1} />
          : <Moon className="h-4 w-4" strokeWidth={2.1} />}
      </motion.span>
    </motion.button>
  );
}
