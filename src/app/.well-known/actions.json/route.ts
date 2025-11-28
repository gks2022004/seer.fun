import { ACTIONS_CORS_HEADERS, ActionsJson } from "@solana/actions";
import { NextResponse } from "next/server";

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

  return NextResponse.json(payload, {
    headers: ACTIONS_CORS_HEADERS,
  });
}

export const OPTIONS = GET;
