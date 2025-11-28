import { ImageResponse } from "@vercel/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  // Get parameters with defaults
  const question = searchParams.get("q") || "Will this happen?";
  const yesOdds = searchParams.get("yes") || "50";
  const noOdds = searchParams.get("no") || "50";
  const pool = searchParams.get("pool") || "0.00";
  const timeRemaining = searchParams.get("time") || "24h";

  // Truncate question if too long
  const displayQuestion = question.length > 80 
    ? question.slice(0, 77) + "..." 
    : question;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          backgroundColor: "#050505",
          padding: "40px",
          fontFamily: "monospace",
          position: "relative",
          overflow: "hidden",
        }}
      >

        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <span
              style={{
                fontSize: "32px",
                color: "#00FF41",
                textShadow: "0 0 10px #00FF41",
              }}
            >
              
            </span>
            <span
              style={{
                fontSize: "28px",
                color: "#00FF41",
                fontWeight: "bold",
                textShadow: "0 0 10px #00FF41",
                letterSpacing: "2px",
              }}
            >
              SEER.FUN
            </span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              backgroundColor: "#1a1a1a",
              padding: "8px 16px",
              border: "1px solid #00FF41",
            }}
          >
            <span style={{ color: "#888", fontSize: "16px" }}>⏱</span>
            <span
              style={{
                color: "#00FF41",
                fontSize: "18px",
                fontWeight: "bold",
              }}
            >
              {timeRemaining}
            </span>
          </div>
        </div>

        {/* Question Box */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            backgroundColor: "#0a0a0a",
            border: "2px solid #00FF41",
            padding: "24px",
            marginBottom: "24px",
            boxShadow: "0 0 20px rgba(0,255,65,0.2), inset 0 0 20px rgba(0,255,65,0.05)",
          }}
        >
          <span
            style={{
              color: "#666",
              fontSize: "14px",
              marginBottom: "8px",
              textTransform: "uppercase",
              letterSpacing: "2px",
            }}
          >
            PREDICTION MARKET
          </span>
          <span
            style={{
              color: "#ffffff",
              fontSize: "28px",
              fontWeight: "bold",
              lineHeight: 1.3,
            }}
          >
            {displayQuestion}
          </span>
        </div>

        {/* Odds Display */}
        <div
          style={{
            display: "flex",
            gap: "20px",
            marginBottom: "24px",
          }}
        >
          {/* YES Side */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              backgroundColor: "rgba(0, 255, 65, 0.1)",
              border: "2px solid #00FF41",
              padding: "20px",
            }}
          >
            <span
              style={{
                color: "#00FF41",
                fontSize: "20px",
                marginBottom: "8px",
                fontWeight: "bold",
              }}
            >
               YES
            </span>
            <span
              style={{
                color: "#00FF41",
                fontSize: "48px",
                fontWeight: "bold",
                textShadow: "0 0 20px #00FF41",
              }}
            >
              {yesOdds}%
            </span>
          </div>

          {/* NO Side */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              backgroundColor: "rgba(255, 0, 85, 0.1)",
              border: "2px solid #FF0055",
              padding: "20px",
            }}
          >
            <span
              style={{
                color: "#FF0055",
                fontSize: "20px",
                marginBottom: "8px",
                fontWeight: "bold",
              }}
            >
              NO
            </span>
            <span
              style={{
                color: "#FF0055",
                fontSize: "48px",
                fontWeight: "bold",
                textShadow: "0 0 20px #FF0055",
              }}
            >
              {noOdds}%
            </span>
          </div>
        </div>

        {/* Footer Stats */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: "auto",
            paddingTop: "16px",
            borderTop: "1px solid #333",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ color: "#666", fontSize: "16px" }}>POOL:</span>
            <span
              style={{
                color: "#FFD700",
                fontSize: "24px",
                fontWeight: "bold",
                textShadow: "0 0 10px rgba(255,215,0,0.5)",
              }}
            >
              {pool} SOL
            </span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              color: "#666",
              fontSize: "14px",
            }}
          >
            <span>POWERED BY</span>
            <span style={{ color: "#9945FF" }}>SOLANA</span>
          </div>
        </div>

        {/* Corner decorations */}
        <div
          style={{
            position: "absolute",
            top: "20px",
            left: "20px",
            width: "20px",
            height: "20px",
            borderLeft: "3px solid #00FF41",
            borderTop: "3px solid #00FF41",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "20px",
            right: "20px",
            width: "20px",
            height: "20px",
            borderRight: "3px solid #00FF41",
            borderTop: "3px solid #00FF41",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "20px",
            left: "20px",
            width: "20px",
            height: "20px",
            borderLeft: "3px solid #00FF41",
            borderBottom: "3px solid #00FF41",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "20px",
            right: "20px",
            width: "20px",
            height: "20px",
            borderRight: "3px solid #00FF41",
            borderBottom: "3px solid #00FF41",
          }}
        />
      </div>
    ),
    {
      width: 800,
      height: 480,
    }
  );
}
