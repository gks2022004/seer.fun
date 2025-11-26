import type { Metadata } from "next";
import { VT323, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Retro terminal font for headers and display text
const vt323 = VT323({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-vt323",
  display: "swap",
});

// Modern monospace for data and code
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Seer.fun | Prediction Markets on Solana Blinks",
  description: "Bet on the future. Directly from Twitter/X. Powered by Solana Actions.",
  keywords: ["prediction market", "solana", "blinks", "crypto", "betting", "web3"],
  authors: [{ name: "Seer.fun" }],
  openGraph: {
    title: "Seer.fun | Prediction Markets on Solana Blinks",
    description: "Bet on the future. Directly from Twitter/X. Powered by Solana Actions.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Seer.fun | Prediction Markets on Solana Blinks",
    description: "Bet on the future. Directly from Twitter/X. Powered by Solana Actions.",
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
        className={`${vt323.variable} ${jetbrainsMono.variable} font-mono bg-void text-matrix antialiased`}
      >
        {/* Subtle static scanline overlay - no animation for performance */}
        <div className="crt-overlay-static pointer-events-none fixed inset-0 z-50" />
        
        {/* Main content */}
        <div className="min-h-screen">
          {children}
        </div>
      </body>
    </html>
  );
}
