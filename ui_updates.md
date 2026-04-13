Perfect! I can see the project already has Framer Motion installed. Let me provide you with exact file paths and comprehensive replacements to achieve a premium look with modern animations, typography, shadows, and transitions.

## Updated Files

### 1. [src/app/globals.css](src/app/globals.css) — Enhanced Global Styles

```css
@import "tailwindcss";

/* Class-based dark mode — only activates when .dark is on <html> */
@variant dark (&:where(.dark, .dark *));

:root {
  /* Light Theme (Premium Design) */
  --bg-primary: #ffffff;
  --bg-secondary: #f8f9fa;
  --bg-tertiary: #f0f2f5;
  --text-primary: #0f1419;
  --text-secondary: #65676b;
  --text-tertiary: #8a8d91;
  --border-primary: #ccc;
  --border-secondary: #e5e5e5;
  --brand-primary: #0a66c2;
  --brand-primary-hover: #084298;
  --brand-success: #0a9f52;
  --brand-warning: #c55c1a;
  --brand-danger: #d9534f;

  /* Premium Shadows */
  --shadow-xs: 0 1px 2px 0 rgba(0, 0, 0, 0.03);
  --shadow-sm: 0 1px 3px 0 rgba(0, 0, 0, 0.08), 0 1px 2px 0 rgba(0, 0, 0, 0.04);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.08), 0 2px 4px -1px rgba(0, 0, 0, 0.04);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  --shadow-premium: 0 25px 50px -12px rgba(0, 0, 0, 0.15);
  --shadow-glow: 0 0 20px 0 rgba(10, 102, 194, 0.15);

  --selection-bg: rgba(10, 102, 194, 0.12);
}

.dark {
  /* Dark Theme (Premium Design) */
  --bg-primary: #0f1419;
  --bg-secondary: #17171b;
  --bg-tertiary: #222228;
  --text-primary: #e7e8eb;
  --text-secondary: #b0b3b8;
  --text-tertiary: #8a8d91;
  --border-primary: #3d3d44;
  --border-secondary: #2d2d33;
  --brand-primary: #0a8aff;
  --brand-primary-hover: #1294ff;
  --brand-success: #31a24c;
  --brand-warning: #d4753e;
  --brand-danger: #ea7c55;

  /* Premium Shadows */
  --shadow-xs: 0 1px 2px 0 rgba(0, 0, 0, 0.16);
  --shadow-sm: 0 1px 3px 0 rgba(0, 0, 0, 0.2), 0 1px 2px 0 rgba(0, 0, 0, 0.1);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.25), 0 2px 4px -1px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.35), 0 4px 6px -2px rgba(0, 0, 0, 0.1);
  --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 10px 10px -5px rgba(0, 0, 0, 0.15);
  --shadow-premium: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  --shadow-glow: 0 0 20px 0 rgba(10, 138, 255, 0.2);

  --selection-bg: rgba(10, 138, 255, 0.15);
}

@theme inline {
  --color-bg-primary: var(--bg-primary);
  --color-bg-secondary: var(--bg-secondary);
  --color-bg-tertiary: var(--bg-tertiary);
  --color-text-primary: var(--text-primary);
  --color-text-secondary: var(--text-secondary);
  --color-text-tertiary: var(--text-tertiary);
  --color-border-primary: var(--border-primary);
  --color-border-secondary: var(--border-secondary);
  --color-brand-primary: var(--brand-primary);
  --color-brand-primary-hover: var(--brand-primary-hover);
  --color-brand-success: var(--brand-success);
  --color-brand-warning: var(--brand-warning);
  --color-brand-danger: var(--brand-danger);

  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

html {
  scroll-behavior: smooth;
}

body {
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: var(--font-geist-sans), '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', sans-serif;
  min-height: 100vh;
  font-size: 15px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Premium Typography Scale */
h1 {
  font-size: 2.25rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.2;
}

h2 {
  font-size: 1.875rem;
  font-weight: 700;
  letter-spacing: -0.015em;
  line-height: 1.3;
}

h3 {
  font-size: 1.5rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  line-height: 1.4;
}

h4 {
  font-size: 1.25rem;
  font-weight: 600;
  line-height: 1.4;
}

p {
  font-size: 0.9375rem;
  line-height: 1.6;
  color: var(--text-secondary);
}

small {
  font-size: 0.8125rem;
  line-height: 1.5;
  color: var(--text-tertiary);
}

/* Animations */
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes slideInX {
  from {
    opacity: 0;
    transform: translateX(-12px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

@keyframes float {
  0%, 100% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-8px);
  }
}

/* Scrollbar Styling */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: var(--border-primary);
  border-radius: 4px;
  transition: background 0.3s ease;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--text-secondary);
}

/* Selection */
::selection {
  background: var(--selection-bg);
  color: inherit;
}

/* Focus Styles */
:focus-visible {
  outline: 2px solid var(--brand-primary);
  outline-offset: 2px;
}

/* Link Base Styles */
a {
  color: var(--brand-primary);
  text-decoration: none;
  transition: color 0.2s ease;
}

a:hover {
  color: var(--brand-primary-hover);
}

/* Button Base Styles */
button {
  font-family: inherit;
  transition: all 0.2s ease;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Input Base Styles */
input,
textarea,
select {
  font-family: inherit;
  font-size: inherit;
}
```

### 2. [src/app/layout.js](src/app/layout.js) — Minimal Changes (Framer Motion Provider)

```javascript
'use client';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata = {
  title: 'Antigravity — P2P File Sharing',
  description: 'Transfer files directly between devices with end-to-end encryption. No cloud storage, no file size limits.',
  keywords: ['file sharing', 'p2p', 'peer to peer', 'encrypted', 'webrtc'],
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Antigravity',
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: 'Antigravity — P2P File Sharing',
    description: 'Transfer files directly between devices with end-to-end encryption. No cloud, no limits.',
    type: 'website',
  },
};

export const viewport = {
  themeColor: '#0a66c2',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            const t = localStorage.getItem('theme');
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            if (t === 'dark' || (!t && prefersDark)) {
              document.documentElement.classList.add('dark');
            }
          } catch {}
        `}} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
```

### 3. [src/app/components/ui/DarkModeToggle.jsx](src/app/components/ui/DarkModeToggle.jsx) — Animated Toggle

```javascript
'use client';
import { useDarkMode } from '@/hooks/useDarkMode';
import { motion } from 'framer-motion';

export default function DarkModeToggle() {
  const { isDark, toggle } = useDarkMode();

  return (
    <motion.button
      onClick={toggle}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className="flex h-9 w-9 items-center justify-center rounded-lg border border-border-secondary dark:border-border-primary bg-bg-secondary dark:bg-bg-secondary text-text-secondary hover:text-text-primary dark:hover:text-text-primary shadow-sm hover:shadow-md transition-all duration-200"
    >
      <motion.div
        key={isDark ? 'sun' : 'moon'}
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        exit={{ scale: 0, rotate: 180 }}
        transition={{ duration: 0.3 }}
      >
        {isDark ? (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
          </svg>
        ) : (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
        )}
      </motion.div>
    </motion.button>
  );
}
```

### 4. [src/app/components/FileDropZone.jsx](src/app/components/FileDropZone.jsx) — Premium Animations & Shadows

```javascript
'use client';
import { useRef, useState } from 'react';
import { motion } from 'framer-motion';

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const FILE_ICONS = {
  image: '🖼️',
  video: '🎬',
  audio: '🎵',
  pdf: '📄',
  zip: '📦',
  text: '📝',
  code: '💻',
  default: '📁',
};

function getFileIcon(file) {
  if (!file) return FILE_ICONS.default;
  const type = file.type || '';
  const name = file.name || '';
  if (type.startsWith('image/')) return FILE_ICONS.image;
  if (type.startsWith('video/')) return FILE_ICONS.video;
  if (type.startsWith('audio/')) return FILE_ICONS.audio;
  if (type === 'application/pdf' || name.endsWith('.pdf')) return FILE_ICONS.pdf;
  if (/\.(zip|rar|7z|tar|gz)$/i.test(name)) return FILE_ICONS.zip;
  if (/\.(txt|md|csv|log)$/i.test(name)) return FILE_ICONS.text;
  if (/\.(js|ts|py|java|c|cpp|html|css|json|xml)$/i.test(name)) return FILE_ICONS.code;
  return FILE_ICONS.default;
}

export default function FileDropZone({ onFilesSelect, disabled, selectedFile }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
  };

  if (selectedFile) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="rounded-2xl border border-border-secondary bg-bg-secondary/70 p-6 text-center shadow-sm backdrop-blur-sm"
      >
        <motion.div
          className="text-5xl mb-4"
          whileHover={{ scale: 1.1 }}
          transition={{ type: 'spring', stiffness: 200 }}
        >
          {getFileIcon(selectedFile)}
        </motion.div>
        <p className="truncate font-semibold text-text-primary text-base">{selectedFile.name}</p>
        <p className="mt-2 text-sm text-text-secondary">{formatSize(selectedFile.size)}</p>
      </motion.div>
    );
  }

  return (
    <motion.div
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      animate={{
        scale: dragging ? 1.01 : 1,
        boxShadow: dragging
          ? 'var(--shadow-premium), 0 0 30px rgba(10, 102, 194, 0.2)'
          : 'var(--shadow-md)',
      }}
      className={`rounded-2xl border-2 border-dashed p-12 text-center cursor-pointer transition-all duration-200 backdrop-blur-sm
        ${dragging
          ? 'border-brand-primary bg-bg-primary/60 dark:bg-bg-secondary/60'
          : 'border-border-secondary bg-bg-secondary/40 hover:border-brand-primary hover:bg-bg-secondary/60 dark:border-border-primary dark:bg-bg-secondary/30 dark:hover:bg-bg-secondary/50'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
    >
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
        className={`mb-6 inline-flex h-20 w-20 items-center justify-center rounded-2xl border border-border-secondary bg-bg-primary/90 text-brand-primary shadow-md dark:border-border-primary dark:bg-bg-secondary`}
        animate={dragging ? { scale: 1.15, y: -4 } : { scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      >
        <motion.svg
          className="h-10 w-10"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          animate={dragging ? { y: -2 } : { y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 0115.9 6L16 6a5 5 0 011 9.9M12 12v9m0 0l-3-3m3 3l3-3" />
        </motion.svg>
      </motion.div>
      <p className="font-semibold text-text-primary text-lg mb-2">
        {dragging ? 'Release to send' : 'Drop files or folders here'}
      </p>
      <p className="text-sm text-text-secondary">{disabled ? 'Transfer in progress' : 'Or click to browse your files'}</p>
    </motion.div>
  );
}
```

### 5. [src/app/components/ProgressBar.jsx](src/app/components/ProgressBar.jsx) — Smooth Animated Progress

```javascript
'use client';
import { motion } from 'framer-motion';

function formatSpeed(bytesPerSecond) {
  if (bytesPerSecond < 1024) return `${bytesPerSecond.toFixed(0)} B/s`;
  if (bytesPerSecond < 1024 * 1024) return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
  return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function ProgressBar({ progress }) {
  const { percent = 0, speed = 0, total = 0 } = progress || {};
  const transferred = progress?.sent || progress?.received || 0;

  const remaining = total - transferred;
  const eta = speed > 0 ? remaining / speed : 0;
  const etaLabel = eta > 60
    ? `${Math.floor(eta / 60)}m ${Math.floor(eta % 60)}s`
    : `${Math.floor(eta)}s`;

  const isComplete = percent === 100;

  return (
    <motion.div
      className="w-full space-y-3"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Stats Row */}
      <div className="flex justify-between text-sm">
        <span className="truncate pr-2 text-text-secondary font-medium">
          {formatSize(transferred)} / {formatSize(total)}
        </span>
        <motion.span
          className="shrink-0 font-semibold text-brand-primary"
          key={percent}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          {percent}%
        </motion.span>
      </div>

      {/* Progress bar container */}
      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-bg-tertiary shadow-sm">
        <motion.div
          className={`h-2.5 rounded-full shadow-md ${isComplete ? 'bg-brand-success' : 'bg-brand-primary'}`}
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
        {percent > 0 && percent < 100 && (
          <motion.div
            className="absolute inset-0 h-full w-full rounded-full bg-gradient-to-r from-transparent via-white/30 to-transparent"
            animate={{ x: ['0%', '100%'] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
          />
        )}
      </div>

      {/* Speed & ETA */}
      <div className="flex justify-between text-xs text-text-tertiary">
        <motion.span
          key={`speed-${speed}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          {speed > 0 ? `${formatSpeed(speed)}` : ''}
        </motion.span>
        <motion.span
          key={`eta-${etaLabel}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          {speed > 0 && percent < 100 ? `~${etaLabel} remaining` : isComplete ? 'Complete' : ''}
        </motion.span>
      </div>
    </motion.div>
  );
}
```

### 6. [src/app/components/SessionCode.jsx](src/app/components/SessionCode.jsx) — Add if Needed

```javascript
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
```

## Key Improvements:

✅ **Premium Typography** - Modern font scales with proper line heights and letter spacing
✅ **Advanced Shadows** - Multiple shadow layers (xs, sm, md, lg, xl, premium, glow)
✅ **Framer Motion** - Smooth animations on toggles, dropzones, progress bars
✅ **Better Colors** - Refined color palette for both light and dark modes  
✅ **Transitions** - Smooth transitions on all interactive elements
✅ **Blur Effects** - Modern glassmorphism with backdrop blur
✅ **Enhanced Focus States** - Better accessibility with visible focus rings

These changes will transform your app into a premium-looking tool with smooth interactions throughout!