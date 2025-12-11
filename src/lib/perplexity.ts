export interface ResolutionResult {
  suggestedOutcome: boolean;
  confidence: number;
  reasoning: string;
  sources: string[];
}

const PERPLEXITY_API_URL = "https://api.perplexity.ai/chat/completions";

const SYSTEM_PROMPT = `You are an impartial judge for resolving prediction markets. Your job is to determine if a prediction came TRUE (YES) or FALSE (NO) based on real-world events and current data.

CRITICAL RULES:
1. Search for the most recent and reliable information
2. Only answer based on verifiable facts from credible sources
3. If the event clearly happened, answer YES (outcome: true)
4. If the event clearly did not happen, answer NO (outcome: false)
5. If uncertain or event hasn't occurred yet, lean towards NO but explain
6. Provide your confidence level (0-100%)
7. List your sources

You MUST respond in this exact JSON format (no markdown, just raw JSON):
{
  "outcome": true or false,
  "confidence": 0-100,
  "reasoning": "Brief explanation of your determination",
  "sources": ["source1", "source2"]
}`;

export async function getMarketResolution(
  question: string,
  context?: string
): Promise<ResolutionResult> {
  const apiKey = process.env.PERPLEXITY_API_KEY;

  if (!apiKey) {
    throw new Error("PERPLEXITY_API_KEY is not configured");
  }

  const userPrompt = `Prediction market question: "${question}"
${context ? `Additional context: ${context}` : ""}
Current date: ${new Date().toISOString().split("T")[0]}

Based on real-time search results, did this prediction come true? Respond in JSON format only.`;

  try {
    const response = await fetch(PERPLEXITY_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "sonar", // Real-time search model
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.1, // Low temperature for more deterministic results
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Perplexity API error:", response.status, errorText);
      throw new Error(`Perplexity API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No response content from Perplexity");
    }

    // Parse JSON response - handle potential markdown wrapping
    let jsonContent = content;
    
    // Remove markdown code blocks if present
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonContent = jsonMatch[1];
    }
    
    // Try to find JSON object in the content
    const objectMatch = jsonContent.match(/\{[\s\S]*\}/);
    if (!objectMatch) {
      throw new Error("Could not parse JSON from Perplexity response");
    }

    const parsed = JSON.parse(objectMatch[0]);

    return {
      suggestedOutcome: parsed.outcome === true,
      confidence: Math.min(100, Math.max(0, parsed.confidence || 50)),
      reasoning: parsed.reasoning || "AI analysis completed",
      sources: Array.isArray(parsed.sources) ? parsed.sources : [],
    };
  } catch (error) {
    console.error("Perplexity resolution error:", error);
    throw error;
  }
}

// Fallback mock resolution for testing without API key
export function getMockResolution(question: string): ResolutionResult {
  const lowerQuestion = question.toLowerCase();

  // Sports-related
  if (lowerQuestion.includes("india") && (lowerQuestion.includes("win") || lowerQuestion.includes("won"))) {
    return {
      suggestedOutcome: true,
      confidence: 75,
      reasoning: "Based on recent cricket match results, India won their latest match.",
      sources: ["ESPN Cricinfo", "ICC Official"],
    };
  }

  // Crypto-related
  if (lowerQuestion.includes("btc") && lowerQuestion.includes("100k")) {
    return {
      suggestedOutcome: true,
      confidence: 90,
      reasoning: "Bitcoin has reached and surpassed $100,000 based on current market data.",
      sources: ["CoinGecko", "CoinMarketCap"],
    };
  }

  if (lowerQuestion.includes("eth") && lowerQuestion.includes("10k")) {
    return {
      suggestedOutcome: false,
      confidence: 85,
      reasoning: "Ethereum has not reached $10,000 as of the current date.",
      sources: ["CoinGecko", "CoinMarketCap"],
    };
  }

  // Default uncertain response
  return {
    suggestedOutcome: false,
    confidence: 50,
    reasoning: "Unable to verify outcome with high confidence. Manual verification recommended.",
    sources: [],
  };
}
