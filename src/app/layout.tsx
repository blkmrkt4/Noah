import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import WorkspaceHeader from "@/components/WorkspaceHeader";
import { PersonaProvider } from "@/components/PersonaContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ART — Attestation, Risk & Technology",
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
      <body className="min-h-full flex bg-ey-black text-white">
        <PersonaProvider>
          <Sidebar />
          <div className="flex-1 min-w-0 flex flex-col">
            <WorkspaceHeader />
            <main className="flex-1 overflow-auto">{children}</main>
          </div>
        </PersonaProvider>
      </body>
    </html>
  );
}
