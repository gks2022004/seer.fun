"use client";

import { useState, useEffect, useCallback } from "react";
import { PublicKey } from "@solana/web3.js";
import { connection, formatSol, calculateOdds, formatTimeRemaining, fetchMarketAccount } from "@/lib/solana";
import { SEER_PROGRAM_ID } from "@/lib/seer-program";
import type { MarketAccount } from "@/lib/seer-program";

export interface MarketWithPubkey extends MarketAccount {
  pubkey: string;
}

// Base58 alphabet
const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

// Simple base58 encoder for the discriminator
function encodeBase58(bytes: number[]): string {
  const digits = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let i = 0; i < digits.length; i++) {
      carry += digits[i] << 8;
      digits[i] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let result = "";
  for (let i = digits.length - 1; i >= 0; i--) {
    result += BASE58_ALPHABET[digits[i]];
  }
  // Add leading zeros
  for (const byte of bytes) {
    if (byte === 0) result = "1" + result;
    else break;
  }
  return result;
}

// Market account discriminator from Anchor: SHA256("account:Market")[0:8]
const MARKET_DISCRIMINATOR = [219, 190, 213, 55, 0, 227, 198, 154];
const MARKET_DISCRIMINATOR_B58 = encodeBase58(MARKET_DISCRIMINATOR);

export function useMarkets() {
  const [markets, setMarkets] = useState<MarketWithPubkey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMarkets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const programId = new PublicKey(SEER_PROGRAM_ID);
      
      // Get all program accounts with Market discriminator
      const accounts = await connection.getProgramAccounts(programId, {
        filters: [
          {
            memcmp: {
              offset: 0,
              bytes: MARKET_DISCRIMINATOR_B58,
            },
          },
        ],
      });

      console.log(`Found ${accounts.length} market accounts`);

      const marketsData: MarketWithPubkey[] = [];

      for (const { pubkey } of accounts) {
        try {
          const market = await fetchMarketAccount(pubkey);
          if (market) {
            marketsData.push({
              ...market,
              pubkey: pubkey.toBase58(),
            });
          }
        } catch (e) {
          console.error("Error parsing market:", pubkey.toBase58(), e);
        }
      }

      // Sort by end time (most recent first)
      marketsData.sort((a, b) => Number(b.endTime) - Number(a.endTime));

      setMarkets(marketsData);
    } catch (e) {
      console.error("Error fetching markets:", e);
      setError("Failed to fetch markets");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMarkets();
  }, [fetchMarkets]);

  return { markets, loading, error, refetch: fetchMarkets };
}

export function useSingleMarket(marketId: string | null) {
  const [market, setMarket] = useState<MarketWithPubkey | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMarket = useCallback(async () => {
    if (!marketId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const marketPubkey = new PublicKey(marketId);
      const marketData = await fetchMarketAccount(marketPubkey);

      if (marketData) {
        setMarket({
          ...marketData,
          pubkey: marketId,
        });
      } else {
        setError("Market not found");
      }
    } catch (e) {
      console.error("Error fetching market:", e);
      setError("Invalid market ID");
    } finally {
      setLoading(false);
    }
  }, [marketId]);

  useEffect(() => {
    fetchMarket();
  }, [fetchMarket]);

  return { market, loading, error, refetch: fetchMarket };
}

// Helper components for displaying market data
export function MarketOddsBar({ yesAmount, noAmount }: { yesAmount: bigint; noAmount: bigint }) {
  const odds = calculateOdds(yesAmount, noAmount);
  
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs font-mono mb-1">
        <span className="text-matrix">YES {odds.yes}%</span>
        <span className="text-cyber">NO {odds.no}%</span>
      </div>
      <div className="h-2 bg-gray-800 rounded-sm overflow-hidden flex">
        <div 
          className="bg-matrix h-full transition-all duration-500"
          style={{ width: `${odds.yes}%` }}
        />
        <div 
          className="bg-cyber h-full transition-all duration-500"
          style={{ width: `${odds.no}%` }}
        />
      </div>
    </div>
  );
}

export function MarketStats({ market }: { market: MarketAccount }) {
  const totalPool = formatSol(market.yesAmount + market.noAmount);
  const timeRemaining = formatTimeRemaining(market.endTime);
  
  return (
    <div className="grid grid-cols-3 gap-2 text-xs font-mono">
      <div className="bg-void/50 p-2 border border-gray-800">
        <div className="text-gray-500">POOL</div>
        <div className="text-yellow-400">{totalPool} SOL</div>
      </div>
      <div className="bg-void/50 p-2 border border-gray-800">
        <div className="text-gray-500">BETTORS</div>
        <div className="text-white">{market.totalBettors}</div>
      </div>
      <div className="bg-void/50 p-2 border border-gray-800">
        <div className="text-gray-500">ENDS</div>
        <div className={market.resolved ? "text-gray-400" : "text-matrix"}>
          {market.resolved ? "RESOLVED" : timeRemaining}
        </div>
      </div>
    </div>
  );
}

export function MarketStatusBadge({ market }: { market: MarketAccount }) {
  if (market.resolved) {
    return (
      <span className={`px-2 py-0.5 text-xs font-mono ${
        market.outcome ? "bg-matrix/20 text-matrix" : "bg-cyber/20 text-cyber"
      }`}>
        {market.outcome ? "YES WON" : "NO WON"}
      </span>
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const ended = now >= Number(market.endTime);

  if (ended) {
    return (
      <span className="px-2 py-0.5 text-xs font-mono bg-yellow-500/20 text-yellow-400">
        AWAITING RESOLUTION
      </span>
    );
  }

  return (
    <span className="px-2 py-0.5 text-xs font-mono bg-matrix/20 text-matrix animate-pulse">
      LIVE
    </span>
  );
}
