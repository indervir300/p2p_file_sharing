import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "P2P FileShare — Encrypted Direct Transfer",
  description: "Transfer files directly between devices with end-to-end encryption. No cloud storage, no file size limits, no tracking. Free and open source peer-to-peer file sharing.",
  keywords: ["file sharing", "p2p", "peer to peer", "encrypted", "webrtc", "direct transfer"],
  openGraph: {
    title: "P2P FileShare — Encrypted Direct Transfer",
    description: "Transfer files directly between devices with end-to-end encryption. No cloud, no limits.",
    type: "website",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
