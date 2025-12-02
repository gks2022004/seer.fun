// file: src/app/api/actions/bet/[marketId]/route.ts

import {
  ActionGetResponse,
  ActionPostRequest,
  ActionPostResponse,
  ACTIONS_CORS_HEADERS,
  BLOCKCHAIN_IDS,
} from "@solana/actions";
import { PublicKey } from "@solana/web3.js";
import {
  fetchMarketAccount,
  createBetVersionedTransaction,
  formatSol,
  calculateOdds,
  formatTimeRemaining,
} from "@/lib/solana";

// Bet amounts in SOL
const BET_AMOUNTS = [0.1, 0.5, 1];

// CAIP-2 format for Solana devnet
const blockchain = BLOCKCHAIN_IDS.devnet;

// Create headers with CAIP blockchain ID
const headers = {
  ...ACTIONS_CORS_HEADERS,
  "x-blockchain-ids": blockchain,
  "x-action-version": "2.4",
};

// OPTIONS endpoint is required for CORS preflight requests
// Your Blink won't render if you don't add this
export const OPTIONS = async () => {
  return new Response(null, { headers });
};

// GET endpoint returns the Blink metadata (JSON) and UI configuration
export const GET = async (
  req: Request,
  { params }: { params: Promise<{ marketId: string }> }
) => {
  try {
    const { marketId } = await params;
    
    // Validate market ID is a valid public key
    let marketPubkey: PublicKey;
    try {
      marketPubkey = new PublicKey(marketId);
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid market ID" }),
        { status: 400, headers }
      );
    }

    // Fetch market data from chain
    const market = await fetchMarketAccount(marketPubkey);
    
    if (!market) {
      return new Response(
        JSON.stringify({ error: "Market not found" }),
        { status: 404, headers }
      );
    }

    // Calculate stats
    const odds = calculateOdds(market.yesAmount, market.noAmount);
    const totalPool = formatSol(market.yesAmount + market.noAmount);
    const timeRemaining = formatTimeRemaining(market.endTime);

    // Build OG image URL with market data
    const baseUrl = new URL(req.url).origin;
    const ogImageUrl = `${baseUrl}/api/og?` + new URLSearchParams({
      q: market.question,
      yes: odds.yes.toString(),
      no: odds.no.toString(),
      pool: totalPool,
      time: timeRemaining,
    }).toString();

    // Handle resolved markets - still show info but with disabled actions
    if (market.resolved) {
      const outcome = market.outcome ? "YES" : "NO";
      const response: ActionGetResponse = {
        type: "action",
        icon: ogImageUrl,
        title: `[RESOLVED] ${market.question}`,
        description: `✅ ${outcome} WON | Final Pool: ${totalPool} SOL`,
        label: "Market Resolved",
        disabled: true,
        error: {
          message: `This market has been resolved. ${outcome} won!`,
        },
      };
      return new Response(JSON.stringify(response), { status: 200, headers });
    }

    // This JSON is used to render the Blink UI
    const response: ActionGetResponse = {
      type: "action",
      icon: ogImageUrl,
      title: market.question,
      description: `YES: ${odds.yes}% | NO: ${odds.no}% | Pool: ${totalPool} SOL | ⏱ ${timeRemaining}`,
      label: "Place Bet",
      // Links is used if you have multiple actions or need more than one param
      links: {
        actions: [
          // YES bets
          ...BET_AMOUNTS.map((amount) => ({
            type: "transaction" as const,
            label: `YES ${amount} SOL`,
            href: `/api/actions/bet/${marketId}?amount=${amount}&side=yes`,
          })),
          // NO bets
          ...BET_AMOUNTS.map((amount) => ({
            type: "transaction" as const,
            label: `NO ${amount} SOL`,
            href: `/api/actions/bet/${marketId}?amount=${amount}&side=no`,
          })),
          // Custom amount with parameters
          {
            type: "transaction" as const,
            label: "Custom Bet",
            href: `/api/actions/bet/${marketId}?amount={amount}&side={side}`,
            parameters: [
              {
                name: "amount",
                label: "Enter SOL amount",
                type: "number" as const,
                required: true,
              },
              {
                name: "side",
                label: "Pick a side",
                type: "select" as const,
                required: true,
                options: [
                  { label: "YES", value: "yes" },
                  { label: "NO", value: "no" },
                ],
              },
            ],
          },
        ],
      },
    };

    // Return the response with proper headers
    return new Response(JSON.stringify(response), { status: 200, headers });
  } catch (error) {
    console.error("GET Error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch market" }),
      { status: 500, headers }
    );
  }
};

// POST endpoint handles the actual transaction creation
export const POST = async (
  req: Request,
  { params }: { params: Promise<{ marketId: string }> }
) => {
  try {
    const { marketId } = await params;
    const url = new URL(req.url);
    
    // Step 1: Extract parameters from the URL
    const amountStr = url.searchParams.get("amount");
    const side = url.searchParams.get("side");

    if (!amountStr || !side) {
      return new Response(
        JSON.stringify({ error: "Missing amount or side parameter" }),
        { status: 400, headers }
      );
    }

    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      return new Response(
        JSON.stringify({ error: "Invalid bet amount" }),
        { status: 400, headers }
      );
    }

    if (side !== "yes" && side !== "no") {
      return new Response(
        JSON.stringify({ error: "Side must be 'yes' or 'no'" }),
        { status: 400, headers }
      );
    }

    // Validate market
    let marketPubkey: PublicKey;
    try {
      marketPubkey = new PublicKey(marketId);
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid market ID" }),
        { status: 400, headers }
      );
    }

    // Payer public key is passed in the request body
    const request: ActionPostRequest = await req.json();
    let payer: PublicKey;
    try {
      payer = new PublicKey(request.account);
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid account" }),
        { status: 400, headers }
      );
    }

    // Verify market exists and is active
    const market = await fetchMarketAccount(marketPubkey);
    if (!market) {
      return new Response(
        JSON.stringify({ error: "Market not found" }),
        { status: 404, headers }
      );
    }

    if (market.resolved) {
      return new Response(
        JSON.stringify({ error: "Market has been resolved" }),
        { status: 400, headers }
      );
    }

    // Check if betting period has ended
    const now = Math.floor(Date.now() / 1000);
    if (now >= Number(market.endTime)) {
      return new Response(
        JSON.stringify({ error: "Betting period has ended" }),
        { status: 400, headers }
      );
    }

    // Step 2: Prepare the transaction
    const betYes = side === "yes";
    const transaction = await createBetVersionedTransaction(
      payer,
      marketPubkey,
      amount,
      betYes
    );

    // Step 3: Create a response with the serialized transaction
    const response: ActionPostResponse = {
      type: "transaction",
      transaction: Buffer.from(transaction.serialize()).toString("base64"),
    };

    // Return the response with proper headers
    return Response.json(response, { status: 200, headers });
  } catch (error) {
    console.error("POST Error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to create transaction" }),
      { status: 500, headers }
    );
  }
};
