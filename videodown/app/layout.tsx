import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "VideoDown — Download Videos Without Watermark",
  description:
    "Download videos from TikTok, Threads, Facebook, and Twitter/X without watermark. Fast, free, and easy to use.",
  keywords: [
    "download video",
    "tiktok downloader",
    "facebook downloader",
    "twitter downloader",
    "threads downloader",
    "no watermark",
    "free video downloader",
  ],
  openGraph: {
    title: "VideoDown — Download Videos Without Watermark",
    description:
      "Download videos from TikTok, Threads, Facebook, and Twitter/X without watermark.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#0a0a0a] text-white min-h-screen`}
      >
        {children}
      </body>
    </html>
  );
}
