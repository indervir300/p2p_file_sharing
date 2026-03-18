'use client';
import { useEffect, useRef, useState } from 'react';
import hljs from 'highlight.js';

const CODE_EXTS = [
  'js','jsx','ts','tsx','py','java','c','cpp','cs','go','rs',
  'php','rb','swift','kt','html','css','scss','json','xml',
  'yaml','yml','sh','bash','sql','md',
];

const PDF_TYPES  = ['application/pdf'];
const CODE_TYPES = ['text/plain','text/html','text/css','text/javascript',
  'application/javascript','application/json','application/xml','text/xml',
  'application/x-sh','text/x-python','text/x-java-source',
];
const OFFICE_TYPES = [
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
];

function getExt(name = '') {
  return name.split('.').pop().toLowerCase();
}

function canPreview(msg) {
  const mime = msg.mimeType || '';
  const ext  = getExt(msg.name);
  if (PDF_TYPES.includes(mime))   return 'pdf';
  if (CODE_TYPES.includes(mime) || CODE_EXTS.includes(ext)) return 'code';
  if (OFFICE_TYPES.includes(mime)) return 'office';
  if (mime.startsWith('image/'))   return 'image';
  if (mime.startsWith('video/'))   return 'video';
  if (mime.startsWith('audio/'))   return 'audio';
  return null;
}

export { canPreview };

export default function FilePreviewModal({ msg, onClose }) {
  const [codeContent, setCodeContent] = useState('');
  const [highlighted, setHighlighted] = useState('');
  const codeRef = useRef(null);
  const kind    = canPreview(msg);
  const url     = msg.previewUrl || (msg.blob ? URL.createObjectURL(msg.blob) : null);

  // Load code text
  useEffect(() => {
    if (kind !== 'code' || !msg.blob) return;
    msg.blob.text().then((text) => {
      setCodeContent(text);
      const ext    = getExt(msg.name);
      const result = hljs.highlightAuto(text, hljs.getLanguage(ext) ? [ext] : undefined);
      setHighlighted(result.value);
    });
  }, [kind, msg.blob, msg.name]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const officeViewerUrl = url
    ? `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(url)}`
    : null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col w-full max-w-4xl max-h-[90vh] rounded-2xl overflow-hidden bg-bg-primary dark:bg-bg-secondary shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between shrink-0 px-4 py-3 border-b border-border-secondary dark:border-border-primary">
          <div className="min-w-0 flex-1 mr-4">
            <p className="truncate text-sm font-semibold text-text-primary dark:text-text-primary">
              {msg.name}
            </p>
            <p className="text-xs text-text-secondary dark:text-text-secondary mt-0.5 capitalize">
              {kind} preview
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {url && (
              <a
                href={url}
                download={msg.name}
                className="rounded-lg border border-border-primary dark:border-border-primary px-3 py-1.5 text-xs font-medium text-text-primary dark:text-text-primary hover:bg-bg-secondary dark:hover:bg-bg-tertiary transition-colors"
              >
                Download
              </a>
            )}
            <button
              onClick={onClose}
              className="rounded-full p-1.5 text-text-secondary hover:bg-bg-secondary dark:hover:bg-bg-tertiary transition-colors"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto bg-bg-secondary dark:bg-bg-tertiary">

          {/* PDF */}
          {kind === 'pdf' && url && (
            <embed
              src={url}
              type="application/pdf"
              className="w-full h-full min-h-[70vh]"
            />
          )}

          {/* Image */}
          {kind === 'image' && url && (
            <div className="flex items-center justify-center p-4 min-h-[50vh]">
              <img
                src={url}
                alt={msg.name}
                className="max-w-full max-h-[75vh] object-contain rounded-xl shadow"
              />
            </div>
          )}

          {/* Video */}
          {kind === 'video' && url && (
            <div className="flex items-center justify-center p-4 min-h-[50vh]">
              <video
                src={url}
                controls
                autoPlay
                className="max-w-full max-h-[75vh] rounded-xl shadow bg-black"
              />
            </div>
          )}

          {/* Audio */}
          {kind === 'audio' && url && (
            <div className="flex items-center justify-center p-8 min-h-[20vh]">
              <audio src={url} controls autoPlay className="w-full max-w-md" />
            </div>
          )}

          {/* Code */}
          {kind === 'code' && (
            <pre className="p-4 text-xs leading-relaxed overflow-auto min-h-[50vh]">
              {highlighted
                ? <code
                    ref={codeRef}
                    className={`hljs language-${getExt(msg.name)}`}
                    dangerouslySetInnerHTML={{ __html: highlighted }}
                  />
                : <code className="text-text-primary dark:text-text-primary">
                    {codeContent || 'Loading…'}
                  </code>
              }
            </pre>
          )}

          {/* Office */}
          {kind === 'office' && officeViewerUrl && (
            <div className="flex flex-col items-center justify-center gap-4 p-8 min-h-[50vh]">
              <p className="text-sm text-text-secondary dark:text-text-secondary">
                Office documents open in Microsoft's online viewer
              </p>
              <a
                href={officeViewerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl bg-brand-primary px-6 py-3 text-sm font-semibold text-white hover:bg-brand-primary-hover transition-colors"
              >
                Open in Office Viewer ↗
              </a>
            </div>
          )}

          {/* Fallback — no URL yet */}
          {!url && (
            <div className="flex items-center justify-center p-8 min-h-[20vh]">
              <p className="text-sm text-text-secondary">File not yet available for preview.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
