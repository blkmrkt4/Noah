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
  title: "ARC — Attestation, Risk & Compliance",
  description:
    "EY's risk attestation system for technology products. Answer once, review in parallel.",
};

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
      <body className="min-h-full flex flex-col bg-ey-black text-white">
        <header className="border-b border-ey-dark-gray">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-ey-yellow font-bold text-2xl tracking-tight">
                EY
              </span>
              <span className="text-ey-light-gray text-sm font-medium tracking-wide uppercase">
                ARC
              </span>
            </div>
            <nav className="flex items-center gap-6 text-sm text-ey-light-gray">
              <a
                href="/"
                className="hover:text-ey-yellow transition-colors"
              >
                Dashboard
              </a>
              <a
                href="/projects"
                className="hover:text-ey-yellow transition-colors"
              >
                Projects
              </a>
              <a
                href="/corpus"
                className="hover:text-ey-yellow transition-colors"
              >
                Corpus
              </a>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
