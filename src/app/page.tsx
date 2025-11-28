"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

// ASCII Art Logo - using solid blocks for consistent rendering
const ASCII_LOGO = `
 ██████ ███████ ███████ ██████      ███████ ██    ██ ███    ██
██      ██      ██      ██   ██     ██      ██    ██ ████   ██
 █████  █████   █████   ██████  ██  █████   ██    ██ ██ ██  ██
     ██ ██      ██      ██   ██     ██      ██    ██ ██  ██ ██
██████  ███████ ███████ ██   ██     ██       ██████  ██   ████
`;

// Typing effect hook
function useTypewriter(text: string, speed: number = 50) {
  const [displayText, setDisplayText] = useState("");
  const [isComplete, setIsComplete] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    // Small delay to ensure hydration is complete
    const startDelay = setTimeout(() => {
      setHasStarted(true);
    }, 100);

    return () => clearTimeout(startDelay);
  }, []);

  useEffect(() => {
    if (!hasStarted) return;
    
    let index = 0;
    setDisplayText("");
    setIsComplete(false);

    const timer = setInterval(() => {
      if (index < text.length) {
        setDisplayText(text.slice(0, index + 1));
        index++;
      } else {
        setIsComplete(true);
        clearInterval(timer);
      }
    }, speed);

    return () => clearInterval(timer);
  }, [text, speed, hasStarted]);

  return { displayText, isComplete };
}

// Sample market data
const SAMPLE_MARKETS = [
  { question: "Will BTC hit $100k by EOY?", yesOdds: 67, volume: "420.69 SOL" },
  { question: "ETH ETF approved in 2024?", yesOdds: 82, volume: "1,337 SOL" },
  { question: "Solana flips Ethereum?", yesOdds: 23, volume: "69.42 SOL" },
];

export default function Home() {
  const { displayText, isComplete } = useTypewriter(
    "PREDICTION_MARKETS.exe loaded... Welcome to the future of betting.",
    30
  );

  const [activeMarket, setActiveMarket] = useState(0);
  const [marketId, setMarketId] = useState("7f3a2b");

  // Generate random ID only on client side
  useEffect(() => {
    setMarketId(Math.random().toString(16).slice(2, 8));
  }, [activeMarket]);

  // Cycle through markets
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveMarket((prev) => (prev + 1) % SAMPLE_MARKETS.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <main className="min-h-screen p-4 md:p-8 flex flex-col">
      {/* Header */}
      <header className="flex justify-between items-center mb-8 border-b border-gray-400 pb-4">
        <div className="font-vt323 text-2xl text-matrix text-glow-green">
          SEER.FUN
        </div>
        <nav className="flex gap-4 font-mono text-sm">
          <Link href="/dashboard" className="text-gray-400 hover:text-matrix transition-colors">
            [MARKETS]
          </Link>
          <Link href="/dashboard/create" className="text-gray-400 hover:text-matrix transition-colors">
            [CREATE]
          </Link>
          <Link href="/dashboard" className="btn-glitch text-sm py-1 px-3">
            LAUNCH APP
          </Link>
        </nav>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row gap-8">
        {/* Left Panel - ASCII Logo & Info */}
        <div className="lg:w-1/2 flex flex-col">
          {/* ASCII Logo */}
          <pre className="ascii-art text-xs md:text-sm overflow-x-auto mb-6">
            {ASCII_LOGO}
          </pre>

          {/* Typing Terminal */}
          <div className="terminal-window mb-6">
            <div className="terminal-header">
              <span className="terminal-dot bg-cyber"></span>
              <span className="terminal-dot bg-yellow-500"></span>
              <span className="terminal-dot bg-matrix"></span>
              <span className="ml-2 text-gray-400 font-mono text-sm">
                seer@solana:~
              </span>
            </div>
            <div className="font-mono text-sm">
              <span className="text-cyber">$ </span>
              <span>{displayText}</span>
              {!isComplete && <span className="animate-blink">█</span>}
            </div>
          </div>

          {/* Feature List */}
          <div className="space-y-3 font-mono text-sm">
            <div className="flex items-center gap-3">
              <span className="text-matrix">[✓]</span>
              <span className="text-gray-400">Bet directly from Twitter/X via Blinks</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-matrix">[✓]</span>
              <span className="text-gray-400">Powered by Solana Actions</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-matrix">[✓]</span>
              <span className="text-gray-400">Instant settlement on-chain</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-cyber">[◉]</span>
              <span className="text-matrix">LIVE: {SAMPLE_MARKETS.length} markets</span>
            </div>
          </div>
        </div>

        {/* Right Panel - Live Market Preview */}
        <div className="lg:w-1/2">
          <div className="pixel-card h-full">
            {/* Card Header */}
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-400">
              <span className="font-vt323 text-xl text-matrix">
                ▸ LIVE MARKET
              </span>
              <span className="font-mono text-xs text-gray-400">
                ID: 0x{marketId}
              </span>
            </div>

            {/* Market Question */}
            <h2 className="font-vt323 text-3xl md:text-4xl text-matrix text-glow-green mb-6">
              {SAMPLE_MARKETS[activeMarket].question}
            </h2>

            {/* Odds Display */}
            <div className="mb-6">
              <div className="flex justify-between font-mono text-sm mb-2">
                <span className="text-matrix">YES {SAMPLE_MARKETS[activeMarket].yesOdds}%</span>
                <span className="text-cyber">NO {100 - SAMPLE_MARKETS[activeMarket].yesOdds}%</span>
              </div>
              <div className="odds-bar">
                <div 
                  className="odds-bar-fill-yes"
                  style={{ width: `${SAMPLE_MARKETS[activeMarket].yesOdds}%` }}
                />
              </div>
            </div>

            {/* Volume */}
            <div className="flex justify-between items-center mb-6 font-mono text-sm">
              <span className="text-gray-400">VOLUME:</span>
              <span className="text-matrix">{SAMPLE_MARKETS[activeMarket].volume}</span>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-4">
              <button className="btn-glitch">
                BET YES ↑
              </button>
              <button className="btn-glitch btn-glitch-pink">
                BET NO ↓
              </button>
            </div>

            {/* Blink Preview */}
            <div className="mt-6 p-3 border border-dashed border-gray-400 rounded">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-gray-400 font-mono text-xs">BLINK PREVIEW</span>
                <span className="w-2 h-2 bg-matrix rounded-full animate-pulse"></span>
              </div>
              <div className="bg-void p-2 rounded font-mono text-xs">
                <span className="text-gray-400">https://seer.fun/api/actions/bet/</span>
                <span className="text-matrix">0x7f3...</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-8 pt-4 border-t border-gray-400">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="font-mono text-xs text-gray-400">
            <span className="text-matrix">&gt;</span> Built on Solana | Powered by Blinks
          </div>
          <div className="flex gap-4 font-mono text-xs">
            <a href="#" className="text-gray-400 hover:text-matrix transition-colors">
              [DOCS]
            </a>
            <a href="#" className="text-gray-400 hover:text-matrix transition-colors">
              [GITHUB]
            </a>
            <a href="#" className="text-gray-400 hover:text-cyber transition-colors">
              [TWITTER]
            </a>
          </div>
        </div>
        <div className="mt-4 font-vt323 text-center text-gray-400 text-sm">
          ═══════════════════════════════════════════════════════
        </div>
      </footer>
    </main>
  );
}
