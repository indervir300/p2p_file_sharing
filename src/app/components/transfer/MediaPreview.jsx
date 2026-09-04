'use client';
import { useEffect, useState } from 'react';

/** Inline preview for image / video / audio blobs. Returns null for anything else. */
export default function MediaPreview({ blob, mimeType, name }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    if (!blob) return;
    const objUrl = URL.createObjectURL(blob);
    setUrl(objUrl);
    return () => URL.revokeObjectURL(objUrl);
  }, [blob]);

  if (!url || !mimeType) return null;

  if (mimeType.startsWith('image/')) {
    return (
      <div className="overflow-hidden rounded-xl border border-border-secondary bg-bg-tertiary/50 dark:border-border-primary">
        <img
          src={url}
          alt={name}
          loading="lazy"
          onDragStart={(e) => e.preventDefault()}
          className="h-auto max-h-52 w-full object-cover"
        />
      </div>
    );
  }

  if (mimeType.startsWith('video/')) {
    return (
      <div className="overflow-hidden rounded-xl border border-border-secondary bg-black dark:border-border-primary">
        <video src={url} controls className="h-auto max-h-52 w-full" />
      </div>
    );
  }

  if (mimeType.startsWith('audio/')) {
    return (
      <div className="rounded-xl border border-border-secondary bg-bg-tertiary/60 px-3 py-2 dark:border-border-primary">
        <audio src={url} controls className="h-9 w-full" />
      </div>
    );
  }

  return null;
}
