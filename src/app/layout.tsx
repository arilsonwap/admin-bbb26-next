import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Sidebar } from "../components/Sidebar";
import { KeyboardShortcuts } from "../components/KeyboardShortcuts";
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
  title: "Admin BBB26",
  description: "Editor completo para gerenciamento de dados do BBB26",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <KeyboardShortcuts />
        <Sidebar />
        <div className="lg:pl-72">
          {children}
        </div>
      </body>
    </html>
  );
}
