import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata = {
  title: 'Vault Drop — Encrypted P2P File Transfer',
  description: 'Transfer files directly between devices with end-to-end encryption. No cloud storage, no file size limits.',
  keywords: ['file sharing', 'p2p', 'peer to peer', 'encrypted', 'secure file transfer', 'webrtc'],
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Vault Drop',
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: 'Vault Drop — Encrypted P2P File Transfer',
    description: 'Transfer files directly between devices with end-to-end encryption. No cloud, no limits.',
    type: 'website',
  },
};

export const viewport = {
  themeColor: '#4f46e5',
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