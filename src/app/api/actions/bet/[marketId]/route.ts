import {
  ActionGetResponse,
  ActionPostRequest,
  ActionPostResponse,
  ACTIONS_CORS_HEADERS,
  createPostResponse,
} from "@solana/actions";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  fetchMarketAccount,
  createBetTransaction,
  formatSol,
  calculateOdds,
  formatTimeRemaining,
} from "@/lib/solana";

// Bet amounts in SOL
const BET_AMOUNTS = [0.1, 0.5, 1, 5];

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
      return Response.json(
        { error: "Invalid market ID" },
        { status: 400, headers: ACTIONS_CORS_HEADERS }
      );
    }

    // Fetch market data from chain
    const market = await fetchMarketAccount(marketPubkey);
    
    if (!market) {
      return Response.json(
        { error: "Market not found" },
        { status: 404, headers: ACTIONS_CORS_HEADERS }
      );
    }

    // Check if market is still active
    if (market.resolved) {
      const outcome = market.outcome ? "YES" : "NO";
      return Response.json(
        { 
          error: `Market resolved: ${outcome} won`,
          resolved: true,
          outcome: market.outcome
        },
        { status: 400, headers: ACTIONS_CORS_HEADERS }
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

    // Create action buttons
    const payload: ActionGetResponse = {
      type: "action",
      icon: ogImageUrl,
      title: `${market.question}`,
      description: `YES: ${odds.yes}% | NO: ${odds.no}% | Pool: ${totalPool} SOL | ⏱ ${timeRemaining}`,
      label: "Place Bet",
      links: {
        actions: [
          // YES bets
          ...BET_AMOUNTS.map((amount) => ({
            label: `YES ${amount} SOL`,
            href: `/api/actions/bet/${marketId}?amount=${amount}&side=yes`,
            type: "transaction" as const,
          })),
          // NO bets
          ...BET_AMOUNTS.map((amount) => ({
            label: `NO ${amount} SOL`,
            href: `/api/actions/bet/${marketId}?amount=${amount}&side=no`,
            type: "transaction" as const,
          })),
          // Custom amount
          {
            label: "Custom Bet",
            href: `/api/actions/bet/${marketId}?amount={amount}&side={side}`,
            type: "transaction" as const,
            parameters: [
              {
                name: "amount",
                label: "Amount (SOL)",
                required: true,
                type: "number",
              },
              {
                name: "side",
                label: "Side (yes/no)",
                required: true,
                type: "select",
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

    return Response.json(payload, { headers: ACTIONS_CORS_HEADERS });
  } catch (error) {
    console.error("GET Error:", error);
    return Response.json(
      { error: "Failed to fetch market" },
      { status: 500, headers: ACTIONS_CORS_HEADERS }
    );
  }
};

export const POST = async (
  req: Request,
  { params }: { params: Promise<{ marketId: string }> }
) => {
  try {
    const { marketId } = await params;
    const url = new URL(req.url);
    
    // Parse query params
    const amountStr = url.searchParams.get("amount");
    const side = url.searchParams.get("side");

    if (!amountStr || !side) {
      return Response.json(
        { error: "Missing amount or side parameter" },
        { status: 400, headers: ACTIONS_CORS_HEADERS }
      );
    }

    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      return Response.json(
        { error: "Invalid bet amount" },
        { status: 400, headers: ACTIONS_CORS_HEADERS }
      );
    }

    if (side !== "yes" && side !== "no") {
      return Response.json(
        { error: "Side must be 'yes' or 'no'" },
        { status: 400, headers: ACTIONS_CORS_HEADERS }
      );
    }

    // Validate market
    let marketPubkey: PublicKey;
    try {
      marketPubkey = new PublicKey(marketId);
    } catch {
      return Response.json(
        { error: "Invalid market ID" },
        { status: 400, headers: ACTIONS_CORS_HEADERS }
      );
    }

    // Get bettor from request body
    const body: ActionPostRequest = await req.json();
    let bettorPubkey: PublicKey;
    try {
      bettorPubkey = new PublicKey(body.account);
    } catch {
      return Response.json(
        { error: "Invalid account" },
        { status: 400, headers: ACTIONS_CORS_HEADERS }
      );
    }

    // Verify market exists and is active
    const market = await fetchMarketAccount(marketPubkey);
    if (!market) {
      return Response.json(
        { error: "Market not found" },
        { status: 404, headers: ACTIONS_CORS_HEADERS }
      );
    }

    if (market.resolved) {
      return Response.json(
        { error: "Market has been resolved" },
        { status: 400, headers: ACTIONS_CORS_HEADERS }
      );
    }

    // Check if betting period has ended
    const now = Math.floor(Date.now() / 1000);
    if (now >= Number(market.endTime)) {
      return Response.json(
        { error: "Betting period has ended" },
        { status: 400, headers: ACTIONS_CORS_HEADERS }
      );
    }

    // Create the bet transaction
    const betYes = side === "yes";
    const transaction = await createBetTransaction(
      bettorPubkey,
      marketPubkey,
      amount,
      betYes
    );

    // Create response with transaction
    const sideLabel = betYes ? "YES" : "NO";
    const payload: ActionPostResponse = await createPostResponse({
      fields: {
        type: "transaction",
        transaction,
        message: `Placing ${amount} SOL bet on ${sideLabel} for "${market.question.slice(0, 50)}..."`,
      },
    });

    return Response.json(payload, { headers: ACTIONS_CORS_HEADERS });
  } catch (error) {
    console.error("POST Error:", error);
    return Response.json(
      { error: "Failed to create transaction" },
      { status: 500, headers: ACTIONS_CORS_HEADERS }
    );
  }
};

// Required for CORS preflight
export const OPTIONS = async () => {
  return new Response(null, { headers: ACTIONS_CORS_HEADERS });
};
