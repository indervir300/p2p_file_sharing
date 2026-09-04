'use client';
import {
  FileImage, FileVideo, FileAudio, FileText, FileArchive, FileCode, File as FileIcon,
} from 'lucide-react';
import { fileKind } from '@/utils/format';

const GLYPHS = {
  image: { Icon: FileImage, tint: 'text-[#e0489f] bg-[#e0489f]/10 ring-[#e0489f]/15' },
  video: { Icon: FileVideo, tint: 'text-[#8b5cf6] bg-[#8b5cf6]/10 ring-[#8b5cf6]/15' },
  audio: { Icon: FileAudio, tint: 'text-[#f59e0b] bg-[#f59e0b]/10 ring-[#f59e0b]/15' },
  pdf: { Icon: FileText, tint: 'text-[#ef4444] bg-[#ef4444]/10 ring-[#ef4444]/15' },
  archive: { Icon: FileArchive, tint: 'text-[#0ea5e9] bg-[#0ea5e9]/10 ring-[#0ea5e9]/15' },
  text: { Icon: FileText, tint: 'text-[#14b8a6] bg-[#14b8a6]/10 ring-[#14b8a6]/15' },
  code: { Icon: FileCode, tint: 'text-[#22c55e] bg-[#22c55e]/10 ring-[#22c55e]/15' },
  file: { Icon: FileIcon, tint: 'text-text-secondary bg-bg-tertiary ring-border-secondary' },
};

const SIZES = {
  sm: { box: 'h-9 w-9 rounded-xl', icon: 'h-4 w-4' },
  md: { box: 'h-11 w-11 rounded-2xl', icon: 'h-5 w-5' },
  lg: { box: 'h-14 w-14 rounded-2xl', icon: 'h-6 w-6' },
};

/** Colour-coded file-type badge. */
export default function FileGlyph({ name, mimeType, size = 'md', className = '' }) {
  const { Icon, tint } = GLYPHS[fileKind(name, mimeType)] || GLYPHS.file;
  const dims = SIZES[size] || SIZES.md;

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center ring-1 ${dims.box} ${tint} ${className}`}
      aria-hidden="true"
    >
      <Icon className={dims.icon} strokeWidth={1.75} />
    </span>
  );
}
