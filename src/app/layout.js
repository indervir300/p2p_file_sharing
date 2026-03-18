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
  themeColor: '#0969da',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Runs before hydration — prevents flash of wrong theme */}
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
