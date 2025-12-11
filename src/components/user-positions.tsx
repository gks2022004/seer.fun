"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction, SystemProgram } from "@solana/web3.js";
import Link from "next/link";
import { connection, formatSol, programId, getUserPositionPDA, getMarketVaultPDA } from "@/lib/solana";
import { SEER_PROGRAM_ID } from "@/lib/seer-program";

interface Position {
  marketPubkey: string;
  question: string;
  yesAmount: bigint;
  noAmount: bigint;
  claimed: boolean;
  marketResolved: boolean;
  marketOutcome: boolean;
  totalYes: bigint;
  totalNo: bigint;
}

export default function UserPositions() {
  const { publicKey, sendTransaction } = useWallet();
  const { connection: walletConnection } = useConnection();
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchPositions = useCallback(async () => {
    if (!publicKey) {
      setPositions([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const programPubkey = new PublicKey(SEER_PROGRAM_ID);

      // Get all UserPosition accounts for this user
      // UserPosition discriminator: [251, 248, 209, 245, 83, 234, 17, 27]
      const accounts = await connection.getProgramAccounts(programPubkey, {
        filters: [
          { dataSize: 90 }, // Approximate size of UserPosition
          {
            memcmp: {
              offset: 8, // After discriminator
              bytes: publicKey.toBase58(),
            },
          },
        ],
      });

      const positionsData: Position[] = [];

      for (const { account } of accounts) {
        try {
          const data = account.data;
          let offset = 8; // Skip discriminator

          // bettor (32 bytes)
          offset += 32;

          // market (32 bytes)
          const marketPubkey = new PublicKey(data.slice(offset, offset + 32)).toBase58();
          offset += 32;

          // yes_amount (8 bytes)
          const yesAmount = data.readBigUInt64LE(offset);
          offset += 8;

          // no_amount (8 bytes)
          const noAmount = data.readBigUInt64LE(offset);
          offset += 8;

          // claimed (1 byte)
          const claimed = data[offset] === 1;

          // Fetch market data
          const marketAccount = await connection.getAccountInfo(new PublicKey(marketPubkey));
          if (!marketAccount) continue;

          const marketData = marketAccount.data;
          let mOffset = 8;

          // Skip creator
          mOffset += 32;

          // question
          const questionLen = marketData.readUInt32LE(mOffset);
          mOffset += 4;
          const question = marketData.slice(mOffset, mOffset + questionLen).toString("utf-8");
          mOffset += questionLen;

          // total yes/no
          const totalYes = marketData.readBigUInt64LE(mOffset);
          mOffset += 8;
          const totalNo = marketData.readBigUInt64LE(mOffset);
          mOffset += 8;

          // resolved
          const resolved = marketData[mOffset] === 1;
          mOffset += 1;

          // outcome
          const outcome = marketData[mOffset] === 1;

          positionsData.push({
            marketPubkey,
            question,
            yesAmount,
            noAmount,
            claimed,
            marketResolved: resolved,
            marketOutcome: outcome,
            totalYes,
            totalNo,
          });
        } catch (e) {
          console.error("Error parsing position:", e);
        }
      }

      setPositions(positionsData);
    } catch (e) {
      console.error("Error fetching positions:", e);
      setError("Failed to fetch positions");
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  useEffect(() => {
    fetchPositions();
  }, [fetchPositions]);

  const handleClaimWinnings = async (position: Position) => {
    if (!publicKey) return;

    try {
      setClaiming(position.marketPubkey);
      setError(null);

      const marketPubkey = new PublicKey(position.marketPubkey);
      const [marketVault] = getMarketVaultPDA(marketPubkey);
      const [userPosition] = getUserPositionPDA(marketPubkey, publicKey);

      // claim_winnings discriminator: [161, 215, 24, 59, 14, 236, 242, 221]
      const discriminator = Buffer.from([161, 215, 24, 59, 14, 236, 242, 221]);

      const { ComputeBudgetProgram } = await import("@solana/web3.js");
      
      const transaction = new Transaction();
      
      // Add compute budget for priority
      transaction.add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200000 }),
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50000 })
      );

      transaction.add({
        keys: [
          { pubkey: publicKey, isSigner: true, isWritable: true },
          { pubkey: marketPubkey, isSigner: false, isWritable: false },
          { pubkey: marketVault, isSigner: false, isWritable: true },
          { pubkey: userPosition, isSigner: false, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        programId,
        data: discriminator,
      });

      const { blockhash, lastValidBlockHeight } = await walletConnection.getLatestBlockhash("confirmed");
      transaction.recentBlockhash = blockhash;
      transaction.lastValidBlockHeight = lastValidBlockHeight;
      transaction.feePayer = publicKey;

      const signature = await sendTransaction(transaction, walletConnection, {
        skipPreflight: true,
        preflightCommitment: "confirmed",
      });
      
      await walletConnection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight,
      }, "confirmed");

      // Refresh positions
      fetchPositions();
    } catch (e) {
      console.error("Error claiming winnings:", e);
      setError(e instanceof Error ? e.message : "Failed to claim winnings");
    } finally {
      setClaiming(null);
    }
  };

  const calculateWinnings = (position: Position): bigint => {
    if (!position.marketResolved) return BigInt(0);
    
    const totalPool = position.totalYes + position.totalNo;
    const winningPool = position.marketOutcome ? position.totalYes : position.totalNo;
    const userBet = position.marketOutcome ? position.yesAmount : position.noAmount;
    
    if (winningPool === BigInt(0) || userBet === BigInt(0)) return BigInt(0);
    
    return (userBet * totalPool) / winningPool;
  };

  const isWinner = (position: Position): boolean => {
    if (!position.marketResolved) return false;
    return position.marketOutcome 
      ? position.yesAmount > BigInt(0)
      : position.noAmount > BigInt(0);
  };

  if (!publicKey) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500 text-6xl mb-4"></div>
        <h2 className="font-vt323 text-xl text-gray-400 mb-2">CONNECT WALLET</h2>
        <p className="text-gray-500 font-mono text-sm">
          Connect your wallet to view your positions
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="font-vt323 text-2xl text-matrix text-glow-green mb-6">
          MY POSITIONS
        </h1>
        {[1, 2].map((i) => (
          <div key={i} className="border border-gray-800 p-4 animate-pulse">
            <div className="h-6 bg-gray-800 w-3/4 rounded mb-4" />
            <div className="h-16 bg-gray-800 rounded" />
          </div>
        ))}
      </div>
    );
  }

  // Calculate summary stats
  const totalBet = positions.reduce((acc, p) => acc + p.yesAmount + p.noAmount, BigInt(0));
  const totalWinnings = positions.reduce((acc, p) => {
    if (p.marketResolved && isWinner(p)) {
      return acc + calculateWinnings(p);
    }
    return acc;
  }, BigInt(0));
  const pendingClaims = positions.filter(p => p.marketResolved && isWinner(p) && !p.claimed);
  const activePositions = positions.filter(p => !p.marketResolved);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-vt323 text-2xl text-matrix text-glow-green">
          MY POSITIONS
        </h1>
        <button
          onClick={fetchPositions}
          className="btn-cyber text-sm py-2 px-4"
        >
          REFRESH
        </button>
      </div>

      {/* Summary Stats */}
      {positions.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-void/50 p-4 border border-gray-800">
            <div className="text-gray-500 text-xs font-mono">TOTAL BET</div>
            <div className="font-vt323 text-xl text-white">{formatSol(totalBet)} SOL</div>
          </div>
          <div className="bg-void/50 p-4 border border-gray-800">
            <div className="text-gray-500 text-xs font-mono">TOTAL WON</div>
            <div className="font-vt323 text-xl text-matrix">{formatSol(totalWinnings)} SOL</div>
          </div>
          <div className="bg-void/50 p-4 border border-gray-800">
            <div className="text-gray-500 text-xs font-mono">ACTIVE BETS</div>
            <div className="font-vt323 text-xl text-yellow-400">{activePositions.length}</div>
          </div>
          <div className="bg-void/50 p-4 border border-gray-800">
            <div className="text-gray-500 text-xs font-mono">PENDING CLAIMS</div>
            <div className={`font-vt323 text-xl ${pendingClaims.length > 0 ? "text-matrix animate-pulse" : "text-gray-400"}`}>
              {pendingClaims.length}
            </div>
          </div>
        </div>
      )}

      {/* Pending Claims Alert */}
      {pendingClaims.length > 0 && (
        <div className="border border-matrix bg-matrix/10 p-4 flex items-center justify-between">
          <div>
            <div className="font-vt323 text-lg text-matrix">YOU HAVE UNCLAIMED WINNINGS!</div>
            <div className="text-gray-400 font-mono text-sm">
              {pendingClaims.length} position{pendingClaims.length > 1 ? 's' : ''} ready to claim
            </div>
          </div>
          <div className="font-vt323 text-xl text-matrix">
            {formatSol(pendingClaims.reduce((acc, p) => acc + calculateWinnings(p), BigInt(0)))} SOL
          </div>
        </div>
      )}

      {error && (
        <div className="border border-cyber bg-cyber/10 p-4 text-cyber font-mono text-sm mb-4">
          ⚠️ {error}
        </div>
      )}

      {positions.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-gray-700">
          <div className="text-gray-500 text-6xl mb-4"></div>
          <h2 className="font-vt323 text-xl text-gray-400 mb-2">NO POSITIONS YET</h2>
          <p className="text-gray-500 font-mono text-sm mb-4">
            You haven&apos;t placed any bets yet
          </p>
          <Link href="/dashboard" className="btn-glitch">
            BROWSE MARKETS
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {positions.map((position) => {
            const winner = isWinner(position);
            const winnings = calculateWinnings(position);
            const canClaim = position.marketResolved && winner && !position.claimed;

            return (
              <div
                key={position.marketPubkey}
                className={`border p-4 ${
                  position.marketResolved
                    ? winner
                      ? "border-matrix/50 bg-matrix/5"
                      : "border-cyber/50 bg-cyber/5"
                    : "border-gray-800"
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <Link 
                    href={`/dashboard/market/${position.marketPubkey}`}
                    className="font-mono text-white hover:text-matrix transition-colors flex-1 pr-4"
                  >
                    {position.question}
                  </Link>
                  {position.marketResolved && (
                    <span className={`px-2 py-0.5 text-xs font-mono ${
                      winner ? "bg-matrix/20 text-matrix" : "bg-cyber/20 text-cyber"
                    }`}>
                      {winner ? "WON" : "LOST"}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm font-mono">
                  <div className="bg-void/50 p-2 border border-gray-800">
                    <div className="text-gray-500 text-xs">YES BET</div>
                    <div className="text-matrix">{formatSol(position.yesAmount)} SOL</div>
                  </div>
                  <div className="bg-void/50 p-2 border border-gray-800">
                    <div className="text-gray-500 text-xs">NO BET</div>
                    <div className="text-cyber">{formatSol(position.noAmount)} SOL</div>
                  </div>
                  <div className="bg-void/50 p-2 border border-gray-800">
                    <div className="text-gray-500 text-xs">STATUS</div>
                    <div className={position.marketResolved ? "text-yellow-400" : "text-matrix"}>
                      {position.marketResolved ? "RESOLVED" : "ACTIVE"}
                    </div>
                  </div>
                  <div className="bg-void/50 p-2 border border-gray-800">
                    <div className="text-gray-500 text-xs">
                      {position.claimed ? "CLAIMED" : "WINNINGS"}
                    </div>
                    <div className={winner ? "text-matrix" : "text-gray-400"}>
                      {position.claimed 
                        ? "CLAIMED" 
                        : winner 
                          ? `${formatSol(winnings)} SOL`
                          : "-"
                      }
                    </div>
                  </div>
                </div>

                {canClaim && (
                  <button
                    onClick={() => handleClaimWinnings(position)}
                    disabled={claiming === position.marketPubkey}
                    className="w-full mt-4 btn-glitch py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {claiming === position.marketPubkey ? (
                      <span className="animate-pulse">CLAIMING...</span>
                    ) : (
                      `CLAIM ${formatSol(winnings)} SOL`
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
