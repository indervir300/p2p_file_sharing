'use client';

/**
 * Crypto utilities for encrypted P2P file sharing.
 * Uses Web Crypto API (AES-256-GCM) — runs entirely in the browser.
 */

/** Generate a random AES-256-GCM key */
export async function generateKey() {
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    throw new Error('Web Crypto API not available');
  }
  return window.crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,      // extractable — needed for URL sharing
    ['encrypt', 'decrypt']
  );
}

/** Export a CryptoKey as a base64url string (URL-safe, no padding) */
export async function exportKey(key) {
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    throw new Error('Web Crypto API not available');
  }
  const raw = await window.crypto.subtle.exportKey('raw', key);
  return bufferToBase64url(new Uint8Array(raw));
}

/** Import a base64url string back to a CryptoKey */
export async function importKey(base64url) {
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    throw new Error('Web Crypto API not available');
  }
  const raw = base64urlToBuffer(base64url);
  return window.crypto.subtle.importKey(
    'raw',
    raw,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Derive a stable AES-256-GCM key from a shared secret string.
 * This removes the need to copy/paste raw key material between peers.
 */
export async function deriveKeyFromSecret(secret) {
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    throw new Error('Web Crypto API not available');
  }
  if (!secret || typeof secret !== 'string') {
    throw new Error('Missing shared secret');
  }

  const encoder = new TextEncoder();
  const normalizedSecret = secret.trim().toUpperCase();

  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    encoder.encode(normalizedSecret),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('p2p-fileshare-v1'),
      iterations: 150000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/** Encrypt an ArrayBuffer chunk → returns ArrayBuffer (IV prepended) */
export async function encryptChunk(key, data) {
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    throw new Error('Web Crypto API not available');
  }
  const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV
  const encrypted = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );
  // Prepend IV to ciphertext so receiver can extract it
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);
  return combined.buffer;
}

/** Decrypt an ArrayBuffer chunk (IV is prepended) → returns ArrayBuffer */
export async function decryptChunk(key, data) {
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    throw new Error('Web Crypto API not available');
  }
  const arr = new Uint8Array(data);
  const iv = arr.slice(0, 12);
  const ciphertext = arr.slice(12);
  return window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );
}

// ── URL-safe Base64 helpers ────────────────────────────────────────────

function bufferToBase64url(buffer) {
  let binary = '';
  for (const byte of buffer) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlToBuffer(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
