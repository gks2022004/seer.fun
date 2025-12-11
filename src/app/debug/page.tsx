"use client";

import { useState } from "react";
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";

const PROGRAM_ID = new PublicKey("BwGjxxo2jjAE1aACq4L74L2WzaLjFrxuvvbTMxHyrKbS");

export default function DebugPage() {
  const [address, setAddress] = useState("7aSrqc5h1iUMXiMF8QMyEGQKPwgkX3CKzAuqz9pQDiT5");
  const [marketAddress, setMarketAddress] = useState("");
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const debugClaim = async () => {
    if (!address || !marketAddress) {
      alert("Please enter both addresses");
      return;
    }

    setLoading(true);
    setDebugInfo(null);

    try {
      const connection = new Connection("https://api.devnet.solana.com");
      const userPubkey = new PublicKey(address);
      const marketPubkey = new PublicKey(marketAddress);

      // Derive PDAs
      const [vaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), marketPubkey.toBuffer()],
        PROGRAM_ID
      );

      const [positionPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("position"), marketPubkey.toBuffer(), userPubkey.toBuffer()],
        PROGRAM_ID
      );

      // Fetch account data
      const [userBalance, vaultBalance, marketAccount, positionAccount] = await Promise.all([
        connection.getBalance(userPubkey),
        connection.getBalance(vaultPda),
        connection.getAccountInfo(marketPubkey),
        connection.getAccountInfo(positionPda),
      ]);

      // Parse market data
      let marketData: any = null;
      if (marketAccount) {
        const data = marketAccount.data;
        // Market structure - Anchor uses variable-length string serialization:
        // 8 bytes: discriminator
        // 32 bytes: creator (offset 8)
        // 4 bytes: question length (offset 40)
        // N bytes: actual question string (offset 44)
        // Then immediately after the question string:
        // 8 bytes: yes_amount
        // 8 bytes: no_amount
        // 1 byte: resolved
        // 1 byte: outcome
        // 8 bytes: end_time
        // 1 byte: bump
        // 4 bytes: total_bettors
        
        const creator = new PublicKey(data.slice(8, 40));
        const questionLen = data.readUInt32LE(40);
        const question = data.slice(44, 44 + questionLen).toString("utf-8");
        
        // Continue from after the actual question string
        let offset = 44 + questionLen;
        const yesAmount = Number(data.readBigUInt64LE(offset));
        const noAmount = Number(data.readBigUInt64LE(offset + 8));
        const resolved = data[offset + 16] === 1;
        const outcome = data[offset + 17] === 1;
        const endTime = Number(data.readBigInt64LE(offset + 18));
        const totalBettors = data.readUInt32LE(offset + 27);

        marketData = {
          creator: creator.toString(),
          question,
          yesAmount: yesAmount / LAMPORTS_PER_SOL,
          noAmount: noAmount / LAMPORTS_PER_SOL,
          totalPool: (yesAmount + noAmount) / LAMPORTS_PER_SOL,
          resolved,
          outcome: outcome ? "YES" : "NO",
          endTime: new Date(endTime * 1000).toISOString(),
          totalBettors,
        };
      }

      // Parse position data
      let positionData: any = null;
      if (positionAccount) {
        const data = positionAccount.data;
        const yesAmount = Number(data.readBigUInt64LE(72));
        const noAmount = Number(data.readBigUInt64LE(80));
        const claimed = data[88] === 1;

        positionData = {
          yesAmount: yesAmount / LAMPORTS_PER_SOL,
          noAmount: noAmount / LAMPORTS_PER_SOL,
          claimed,
        };

        // Calculate winnings
        if (marketData && marketData.resolved) {
          const userBet = marketData.outcome === "YES" ? yesAmount : noAmount;
          const winningPool = marketData.outcome === "YES" ? marketData.yesAmount * LAMPORTS_PER_SOL : marketData.noAmount * LAMPORTS_PER_SOL;
          const totalPool = (marketData.yesAmount + marketData.noAmount) * LAMPORTS_PER_SOL;
          
          if (userBet > 0 && winningPool > 0) {
            const winnings = (userBet * totalPool) / winningPool;
            positionData.calculatedWinnings = winnings / LAMPORTS_PER_SOL;
            positionData.isWinner = true;
          } else {
            positionData.isWinner = false;
          }
        }
      }

      setDebugInfo({
        userAddress: address,
        userBalance: userBalance / LAMPORTS_PER_SOL,
        marketAddress: marketAddress,
        vaultAddress: vaultPda.toString(),
        vaultBalance: vaultBalance / LAMPORTS_PER_SOL,
        positionAddress: positionPda.toString(),
        marketExists: !!marketAccount,
        positionExists: !!positionAccount,
        marketData,
        positionData,
        // Checks
        checks: {
          marketResolved: marketData?.resolved || false,
          hasWinningPosition: positionData?.isWinner || false,
          alreadyClaimed: positionData?.claimed || false,
          vaultHasEnoughFunds: vaultBalance >= (positionData?.calculatedWinnings || 0) * LAMPORTS_PER_SOL,
        }
      });
    } catch (error: any) {
      console.error("Debug error:", error);
      setDebugInfo({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-void p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="font-display text-4xl text-matrix mb-8">🔍 Claim Debug Tool</h1>

        <div className="bg-matrix/5 border border-matrix/30 rounded-lg p-6 mb-6">
          <div className="space-y-4">
            <div>
              <label className="block text-matrix/70 mb-2">User Wallet Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full bg-void border border-matrix/30 rounded px-4 py-2 text-matrix font-mono"
                placeholder="Enter wallet address"
              />
            </div>

            <div>
              <label className="block text-matrix/70 mb-2">Market Address</label>
              <input
                type="text"
                value={marketAddress}
                onChange={(e) => setMarketAddress(e.target.value)}
                className="w-full bg-void border border-matrix/30 rounded px-4 py-2 text-matrix font-mono"
                placeholder="Enter market address"
              />
            </div>

            <button
              onClick={debugClaim}
              disabled={loading}
              className="w-full bg-matrix hover:bg-matrix/80 text-void font-display text-xl py-3 rounded transition-colors disabled:opacity-50"
            >
              {loading ? "ANALYZING..." : "DEBUG CLAIM"}
            </button>
          </div>
        </div>

        {debugInfo && (
          <div className="bg-matrix/5 border border-matrix/30 rounded-lg p-6">
            <h2 className="font-display text-2xl text-matrix mb-4">Debug Results</h2>
            
            {debugInfo.error ? (
              <div className="text-red-500">Error: {debugInfo.error}</div>
            ) : (
              <div className="space-y-6 font-mono text-sm">
                {/* Basic Info */}
                <div>
                  <h3 className="text-matrix font-bold mb-2">Account Info</h3>
                  <div className="text-matrix/70 space-y-1">
                    <div>User Balance: {debugInfo.userBalance.toFixed(4)} SOL</div>
                    <div>Vault Balance: {debugInfo.vaultBalance.toFixed(4)} SOL</div>
                    <div>Vault Address: {debugInfo.vaultAddress}</div>
                  </div>
                </div>

                {/* Market Data */}
                {debugInfo.marketData && (
                  <div>
                    <h3 className="text-matrix font-bold mb-2">Market Data</h3>
                    <div className="text-matrix/70 space-y-1">
                      <div>Question: {debugInfo.marketData.question}</div>
                      <div>YES Pool: {debugInfo.marketData.yesAmount.toFixed(4)} SOL</div>
                      <div>NO Pool: {debugInfo.marketData.noAmount.toFixed(4)} SOL</div>
                      <div>Total Pool: {debugInfo.marketData.totalPool.toFixed(4)} SOL</div>
                      <div>Resolved: {debugInfo.marketData.resolved ? "YES" : "NO"}</div>
                      <div>Outcome: {debugInfo.marketData.outcome}</div>
                      <div>Total Bettors: {debugInfo.marketData.totalBettors}</div>
                    </div>
                  </div>
                )}

                {/* Position Data */}
                {debugInfo.positionData && (
                  <div>
                    <h3 className="text-matrix font-bold mb-2">User Position</h3>
                    <div className="text-matrix/70 space-y-1">
                      <div>YES Bet: {debugInfo.positionData.yesAmount.toFixed(4)} SOL</div>
                      <div>NO Bet: {debugInfo.positionData.noAmount.toFixed(4)} SOL</div>
                      <div>Claimed: {debugInfo.positionData.claimed ? "YES" : "NO"}</div>
                      <div>Is Winner: {debugInfo.positionData.isWinner ? "YES" : "NO"}</div>
                      {debugInfo.positionData.calculatedWinnings !== undefined && (
                        <div className="font-bold text-matrix">
                          Calculated Winnings: {debugInfo.positionData.calculatedWinnings.toFixed(4)} SOL
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Checks */}
                <div>
                  <h3 className="text-matrix font-bold mb-2">Eligibility Checks</h3>
                  <div className="space-y-1">
                    <div className={debugInfo.checks.marketResolved ? "text-green-500" : "text-red-500"}>
                      ✓ Market Resolved: {debugInfo.checks.marketResolved ? "PASS" : "FAIL"}
                    </div>
                    <div className={debugInfo.checks.hasWinningPosition ? "text-green-500" : "text-red-500"}>
                      ✓ Has Winning Position: {debugInfo.checks.hasWinningPosition ? "PASS" : "FAIL"}
                    </div>
                    <div className={!debugInfo.checks.alreadyClaimed ? "text-green-500" : "text-red-500"}>
                      ✓ Not Claimed Yet: {!debugInfo.checks.alreadyClaimed ? "PASS" : "FAIL (Already claimed!)"}
                    </div>
                    <div className={debugInfo.checks.vaultHasEnoughFunds ? "text-green-500" : "text-red-500"}>
                      ✓ Vault Has Funds: {debugInfo.checks.vaultHasEnoughFunds ? "PASS" : "FAIL (Insufficient balance!)"}
                    </div>
                  </div>
                </div>

                {/* Summary */}
                <div className="border-t border-matrix/30 pt-4">
                  <h3 className="text-matrix font-bold mb-2">Summary</h3>
                  {debugInfo.checks.alreadyClaimed ? (
                    <div className="text-yellow-500">⚠️ Winnings have already been claimed!</div>
                  ) : !debugInfo.checks.marketResolved ? (
                    <div className="text-yellow-500">⚠️ Market is not resolved yet.</div>
                  ) : !debugInfo.checks.hasWinningPosition ? (
                    <div className="text-yellow-500">⚠️ User did not bet on the winning side.</div>
                  ) : !debugInfo.checks.vaultHasEnoughFunds ? (
                    <div className="text-red-500">❌ Vault doesn't have enough funds! This is a critical error.</div>
                  ) : (
                    <div className="text-green-500">✅ User should be able to claim {debugInfo.positionData?.calculatedWinnings?.toFixed(4)} SOL</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
