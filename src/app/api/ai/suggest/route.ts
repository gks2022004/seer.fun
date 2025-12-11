import { NextRequest, NextResponse } from "next/server";
import { getMarketResolution, getMockResolution, ResolutionResult } from "@/lib/perplexity";

interface SuggestRequest {
  question: string;
  endTime?: number;
  context?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: SuggestRequest = await req.json();
    const { question, endTime, context } = body;

    if (!question) {
      return NextResponse.json(
        { error: "Question is required" },
        { status: 400 }
      );
    }

    // Check if market has ended (if endTime provided)
    if (endTime) {
      const now = Math.floor(Date.now() / 1000);
      if (now < endTime) {
        return NextResponse.json(
          { error: "Market has not ended yet. AI resolution is only available after market ends." },
          { status: 400 }
        );
      }
    }

    let result: ResolutionResult;

    // Check if Perplexity API key is available
    if (process.env.PERPLEXITY_API_KEY) {
      try {
        result = await getMarketResolution(question, context);
      } catch (error) {
        console.error("Perplexity API failed, using mock:", error);
        // Fallback to mock if API fails
        result = getMockResolution(question);
        result.reasoning = `[Fallback] ${result.reasoning}`;
      }
    } else {
      // Use mock for demo/testing
      console.log("No PERPLEXITY_API_KEY, using mock resolution");
      result = getMockResolution(question);
      result.reasoning = `[Demo Mode] ${result.reasoning}`;
    }

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("AI Suggestion error:", error);
    return NextResponse.json(
      { error: "Failed to get AI suggestion" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: "AI Market Resolution API",
    usage: "POST with { question: string, endTime?: number, context?: string }",
    description: "Uses Perplexity AI with real-time web search to suggest market resolution outcomes",
  });
}
