"use client";

import Link from "next/link";
import { useMarkets, MarketOddsBar, MarketStats, MarketStatusBadge } from "@/hooks/use-markets";

export default function MarketsList() {
  const { markets, loading, error, refetch } = useMarkets();

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-vt323 text-2xl text-matrix text-glow-green">
            ACTIVE MARKETS
          </h1>
        </div>
        
        {[1, 2, 3].map((i) => (
          <div 
            key={i}
            className="border border-gray-800 p-4 animate-pulse"
          >
            <div className="h-6 bg-gray-800 rounded w-3/4 mb-4" />
            <div className="h-2 bg-gray-800 rounded w-full mb-4" />
            <div className="grid grid-cols-3 gap-2">
              <div className="h-12 bg-gray-800 rounded" />
              <div className="h-12 bg-gray-800 rounded" />
              <div className="h-12 bg-gray-800 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-cyber text-6xl mb-4">⚠️</div>
        <h2 className="font-vt323 text-xl text-cyber mb-2">ERROR LOADING MARKETS</h2>
        <p className="text-gray-400 font-mono text-sm mb-4">{error}</p>
        <button 
          onClick={refetch}
          className="btn-cyber"
        >
          RETRY
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-vt323 text-2xl text-matrix text-glow-green">
            ACTIVE MARKETS
          </h1>
          <p className="text-gray-500 text-xs font-mono mt-1">
            {markets.length} market{markets.length !== 1 ? 's' : ''} on devnet
          </p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={refetch}
            className="btn-cyber text-sm py-2 px-4"
          >
            REFRESH
          </button>
          <Link href="/dashboard/create" className="btn-glitch text-sm py-2 px-4">
            + CREATE MARKET
          </Link>
        </div>
      </div>

      {markets.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-gray-700">
          <div className="text-gray-500 text-6xl mb-4"></div>
          <h2 className="font-vt323 text-xl text-gray-400 mb-2">NO MARKETS YET</h2>
          <p className="text-gray-500 font-mono text-sm mb-4">
            Be the first to create a prediction market
          </p>
          <Link href="/dashboard/create" className="btn-glitch">
            CREATE MARKET
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {markets.map((market) => (
            <Link 
              key={market.pubkey}
              href={`/dashboard/market/${market.pubkey}`}
              className="block border border-gray-800 hover:border-matrix/50 transition-all p-4 group bg-void/50"
            >
              <div className="flex items-start justify-between mb-3">
                <h2 className="font-mono text-white group-hover:text-matrix transition-colors flex-1 pr-4">
                  {market.question}
                </h2>
                <MarketStatusBadge market={market} />
              </div>

              <div className="mb-4">
                <MarketOddsBar yesAmount={market.yesAmount} noAmount={market.noAmount} />
              </div>

              <MarketStats market={market} />

              <div className="mt-3 pt-3 border-t border-gray-800 flex items-center justify-between">
                <span className="text-gray-500 text-xs font-mono truncate">
                  {market.pubkey.slice(0, 8)}...{market.pubkey.slice(-8)}
                </span>
                <span className="text-matrix text-xs font-mono group-hover:translate-x-1 transition-transform">
                  VIEW →
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
