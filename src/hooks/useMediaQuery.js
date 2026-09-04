'use client';
import { useEffect, useState } from 'react';

/**
 * Subscribes to a CSS media query. Starts `false` so server and first client
 * render agree, then settles on the real value after mount.
 */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(query);
    const apply = () => setMatches(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [query]);

  return matches;
}

/** True on phone-sized viewports (below Tailwind's `sm` breakpoint). */
export function useIsCompact() {
  return useMediaQuery('(max-width: 639px)');
}
