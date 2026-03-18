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
  const blobUrlRef = useRef(null);
  const kind    = canPreview(msg);

  // Create object URL only if needed and not already provided
  const url = msg.previewUrl || (() => {
    if (msg.blob && !blobUrlRef.current) {
      blobUrlRef.current = URL.createObjectURL(msg.blob);
    }
    return blobUrlRef.current;
  })();

  // Cleanup object URL on unmount
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, []);

  // Load code text
  useEffect(() => {
    if (kind !== 'code' || !msg.blob) return;
    msg.blob.text().then((text) => {
      setCodeContent(text);
      const ext    = getExt(msg.name);
      const result = hljs.highlightAuto(text, hljs.getLanguage(ext) ? [ext] : undefined);
      setHighlighted(result.value);
    }).catch((err) => {
      console.error('Failed to read code content:', err);
      setCodeContent('Failed to load file content');
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
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 sm:p-8"
      onClick={onClose}
    >
      {/* Floating Controls */}
      <div className="absolute top-6 right-6 z-[70] flex items-center gap-3">
        {url && (
          <a
            href={url}
            download={msg.name}
            title="Download"
            className="group rounded-full bg-white/10 p-2.5 text-white/70 transition-all hover:bg-white/20 hover:scale-110 active:scale-95 backdrop-blur-xl border border-white/20 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M7 10l5 5m0 0l5-5m-5 5V3" />
            </svg>
          </a>
        )}
        <button
          onClick={onClose}
          title="Close"
          className="group rounded-full bg-white/10 p-2.5 text-white/70 transition-all hover:bg-white/20 hover:scale-110 active:scale-95 backdrop-blur-xl border border-white/20 shadow-xl"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div
        className="relative flex flex-col w-full max-w-5xl max-h-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Content */}
        <div className="flex-1 overflow-auto rounded-2xl">
          {/* PDF */}
          {kind === 'pdf' && url && (
            <div className="w-full h-full bg-white">
              <embed
                src={url}
                type="application/pdf"
                className="w-full h-[80vh]"
              />
            </div>
          )}

          {/* Image */}
          {kind === 'image' && url && (
            <div className="flex items-center justify-center min-h-[50vh]">
              <img
                src={url}
                alt={msg.name}
                className="max-w-full max-h-[85vh] object-contain rounded-xl select-none"
              />
            </div>
          )}

          {/* Video */}
          {kind === 'video' && url && (
            <div className="flex items-center justify-center min-h-[50vh]">
              <video
                src={url}
                controls
                autoPlay
                className="max-w-full max-h-[85vh] rounded-xl bg-black/40 shadow-2xl overflow-hidden"
              />
            </div>
          )}

          {/* Audio */}
          {kind === 'audio' && url && (
            <div className="flex flex-col items-center justify-center p-12 min-h-[30vh] bg-white/5 backdrop-blur-md rounded-3xl border border-white/10">
              <div className="mb-6 rounded-full bg-brand-primary/20 p-5 ring-1 ring-brand-primary/30">
                <svg className="h-8 w-8 text-brand-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
              </div>
              <p className="mb-8 text-lg font-medium text-white">{msg.name}</p>
              <audio src={url} controls autoPlay className="w-full max-w-sm h-10" />
            </div>
          )}

          {/* Code */}
          {kind === 'code' && (
            <div className="bg-[#0d1117] rounded-2xl border border-white/10 overflow-hidden">
               <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border-b border-white/10">
                  <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
                  <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
                  <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
                  <span className="ml-2 text-[11px] font-mono text-white/40 truncate">{msg.name}</span>
               </div>
              <pre className="p-6 text-sm leading-relaxed overflow-auto max-h-[75vh] font-mono scrollbar-thin scrollbar-thumb-white/10">
                {highlighted
                  ? <code
                      ref={codeRef}
                      className={`hljs language-${getExt(msg.name)}`}
                      dangerouslySetInnerHTML={{ __html: highlighted }}
                    />
                  : <code className="text-[#c9d1d9]">
                      {codeContent || 'Loading…'}
                    </code>
                }
              </pre>
            </div>
          )}

          {/* Office */}
          {kind === 'office' && officeViewerUrl && (
            <div className="flex flex-col items-center justify-center gap-6 p-12 min-h-[50vh] bg-white/5 backdrop-blur-md rounded-3xl border border-white/10 text-center">
              <div className="rounded-2xl bg-white/5 p-4">
                 <svg className="h-12 w-12 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                 </svg>
              </div>
              <div className="max-w-xs">
                 <h3 className="text-lg font-semibold text-white mb-1">{msg.name}</h3>
                 <p className="text-sm text-white/40">
                  Office documents are viewed using Microsoft's online viewer.
                 </p>
              </div>
              <a
                href={officeViewerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl bg-brand-primary px-8 py-3 text-sm font-semibold text-white hover:bg-brand-primary-hover active:scale-95 transition-all shadow-lg shadow-brand-primary/20"
              >
                Open Document ↗
              </a>
            </div>
          )}

          {/* Fallback — no URL yet */}
          {!url && (
            <div className="flex flex-col items-center justify-center p-12 min-h-[30vh] bg-white/5 backdrop-blur-md rounded-3xl border border-white/10">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-primary border-t-transparent mb-4" />
              <p className="text-sm text-white/60 font-medium">Preparing preview…</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
