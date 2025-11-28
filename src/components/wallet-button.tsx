"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export default function WalletButton() {
  const { connected, publicKey } = useWallet();

  return (
    <div className="wallet-button-wrapper">
      <WalletMultiButton
        style={{
          backgroundColor: connected ? "#00FF41" : "#1a1a1a",
          color: connected ? "#050505" : "#00FF41",
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
        }
      `}</style>
    </div>
  );
}
