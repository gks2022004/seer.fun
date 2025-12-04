import { ACTIONS_CORS_HEADERS, ActionsJson, BLOCKCHAIN_IDS } from "@solana/actions";
import { NextResponse } from "next/server";

// Headers per Dialect Blink specification
const headers = {
  ...ACTIONS_CORS_HEADERS,
  "x-action-version": "2.4",
  "x-blockchain-ids": BLOCKCHAIN_IDS.devnet, // Change to mainnet for production
};

export async function GET() {
  const payload: ActionsJson = {
    rules: [
      // Map market detail pages to bet API
      // When user shares: https://seer-fun.vercel.app/market/ABC123
      // It maps to: https://seer-fun.vercel.app/api/actions/bet/ABC123
      {
        pathPattern: "/market/*",
        apiPath: "/api/actions/bet/*",
      },
      // Map dashboard market pages to bet API
      {
        pathPattern: "/dashboard/market/*",
        apiPath: "/api/actions/bet/*",
      },
      // Idempotent rule - API paths map to themselves
      {
        pathPattern: "/api/actions/**",
        apiPath: "/api/actions/**",
      },
    ],
  };

  return NextResponse.json(payload, { headers });
}

export const OPTIONS = GET;
