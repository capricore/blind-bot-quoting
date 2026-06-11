import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Sidebar from "@/components/Sidebar";
import { db, getDraftQuote, getQuote } from "@/lib/db";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "BlindBots Trade Portal",
  description:
    "B2B quoting & pre-order pipeline for roller shades and drapery — factory-direct to retailers.",
};

// Every page reads live SQLite state; opt the whole tree out of static prerendering.
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  db();
  const draft = getDraftQuote();
  const draftCount = draft ? getQuote(draft.id)!.items.length : 0;

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <Sidebar draftCount={draftCount} />
        <main className="ml-60 min-h-screen">
          <div className="mx-auto max-w-6xl px-8 py-10">{children}</div>
        </main>
      </body>
    </html>
  );
}
