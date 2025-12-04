import { redirect } from "next/navigation";

// This page exists so users can share clean URLs like:
// https://seer-fun.vercel.app/market/ABC123
// 
// The actions.json maps this to the Blink API:
// https://seer-fun.vercel.app/api/actions/bet/ABC123
//
// When a user without the Blink extension visits, they get redirected
// to the full dashboard page

export default async function MarketPage({
  params,
}: {
  params: Promise<{ marketId: string }>;
}) {
  const { marketId } = await params;
  
  // Redirect to the full dashboard market page
  redirect(`/dashboard/market/${marketId}`);
}
