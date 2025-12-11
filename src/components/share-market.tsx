"use client";

import { useState } from "react";
import { formatSol, calculateOdds } from "@/lib/solana";

interface ShareMarketProps {
  marketId: string;
  question: string;
  yesAmount: bigint;
  noAmount: bigint;
  endTime: bigint;
}

export default function ShareMarket({ 
  marketId, 
  question, 
  yesAmount, 
  noAmount,
  endTime 
}: ShareMarketProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const [showShareMenu, setShowShareMenu] = useState(false);

  const odds = calculateOdds(yesAmount, noAmount);
  const pool = formatSol(yesAmount + noAmount);
  const endDate = new Date(Number(endTime) * 1000);
  const isExpired = endDate.getTime() < Date.now();

  // Generate URLs
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://seer.fun";
  const blinkUrl = `${baseUrl}/api/actions/bet/${marketId}`;
  const dialToUrl = `https://dial.to/?action=solana-action:${encodeURIComponent(blinkUrl)}`;

  // Twitter share text
  const timeStatus = isExpired ? "Ended" : `Ends: ${endDate.toLocaleDateString()}`;
  const tweetText = `${question}

YES: ${odds.yes}% | NO: ${odds.no}%
Pool: ${pool} SOL
${timeStatus}

Bet now on @Seer_fun 👇`;

  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(dialToUrl)}`;

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className="border border-gray-800 p-4 bg-void/50">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-vt323 text-lg text-matrix">SHARE THIS MARKET</h3>
        <button
          onClick={() => setShowShareMenu(!showShareMenu)}
          className="text-gray-400 hover:text-white transition-colors md:hidden"
        >
          {showShareMenu ? "▲" : "▼"}
        </button>
      </div>

      <div className={`space-y-3 ${showShareMenu ? "block" : "hidden md:block"}`}>
        {/* Share on Twitter */}
        <a
          href={twitterUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-3 bg-[#1DA1F2] hover:bg-[#1a8cd8] text-white font-mono text-sm transition-colors"
        >
            SHARE ON (TWITTER)
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
          </svg>
        </a>

        {/* Copy Blink URL for Twitter */}
        <div className="space-y-2">
          <label className="text-xs font-mono text-gray-500">BLINK URL (for Twitter/X)</label>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={dialToUrl}
              className="flex-1 bg-void border border-gray-700 text-gray-400 font-mono text-xs p-2 truncate"
            />
            <button
              onClick={() => copyToClipboard(dialToUrl, "blink")}
              className={`px-4 py-2 border font-mono text-xs transition-all ${
                copied === "blink"
                  ? "border-matrix bg-matrix/20 text-matrix"
                  : "border-gray-700 text-gray-400 hover:border-matrix hover:text-matrix"
              }`}
            >
              {copied === "blink" ? "COPIED!" : "COPY"}
            </button>
          </div>
          <p className="text-xs text-gray-600 font-mono">
            Share this URL on Twitter to enable direct betting via Blinks
          </p>
        </div>
      </div>
    </div>
  );
}
