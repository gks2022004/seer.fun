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
      // Map all root level routes to an action
      {
        pathPattern: "/*",
        apiPath: "/api/actions/*",
      },
      // Idempotent rule as the fallback
      {
        pathPattern: "/api/actions/**",
        apiPath: "/api/actions/**",
      },
    ],
  };

  return NextResponse.json(payload, { headers });
}

export const OPTIONS = GET;
