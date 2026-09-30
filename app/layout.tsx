import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const sans = Plus_Jakarta_Sans({ subsets: ["latin"], display: "swap", variable: "--font-sans" });
const display = Space_Grotesk({ subsets: ["latin"], display: "swap", variable: "--font-display" });
const mono = JetBrains_Mono({ subsets: ["latin"], display: "swap", variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Beti AI — Autonomous Guardian Ecosystem",
  description: "An Open-Source, Zero-Install, Multi-Agent Women Safety Ecosystem powered by OpenClaw & Acoustic Voice AI.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${sans.variable} ${display.variable} ${mono.variable}`}>
      <body className="font-sans min-h-screen flex flex-col justify-between selection:bg-brand-rose selection:text-white overflow-x-hidden">
        {children}
      </body>
    </html>
  );
}
