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
      // Map bet routes
      {
        pathPattern: "/bet/*",
        apiPath: "/api/actions/bet/*",
      },
      // Map market routes (alias)
      {
        pathPattern: "/market/*",
        apiPath: "/api/actions/bet/*",
      },
    ],
  };

  return NextResponse.json(payload, { headers });
}

export const OPTIONS = GET;
