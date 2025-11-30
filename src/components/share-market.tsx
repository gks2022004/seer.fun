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
  const marketUrl = `${baseUrl}/dashboard/market/${marketId}`;
  const blinkUrl = `${baseUrl}/api/actions/bet/${marketId}`;
  const dialToUrl = `https://dial.to/?action=solana-action:${encodeURIComponent(blinkUrl)}`;

  // Twitter share text
  const timeStatus = isExpired ? "Ended" : `Ends: ${endDate.toLocaleDateString()}`;
  const tweetText = `${question}

YES: ${odds.yes}% | NO: ${odds.no}%
Pool: ${pool} SOL
${timeStatus}

Bet now on @seer_fun 👇`;

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
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
          </svg>
          SHARE ON X (TWITTER)
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

        {/* Copy Direct Market URL */}
        <div className="space-y-2">
          <label className="text-xs font-mono text-gray-500">DIRECT LINK</label>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={marketUrl}
              className="flex-1 bg-void border border-gray-700 text-gray-400 font-mono text-xs p-2 truncate"
            />
            <button
              onClick={() => copyToClipboard(marketUrl, "direct")}
              className={`px-4 py-2 border font-mono text-xs transition-all ${
                copied === "direct"
                  ? "border-matrix bg-matrix/20 text-matrix"
                  : "border-gray-700 text-gray-400 hover:border-matrix hover:text-matrix"
              }`}
            >
              {copied === "direct" ? "COPIED!" : "COPY"}
            </button>
          </div>
        </div>

        {/* Quick Share Buttons */}
        <div className="grid grid-cols-2 gap-2 pt-2">
          <a
            href={`https://t.me/share/url?url=${encodeURIComponent(dialToUrl)}&text=${encodeURIComponent(tweetText)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 py-2 border border-gray-700 text-gray-400 hover:border-[#0088cc] hover:text-[#0088cc] font-mono text-xs transition-colors"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
            </svg>
            TELEGRAM
          </a>
          <button
            onClick={() => {
              if (navigator.share) {
                navigator.share({
                  title: `Seer.fun: ${question}`,
                  text: tweetText,
                  url: dialToUrl,
                });
              } else {
                copyToClipboard(dialToUrl, "share");
              }
            }}
            className="flex items-center justify-center gap-2 py-2 border border-gray-700 text-gray-400 hover:border-matrix hover:text-matrix font-mono text-xs transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            {copied === "share" ? "COPIED!" : "SHARE"}
          </button>
        </div>

        {/* Preview Card */}
        <div className="mt-4 p-3 border border-dashed border-gray-700 bg-gray-900/50">
          <div className="text-xs font-mono text-gray-500 mb-2">PREVIEW</div>
          <div className="text-sm font-mono text-white mb-1">{question.slice(0, 50)}{question.length > 50 ? "..." : ""}</div>
          <div className="text-xs font-mono text-gray-400">
            YES: {odds.yes}% | NO: {odds.no}% | Pool: {pool} SOL
          </div>
        </div>
      </div>
    </div>
  );
}
