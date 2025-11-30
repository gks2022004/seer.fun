"use client";

import dynamic from "next/dynamic";
import { useWallet } from "@solana/wallet-adapter-react";

// Dynamically import WalletMultiButton to avoid hydration issues
const WalletMultiButton = dynamic(
  async () => (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false }
);

export default function WalletButton() {
  const { connected } = useWallet();

  return (
    <div className="wallet-button-wrapper">
      <WalletMultiButton
        style={{
          backgroundColor: connected ? "#1a1a1a" : "#1a1a1a",
          color: "#ffffff",
          border: "1px solid #00FF41",
          fontFamily: "var(--font-vt323), monospace",
          fontSize: "14px",
          padding: "8px 16px",
          borderRadius: "0",
          height: "auto",
          transition: "all 0.2s ease",
        }}
      />
      <style jsx global>{`
        .wallet-adapter-button-trigger {
          background-color: #1a1a1a !important;
        }
        .wallet-adapter-modal-wrapper {
          background-color: rgba(5, 5, 5, 0.95) !important;
        }
        .wallet-adapter-modal-container {
          background-color: #0a0a0a !important;
          border: 2px solid #00ff41 !important;
          border-radius: 0 !important;
        }
        .wallet-adapter-modal-title {
          color: #00ff41 !important;
          font-family: var(--font-vt323), monospace !important;
        }
        .wallet-adapter-modal-list li {
          background-color: #1a1a1a !important;
          border: 1px solid #333 !important;
        }
        .wallet-adapter-modal-list li:hover {
          border-color: #00ff41 !important;
        }
        .wallet-adapter-button {
          font-family: var(--font-vt323), monospace !important;
          color: #ffffff !important;
        }
        .wallet-adapter-button-start-icon {
          color: #ffffff !important;
        }
      `}</style>
    </div>
  );
}