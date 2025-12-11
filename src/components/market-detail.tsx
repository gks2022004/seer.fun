"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction, SystemProgram } from "@solana/web3.js";
import Link from "next/link";
import { useSingleMarket, MarketOddsBar, MarketStats, MarketStatusBadge } from "@/hooks/use-markets";
import { createBetTransaction, formatSol, calculateOdds, getUserPositionPDA, getMarketVaultPDA, programId, connection as solanaConnection, createResolveMarketTransaction, createAutoResolvePriceMarketTransaction } from "@/lib/solana";
import { PYTH_FEEDS_ARRAY } from "@/lib/pyth-feeds";
import ShareMarket from "./share-market";

const BET_AMOUNTS = [0.1, 0.25, 0.5, 1, 2, 5];

interface UserPosition {
  yesAmount: bigint;
  noAmount: bigint;
  claimed: boolean;
}

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
  const [claiming, setClaiming] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [autoResolving, setAutoResolving] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);
  const [txSuccess, setTxSuccess] = useState<string | null>(null);
  const [userPosition, setUserPosition] = useState<UserPosition | null>(null);

  // Fetch user's position in this market
  const fetchUserPosition = useCallback(async () => {
    if (!publicKey || !marketId) {
      setUserPosition(null);
      return;
    }

    try {
      const marketPubkey = new PublicKey(marketId);
      const [positionPda] = getUserPositionPDA(marketPubkey, publicKey);
      
      const accountInfo = await solanaConnection.getAccountInfo(positionPda);
      
      if (!accountInfo) {
        setUserPosition(null);
        return;
      }

      const data = accountInfo.data;
      let offset = 8; // Skip discriminator

      // bettor (32 bytes)
      offset += 32;

      // market (32 bytes)
      offset += 32;

      // yes_amount (8 bytes)
      const yesAmount = data.readBigUInt64LE(offset);
      offset += 8;

      // no_amount (8 bytes)
      const noAmount = data.readBigUInt64LE(offset);
      offset += 8;

      // claimed (1 byte)
      const claimed = data[offset] === 1;

      setUserPosition({ yesAmount, noAmount, claimed });
    } catch (e) {
      console.error("Error fetching user position:", e);
      setUserPosition(null);
    }
  }, [publicKey, marketId]);

  useEffect(() => {
    fetchUserPosition();
  }, [fetchUserPosition]);

  // Calculate potential winnings
  const calculateWinnings = (): bigint => {
    if (!market || !userPosition || !market.resolved) return BigInt(0);
    
    const totalPool = market.yesAmount + market.noAmount;
    const winningPool = market.outcome ? market.yesAmount : market.noAmount;
    const userBet = market.outcome ? userPosition.yesAmount : userPosition.noAmount;
    
    if (winningPool === BigInt(0) || userBet === BigInt(0)) return BigInt(0);
    
    return (userBet * totalPool) / winningPool;
  };

  const isWinner = (): boolean => {
    if (!market || !userPosition || !market.resolved) return false;
    return market.outcome 
      ? userPosition.yesAmount > BigInt(0)
      : userPosition.noAmount > BigInt(0);
  };

  const handleClaimWinnings = async () => {
    if (!publicKey || !market || !userPosition) return;

    try {
      setClaiming(true);
      setTxError(null);
      setTxSuccess(null);

      const marketPubkey = new PublicKey(marketId);
      const [marketVault] = getMarketVaultPDA(marketPubkey);
      const [positionPda] = getUserPositionPDA(marketPubkey, publicKey);

      // claim_winnings discriminator: [161, 215, 24, 59, 14, 236, 242, 221]
      const discriminator = Buffer.from([161, 215, 24, 59, 14, 236, 242, 221]);

      const transaction = new Transaction().add({
        keys: [
          { pubkey: publicKey, isSigner: true, isWritable: true },
          { pubkey: marketPubkey, isSigner: false, isWritable: false },
          { pubkey: marketVault, isSigner: false, isWritable: true },
          { pubkey: positionPda, isSigner: false, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        programId,
        data: discriminator,
      });

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.lastValidBlockHeight = lastValidBlockHeight;
      transaction.feePayer = publicKey;

      const signature = await sendTransaction(transaction, connection);
      await connection.confirmTransaction(signature, "confirmed");

      const winnings = calculateWinnings();
      setTxSuccess(`Claimed ${formatSol(winnings)} SOL! Tx: ${signature.slice(0, 8)}...`);
      
      // Refresh data
      fetchUserPosition();
      refetch();
    } catch (e) {
      console.error("Error claiming winnings:", e);
      setTxError(e instanceof Error ? e.message : "Failed to claim winnings");
    } finally {
      setClaiming(false);
    }
  };

  const handleResolveMarket = async (outcome: boolean) => {
    if (!publicKey || !market) return;

    try {
      setResolving(true);
      setTxError(null);
      setTxSuccess(null);

      const marketPubkey = new PublicKey(marketId);
      const transaction = await createResolveMarketTransaction(
        publicKey,
        marketPubkey,
        outcome
      );

      const signature = await sendTransaction(transaction, connection);
      await connection.confirmTransaction(signature, "confirmed");

      setTxSuccess(`Market resolved as ${outcome ? "YES" : "NO"}! Tx: ${signature.slice(0, 8)}...`);
      refetch();
    } catch (e) {
      console.error("Error resolving market:", e);
      setTxError(e instanceof Error ? e.message : "Failed to resolve market");
    } finally {
      setResolving(false);
    }
  };

  const handleAutoResolveMarket = async () => {
    if (!publicKey || !market || !market.pythFeedId) return;

    try {
      setAutoResolving(true);
      setTxError(null);
      setTxSuccess(null);

      const marketPubkey = new PublicKey(marketId);
      const transaction = await createAutoResolvePriceMarketTransaction(
        publicKey,
        marketPubkey,
        market.pythFeedId
      );

      const signature = await sendTransaction(transaction, connection);
      await connection.confirmTransaction(signature, "confirmed");

      setTxSuccess(`Price market auto-resolved! Tx: ${signature.slice(0, 8)}...`);
      refetch();
    } catch (e) {
      console.error("Error auto-resolving market:", e);
      setTxError(e instanceof Error ? e.message : "Failed to auto-resolve market");
    } finally {
      setAutoResolving(false);
    }
  };

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
    } catch (e) {
      console.error("Error placing bet:", e);
      setTxError(e instanceof Error ? e.message : "Failed to place bet");
    } finally {
      setPlacing(false);
    }
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

        {/* Share Market */}
        <ShareMarket 
          marketId={marketId}
          question={market.question}
          yesAmount={market.yesAmount}
          noAmount={market.noAmount}
          endTime={market.endTime}
        />
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
                  <div className="text-3xl mb-2"></div>
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
                  <div className="text-3xl mb-2"></div>
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
                   {txError}
                </div>
              )}
              {txSuccess && (
                <div className="border border-matrix bg-matrix/10 p-3 text-matrix font-mono text-sm">
                   {txSuccess}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Auto-Resolve Price Market Section - Anyone can trigger when betting has ended */}
      {publicKey && 
       !market.resolved && 
       market.marketType && 'price' in market.marketType &&
       Date.now() / 1000 >= Number(market.endTime) && (
        <div className="border border-purple-500 p-6 bg-purple-500/10">
          <h2 className="font-vt323 text-xl text-purple-400 mb-2">AUTO-RESOLVE PRICE MARKET</h2>
          <p className="text-gray-400 font-mono text-sm mb-2">
            This is a price-based market that automatically resolves using Pyth Oracle data.
          </p>
          {market.pythFeedId && market.targetPrice && (
            <div className="bg-void/50 p-3 mb-4 border border-gray-800">
              <div className="grid grid-cols-2 gap-4 text-sm font-mono">
                <div>
                  <span className="text-gray-500">ASSET: </span>
                  <span className="text-white">
                    {PYTH_FEEDS_ARRAY.find(f => f.id === market.pythFeedId)?.symbol || "Unknown"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">TARGET PRICE: </span>
                  <span className="text-matrix">${(Number(market.targetPrice) / 100).toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}
          <p className="text-gray-400 font-mono text-xs mb-4">
            Anyone can trigger resolution. The oracle will check if the price reached the target.
          </p>
          
          <button
            onClick={handleAutoResolveMarket}
            disabled={autoResolving}
            className="w-full py-4 border-2 border-purple-500 bg-purple-500/20 text-purple-400 font-vt323 text-xl hover:bg-purple-500/30 transition-all disabled:opacity-50"
          >
            {autoResolving ? "AUTO-RESOLVING..." : "AUTO-RESOLVE WITH PYTH ORACLE"}
          </button>

          {/* Transaction Status */}
          {txError && (
            <div className="border border-cyber bg-cyber/10 p-3 mt-4">
              <div className="text-cyber font-mono text-sm mb-2">{txError}</div>
              {txError.includes("price feed not found") && (
                <div className="text-gray-400 font-mono text-xs mt-2 p-2 bg-void/50 border border-gray-700">
                  <div className="mb-1">💡 <strong>Pyth Price Feeds on Devnet:</strong></div>
                  <div className="ml-4 space-y-1">
                    <div>• Pyth uses a &quot;pull&quot; model - prices must be posted on-chain before use</div>
                    <div>• For devnet testing, price feeds may not be regularly updated</div>
                    <div>• Consider using Event Markets for devnet testing</div>
                    <div>• Price Markets work best on mainnet with active Pyth feeds</div>
                  </div>
                </div>
              )}
            </div>
          )}
          {txSuccess && (
            <div className="border border-matrix bg-matrix/10 p-3 text-matrix font-mono text-sm mt-4">
               {txSuccess}
            </div>
          )}
        </div>
      )}

      {/* Resolve Market Section - Only for creator when betting has ended (Event markets only) */}
      {publicKey && 
       !market.resolved && 
       market.marketType && 'event' in market.marketType &&
       market.creator === publicKey.toBase58() && 
       Date.now() / 1000 >= Number(market.endTime) && (
        <div className="border border-yellow-500 p-6 bg-yellow-500/10">
          <h2 className="font-vt323 text-xl text-yellow-400 mb-2">RESOLVE MARKET</h2>
          <p className="text-gray-400 font-mono text-sm mb-4">
            As the market creator, you can now resolve this market. Choose the winning outcome:
          </p>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <button
              onClick={() => handleResolveMarket(true)}
              disabled={resolving}
              className="py-4 border-2 border-matrix bg-matrix/20 text-matrix font-vt323 text-xl hover:bg-matrix/30 transition-all disabled:opacity-50"
            >
              {resolving ? "RESOLVING..." : "RESOLVE: YES WINS"}
            </button>
            <button
              onClick={() => handleResolveMarket(false)}
              disabled={resolving}
              className="py-4 border-2 border-cyber bg-cyber/20 text-cyber font-vt323 text-xl hover:bg-cyber/30 transition-all disabled:opacity-50"
            >
              {resolving ? "RESOLVING..." : "RESOLVE: NO WINS"}
            </button>
          </div>

          {/* Transaction Status */}
          {txError && (
            <div className="border border-cyber bg-cyber/10 p-3 text-cyber font-mono text-sm">
               {txError}
            </div>
          )}
          {txSuccess && (
            <div className="border border-matrix bg-matrix/10 p-3 text-matrix font-mono text-sm">
               {txSuccess}
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
            MARKET RESOLVED: {market.outcome ? "YES" : "NO"} WON
          </h2>
          <p className="text-gray-400 font-mono text-sm">
            Total pool of {formatSol(market.yesAmount + market.noAmount)} SOL distributed to winners
          </p>
        </div>
      )}

      {/* User Position & Claim Section */}
      {publicKey && userPosition && (userPosition.yesAmount > BigInt(0) || userPosition.noAmount > BigInt(0)) && (
        <div className={`border p-6 ${
          market.resolved
            ? isWinner()
              ? "border-matrix bg-matrix/5"
              : "border-cyber bg-cyber/5"
            : "border-yellow-500/30 bg-yellow-500/5"
        }`}>
          <h2 className="font-vt323 text-xl text-white mb-4">YOUR POSITION</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="bg-void/50 p-3 border border-gray-800">
              <div className="text-gray-500 text-xs font-mono">YOUR YES BET</div>
              <div className="text-matrix font-vt323 text-xl">
                {formatSol(userPosition.yesAmount)} SOL
              </div>
            </div>
            <div className="bg-void/50 p-3 border border-gray-800">
              <div className="text-gray-500 text-xs font-mono">YOUR NO BET</div>
              <div className="text-cyber font-vt323 text-xl">
                {formatSol(userPosition.noAmount)} SOL
              </div>
            </div>
            <div className="bg-void/50 p-3 border border-gray-800">
              <div className="text-gray-500 text-xs font-mono">TOTAL BET</div>
              <div className="text-white font-vt323 text-xl">
                {formatSol(userPosition.yesAmount + userPosition.noAmount)} SOL
              </div>
            </div>
            <div className="bg-void/50 p-3 border border-gray-800">
              <div className="text-gray-500 text-xs font-mono">
                {market.resolved ? (isWinner() ? "WINNINGS" : "RESULT") : "POTENTIAL WIN"}
              </div>
              <div className={`font-vt323 text-xl ${
                market.resolved 
                  ? isWinner() ? "text-matrix" : "text-cyber"
                  : "text-yellow-400"
              }`}>
                {market.resolved
                  ? isWinner()
                    ? `${formatSol(calculateWinnings())} SOL`
                    : "LOST"
                  : "TBD"
                }
              </div>
            </div>
          </div>

          {/* Claim Button */}
          {market.resolved && isWinner() && !userPosition.claimed && (
            <button
              onClick={handleClaimWinnings}
              disabled={claiming}
              className="w-full py-4 btn-glitch font-vt323 text-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {claiming ? (
                <span className="animate-pulse">CLAIMING...</span>
              ) : (
                `CLAIM ${formatSol(calculateWinnings())} SOL`
              )}
            </button>
          )}

          {/* Already Claimed */}
          {market.resolved && userPosition.claimed && (
            <div className="text-center py-3 bg-matrix/20 border border-matrix font-mono text-matrix">
              ✓ WINNINGS CLAIMED
            </div>
          )}

          {/* Lost */}
          {market.resolved && !isWinner() && (
            <div className="text-center py-3 bg-cyber/20 border border-cyber font-mono text-cyber">
              Better luck next time!
            </div>
          )}

          {/* Pending */}
          {!market.resolved && (
            <div className="text-center py-3 bg-yellow-500/10 border border-yellow-500/30 font-mono text-yellow-400">
              Waiting for market resolution
            </div>
          )}
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
