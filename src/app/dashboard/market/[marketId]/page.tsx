"use client";

import { useParams } from "next/navigation";
import MarketDetail from "@/components/market-detail";

export default function MarketPage() {
  const params = useParams();
  const marketId = params.marketId as string;
  
  if (!marketId) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 font-mono">Market ID not found</p>
      </div>
    );
  }
  
  return <MarketDetail marketId={marketId} />;
}
