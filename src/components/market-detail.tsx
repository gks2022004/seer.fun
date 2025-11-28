"use client";

import { useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import Link from "next/link";
import { useSingleMarket, MarketOddsBar, MarketStats, MarketStatusBadge } from "@/hooks/use-markets";
import { createBetTransaction, formatSol, calculateOdds } from "@/lib/solana";

const BET_AMOUNTS = [0.1, 0.25, 0.5, 1, 2, 5];

interface MarketDetailProps {
  marketId: string;
}

export default function MarketDetail({ marketId }: MarketDetailProps) {
  const { market, loading, error, refetch } = useSingleMarket(marketId);
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  
  const [selectedSide, setSelectedSide] = useState<"yes" | "no" | null>(null);
  const [betAmount, setBetAmount] = useState<number>(0.1);
  const [customAmount, setCustomAmount] = useState("");
  const [placing, setPlacing] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);
  const [txSuccess, setTxSuccess] = useState<string | null>(null);

  const handlePlaceBet = async () => {
    if (!publicKey || !market || !selectedSide) return;

    const amount = customAmount ? parseFloat(customAmount) : betAmount;
    if (isNaN(amount) || amount <= 0) {
      setTxError("Invalid bet amount");
      return;
    }

    try {
      setPlacing(true);
      setTxError(null);
      setTxSuccess(null);

      const marketPubkey = new PublicKey(marketId);
      const transaction = await createBetTransaction(
        publicKey,
        marketPubkey,
        amount,
        selectedSide === "yes"
      );

      const signature = await sendTransaction(transaction, connection);
      await connection.confirmTransaction(signature, "confirmed");

      setTxSuccess(`Bet placed! Tx: ${signature.slice(0, 8)}...`);
      setSelectedSide(null);
      setCustomAmount("");
      refetch();
    } catch (e: any) {
      console.error("Error placing bet:", e);
      setTxError(e.message || "Failed to place bet");
    } finally {
      setPlacing(false);
    }
  };

  const copyBlinkUrl = () => {
    const url = `${window.location.origin}/bet/${marketId}`;
    navigator.clipboard.writeText(url);
    alert("Blink URL copied to clipboard!");
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-800 w-1/2 rounded" />
        <div className="h-4 bg-gray-800 w-full rounded" />
        <div className="h-32 bg-gray-800 rounded" />
      </div>
    );
  }

  if (error || !market) {
    return (
      <div className="text-center py-12">
        <div className="text-cyber text-6xl mb-4">❌</div>
        <h2 className="font-vt323 text-xl text-cyber mb-2">MARKET NOT FOUND</h2>
        <p className="text-gray-400 font-mono text-sm mb-4">{error}</p>
        <Link href="/dashboard" className="btn-cyber">
          BACK TO MARKETS
        </Link>
      </div>
    );
  }

  const odds = calculateOdds(market.yesAmount, market.noAmount);
  const isBettingOpen = !market.resolved && Date.now() / 1000 < Number(market.endTime);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back Link */}
      <Link 
        href="/dashboard" 
        className="inline-flex items-center text-gray-400 hover:text-matrix font-mono text-sm transition-colors"
      >
        ← BACK TO MARKETS
      </Link>

      {/* Market Header */}
      <div className="border border-gray-800 p-6 bg-void/50">
        <div className="flex items-start justify-between mb-4">
          <MarketStatusBadge market={market} />
          <button
            onClick={copyBlinkUrl}
            className="text-gray-400 hover:text-matrix font-mono text-xs border border-gray-700 hover:border-matrix px-3 py-1 transition-colors"
          >
            📋 COPY BLINK URL
          </button>
        </div>
        
        <h1 className="font-vt323 text-2xl md:text-3xl text-white mb-4">
          {market.question}
        </h1>

        <div className="mb-6">
          <MarketOddsBar yesAmount={market.yesAmount} noAmount={market.noAmount} />
        </div>

        <MarketStats market={market} />

        <div className="mt-4 pt-4 border-t border-gray-800 text-xs font-mono text-gray-500">
          <span>Market ID: {marketId}</span>
        </div>
      </div>

      {/* Betting Interface */}
      {isBettingOpen && (
        <div className="border border-matrix/30 p-6 bg-matrix/5">
          <h2 className="font-vt323 text-xl text-matrix mb-4">PLACE YOUR BET</h2>

          {!publicKey ? (
            <div className="text-center py-8">
              <p className="text-gray-400 font-mono mb-4">Connect your wallet to place a bet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Side Selection */}
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setSelectedSide("yes")}
                  className={`p-4 border-2 transition-all ${
                    selectedSide === "yes"
                      ? "border-matrix bg-matrix/20 text-matrix"
                      : "border-gray-700 text-gray-400 hover:border-matrix/50"
                  }`}
                >
                  <div className="text-3xl mb-2">✅</div>
                  <div className="font-vt323 text-xl">YES</div>
                  <div className="font-mono text-sm opacity-70">{odds.yes}% odds</div>
                </button>
                <button
                  onClick={() => setSelectedSide("no")}
                  className={`p-4 border-2 transition-all ${
                    selectedSide === "no"
                      ? "border-cyber bg-cyber/20 text-cyber"
                      : "border-gray-700 text-gray-400 hover:border-cyber/50"
                  }`}
                >
                  <div className="text-3xl mb-2">❌</div>
                  <div className="font-vt323 text-xl">NO</div>
                  <div className="font-mono text-sm opacity-70">{odds.no}% odds</div>
                </button>
              </div>

              {/* Amount Selection */}
              {selectedSide && (
                <div className="space-y-3">
                  <div className="text-sm font-mono text-gray-400">SELECT AMOUNT</div>
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                    {BET_AMOUNTS.map((amount) => (
                      <button
                        key={amount}
                        onClick={() => {
                          setBetAmount(amount);
                          setCustomAmount("");
                        }}
                        className={`py-2 px-3 font-mono text-sm border transition-all ${
                          betAmount === amount && !customAmount
                            ? "border-matrix bg-matrix/20 text-matrix"
                            : "border-gray-700 text-gray-400 hover:border-matrix/50"
                        }`}
                      >
                        {amount} SOL
                      </button>
                    ))}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono text-gray-400">CUSTOM:</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={customAmount}
                      onChange={(e) => setCustomAmount(e.target.value)}
                      placeholder="0.00"
                      className="flex-1 bg-void border border-gray-700 focus:border-matrix text-white font-mono p-2 outline-none"
                    />
                    <span className="font-mono text-gray-400">SOL</span>
                  </div>
                </div>
              )}

              {/* Place Bet Button */}
              {selectedSide && (
                <button
                  onClick={handlePlaceBet}
                  disabled={placing}
                  className={`w-full py-4 font-vt323 text-xl transition-all ${
                    selectedSide === "yes"
                      ? "btn-glitch"
                      : "bg-cyber hover:bg-cyber/80 text-void"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {placing ? (
                    <span className="animate-pulse">PLACING BET...</span>
                  ) : (
                    `BET ${customAmount || betAmount} SOL ON ${selectedSide.toUpperCase()}`
                  )}
                </button>
              )}

              {/* Transaction Status */}
              {txError && (
                <div className="border border-cyber bg-cyber/10 p-3 text-cyber font-mono text-sm">
                  ⚠️ {txError}
                </div>
              )}
              {txSuccess && (
                <div className="border border-matrix bg-matrix/10 p-3 text-matrix font-mono text-sm">
                  ✅ {txSuccess}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Market Resolved */}
      {market.resolved && (
        <div className={`border p-6 ${
          market.outcome 
            ? "border-matrix bg-matrix/10" 
            : "border-cyber bg-cyber/10"
        }`}>
          <h2 className="font-vt323 text-xl mb-2">
            MARKET RESOLVED: {market.outcome ? "✅ YES" : "❌ NO"} WON
          </h2>
          <p className="text-gray-400 font-mono text-sm">
            Total pool of {formatSol(market.yesAmount + market.noAmount)} SOL distributed to winners
          </p>
        </div>
      )}

      {/* Pool Breakdown */}
      <div className="grid grid-cols-2 gap-4">
        <div className="border border-matrix/30 p-4">
          <div className="text-matrix font-mono text-sm mb-1">YES POOL</div>
          <div className="font-vt323 text-2xl text-white">
            {formatSol(market.yesAmount)} SOL
          </div>
        </div>
        <div className="border border-cyber/30 p-4">
          <div className="text-cyber font-mono text-sm mb-1">NO POOL</div>
          <div className="font-vt323 text-2xl text-white">
            {formatSol(market.noAmount)} SOL
          </div>
        </div>
      </div>
    </div>
  );
}
