'use client';
import JSZip from 'jszip';

/**
 * Recursively read all File objects from a FileSystemDirectoryEntry.
 * Returns a flat array of { path: string, file: File }.
 */
function readDirectoryEntries(dirEntry, basePath = '') {
  return new Promise((resolve, reject) => {
    const reader = dirEntry.createReader();
    const allEntries = [];

    const readBatch = () => {
      reader.readEntries((entries) => {
        if (entries.length === 0) {
          // Done reading this directory; resolve all sub-entries
          const promises = allEntries.map((entry) => {
            const entryPath = basePath ? `${basePath}/${entry.name}` : entry.name;
            if (entry.isDirectory) {
              return readDirectoryEntries(entry, entryPath);
            } else {
              return new Promise((res, rej) => {
                entry.file((f) => res([{ path: entryPath, file: f }]), rej);
              });
            }
          });
          Promise.all(promises)
            .then((results) => resolve(results.flat()))
            .catch(reject);
        } else {
          allEntries.push(...entries);
          readBatch(); // ReadEntries only returns up to 100 at a time — keep reading
        }
      }, reject);
    };

    readBatch();
  });
}

/**
 * Given a FileSystemDirectoryEntry and a folder name, zip all contents
 * and return a File object named "<folderName>.zip".
 */
export async function zipFolderEntry(folderEntry, folderName) {
  const fileEntries = await readDirectoryEntries(folderEntry, '');
  const zip = new JSZip();

  for (const { path, file } of fileEntries) {
    const arrayBuffer = await file.arrayBuffer();
    zip.file(path, arrayBuffer);
  }

  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  return new File([blob], `${folderName}.zip`, { type: 'application/zip' });
}

/**
 * Parse a DataTransfer object and return:
 *   - plainFiles: File[] — regular files dropped
 *   - folderEntries: { name, entry }[] — folder entries that need zipping
 *
 * Falls back to dataTransfer.files if items API is unavailable.
 */
export function parseDataTransfer(dataTransfer) {
  const plainFiles = [];
  const folderEntries = [];

  if (dataTransfer.items && dataTransfer.items.length > 0) {
    for (const item of dataTransfer.items) {
      if (item.kind !== 'file') continue;
      const entry = item.webkitGetAsEntry?.();
      if (entry) {
        if (entry.isDirectory) {
          folderEntries.push({ name: entry.name, entry });
        } else {
          const f = item.getAsFile();
          if (f) plainFiles.push(f);
        }
      } else {
        // Fallback: no FileSystemEntry API
        const f = item.getAsFile();
        if (f) plainFiles.push(f);
      }
    }
  } else {
    // Fallback: dataTransfer.files
    plainFiles.push(...Array.from(dataTransfer.files || []));
  }

  return { plainFiles, folderEntries };
}
