import type { Metadata, Viewport } from "next";
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

export const viewport: Viewport = {
  themeColor: '#020617',
};

export const metadata: Metadata = {
  title: "AromAI - Tu Sommelier de Fragancias",
  description: "Descubre y gestiona tu colección de perfumes con Inteligencia Artificial.",
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'AromAI',
  },
};

import Sidebar from "@/components/Sidebar";
import BottomNav from "@/components/BottomNav";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex bg-slate-950 text-slate-50 relative pb-20 md:pb-0">
        <Sidebar />
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
        <BottomNav />
      </body>
    </html>
  );
}
