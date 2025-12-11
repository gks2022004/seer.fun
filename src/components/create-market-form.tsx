"use client";

import { useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useRouter } from "next/navigation";
import { SEER_PROGRAM_ID } from "@/lib/seer-program";

// Treasury address to receive market creation fees
const TREASURY_ADDRESS = "BfxvKDgh3nWpM5JX2NF7M7MJLirJkuWHMM3n5JohStx";
const MARKET_CREATION_FEE = 0.01; // SOL

// Hash function using Web Crypto API (browser-compatible)
async function hashQuestion(question: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const data = encoder.encode(question);
  // Create a proper ArrayBuffer from the Uint8Array
  const buffer = new ArrayBuffer(data.length);
  new Uint8Array(buffer).set(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  return new Uint8Array(hashBuffer).slice(0, 32);
}

// Helper to show time until end date
function getTimeUntil(endDate: Date): string {
  const now = new Date();
  const diff = endDate.getTime() - now.getTime();
  
  if (diff <= 0) return "ended";
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  
  if (months > 0) return `in ${months} month${months > 1 ? 's' : ''}`;
  if (weeks > 0) return `in ${weeks} week${weeks > 1 ? 's' : ''}`;
  if (days > 0) return `in ${days} day${days > 1 ? 's' : ''}`;
  if (hours > 0) return `in ${hours} hour${hours > 1 ? 's' : ''}`;
  
  const minutes = Math.floor(diff / (1000 * 60));
  return `in ${minutes} minute${minutes > 1 ? 's' : ''}`;
}

export default function CreateMarketForm() {
  const router = useRouter();
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  
  const [question, setQuestion] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Quick duration presets
  const durationPresets = [
    { label: "1 Hour", hours: 1 },
    { label: "6 Hours", hours: 6 },
    { label: "1 Day", hours: 24 },
    { label: "3 Days", hours: 72 },
    { label: "1 Week", hours: 168 },
    { label: "2 Weeks", hours: 336 },
    { label: "1 Month", hours: 720 },
    { label: "Custom", hours: 0 },
  ];

  // Apply preset duration
  const applyPreset = (hours: number, label: string) => {
    if (hours === 0) {
      setSelectedPreset("Custom");
      return;
    }
    
    const futureDate = new Date(Date.now() + hours * 60 * 60 * 1000);
    setEndDate(futureDate.toISOString().split("T")[0]);
    setEndTime(futureDate.toTimeString().slice(0, 5));
    setSelectedPreset(label);
  };

  // Handle custom date/time change
  const handleDateChange = (value: string) => {
    setEndDate(value);
    setSelectedPreset("Custom");
  };

  const handleTimeChange = (value: string) => {
    setEndTime(value);
    setSelectedPreset("Custom");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!publicKey) {
      setError("Please connect your wallet first");
      return;
    }

    if (!question.trim()) {
      setError("Please enter a question");
      return;
    }

    if (question.length > 200) {
      setError("Question must be 200 characters or less");
      return;
    }

    if (!endDate || !endTime) {
      setError("Please set an end date and time");
      return;
    }

    const endTimestamp = Math.floor(new Date(`${endDate}T${endTime}`).getTime() / 1000);
    const now = Math.floor(Date.now() / 1000);

    if (endTimestamp <= now) {
      setError("End time must be in the future");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Create market_id hash from question (browser-compatible)
      const marketIdHash = await hashQuestion(question);

      const programId = new PublicKey(SEER_PROGRAM_ID);

      // Derive Market PDA
      const [marketPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("market"),
          publicKey.toBuffer(),
          Buffer.from(marketIdHash),
        ],
        programId
      );

      // Derive Vault PDA
      const [vaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), marketPda.toBuffer()],
        programId
      );

      // Build instruction data
      // initialize_market discriminator: [35, 35, 189, 193, 155, 48, 170, 203]
      const discriminator = Buffer.from([35, 35, 189, 193, 155, 48, 170, 203]);
      
      // market_id: [u8; 32]
      const marketIdBuffer = Buffer.from(marketIdHash);
      
      // question: String (4 bytes length + utf8 bytes)
      const questionBytes = Buffer.from(question, "utf-8");
      const questionLenBuffer = Buffer.alloc(4);
      questionLenBuffer.writeUInt32LE(questionBytes.length);
      
      // end_time: i64
      const endTimeBuffer = Buffer.alloc(8);
      endTimeBuffer.writeBigInt64LE(BigInt(endTimestamp));

      const data = Buffer.concat([
        discriminator,
        marketIdBuffer,
        questionLenBuffer,
        questionBytes,
        endTimeBuffer,
      ]);

      // Treasury account to receive creation fees
      const treasuryPubkey = new PublicKey(TREASURY_ADDRESS);
      
      const transaction = new Transaction().add({
        keys: [
          { pubkey: publicKey, isSigner: true, isWritable: true },
          { pubkey: marketPda, isSigner: false, isWritable: true },
          { pubkey: vaultPda, isSigner: false, isWritable: true },
          { pubkey: treasuryPubkey, isSigner: false, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        programId,
        data,
      });

      // Get latest blockhash
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.lastValidBlockHeight = lastValidBlockHeight;
      transaction.feePayer = publicKey;

      console.log("Program ID:", programId.toBase58());
      console.log("Market PDA:", marketPda.toBase58());
      console.log("Vault PDA:", vaultPda.toBase58());
      console.log("Treasury:", treasuryPubkey.toBase58());
      console.log("Creator:", publicKey.toBase58());
      console.log("Creation fee:", MARKET_CREATION_FEE, "SOL");

      // Simulate transaction first to catch errors
      try {
        const simulation = await connection.simulateTransaction(transaction);
        if (simulation.value.err) {
          console.error("Simulation error:", simulation.value.err);
          console.error("Logs:", simulation.value.logs);
          throw new Error(`Simulation failed: ${JSON.stringify(simulation.value.err)}`);
        }
        console.log("Simulation successful:", simulation.value.logs);
      } catch (simError) {
        console.error("Simulation failed:", simError);
        // Check if program exists
        const programInfo = await connection.getAccountInfo(programId);
        if (!programInfo) {
          throw new Error("Program not found on this network. Make sure you're connected to devnet and the program is deployed.");
        }
        throw simError;
      }

      const signature = await sendTransaction(transaction, connection);
      
      // Wait for confirmation
      await connection.confirmTransaction(signature, "confirmed");

      // Redirect to the new market
      router.push(`/dashboard/market/${marketPda.toBase58()}`);
    } catch (e) {
      console.error("Error creating market:", e);
      
      // Parse error message
      let errorMessage = "Failed to create market";
      if (e instanceof Error && e.message) {
        if (e.message.includes("Simulation failed")) {
          errorMessage = e.message;
        } else if (e.message.includes("User rejected")) {
          errorMessage = "Transaction cancelled by user";
        } else if (e.message.includes("insufficient")) {
          errorMessage = "Insufficient SOL balance. Get devnet SOL from faucet.solana.com";
        } else if (e.message.includes("not found on this network")) {
          errorMessage = e.message;
        } else {
          errorMessage = `Error: ${e.message}`;
        }
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Calculate minimum date (today)
  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="font-vt323 text-2xl text-matrix text-glow-green mb-2">
          CREATE PREDICTION MARKET
        </h1>
        <p className="text-gray-400 font-mono text-sm">
          Create a yes/no question for others to bet on
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Question Input */}
        <div className="space-y-2">
          <label className="block font-mono text-sm text-gray-400">
            PREDICTION QUESTION
          </label>
          <div className="relative">
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Will BTC hit $100k by end of 2024?"
              maxLength={200}
              rows={3}
              className="w-full bg-void border-2 border-gray-700 focus:border-matrix text-white font-mono p-4 resize-none transition-colors outline-none"
              disabled={loading}
            />
            <span className={`absolute bottom-2 right-2 text-xs font-mono ${
              question.length > 180 ? "text-cyber" : "text-gray-500"
            }`}>
              {question.length}/200
            </span>
          </div>
          <p className="text-gray-500 text-xs font-mono">
            Ask a clear yes/no question that can be resolved definitively
          </p>
        </div>

        {/* AI Resolution Info */}
        <div className="border border-matrix/30 bg-matrix/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl"></span>
            <span className="font-mono text-sm text-matrix">AI-POWERED RESOLUTION</span>
          </div>
          <p className="text-gray-400 text-xs font-mono">
            After your market ends, our AI agent will analyze real-world data to suggest the outcome. 
            You confirm the resolution to finalize it.
          </p>
        </div>

        {/* End Date/Time */}
        <div className="space-y-4">
          <label className="block font-mono text-sm text-gray-400">
            MARKET END TIME
          </label>
          
          {/* Quick Presets */}
          <div className="grid grid-cols-4 gap-2">
            {durationPresets.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => applyPreset(preset.hours, preset.label)}
                disabled={loading}
                className={`py-2 px-3 text-xs font-mono border transition-all ${
                  selectedPreset === preset.label
                    ? "border-matrix bg-matrix/20 text-matrix"
                    : "border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Custom Date/Time Inputs */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block font-mono text-xs text-gray-500">
                DATE
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => handleDateChange(e.target.value)}
                min={today}
                className="w-full bg-void border-2 border-gray-700 focus:border-matrix text-white font-mono p-3 transition-colors outline-none [color-scheme:dark]"
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <label className="block font-mono text-xs text-gray-500">
                TIME
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => handleTimeChange(e.target.value)}
                className="w-full bg-void border-2 border-gray-700 focus:border-matrix text-white font-mono p-3 transition-colors outline-none [color-scheme:dark]"
                disabled={loading}
              />
            </div>
          </div>

          {/* Selected Time Display */}
          {endDate && endTime && (
            <div className="flex items-center gap-2 text-sm font-mono">
              <span className="text-gray-500">Betting ends:</span>
              <span className="text-matrix">
                {new Date(`${endDate}T${endTime}`).toLocaleString(undefined, {
                  weekday: 'short',
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
              <span className="text-gray-600">
                ({getTimeUntil(new Date(`${endDate}T${endTime}`))})
              </span>
            </div>
          )}
        </div>

        {/* Preview */}
        {question && (
          <div className="border border-matrix/30 bg-matrix/5 p-4">
            <div className="text-xs font-mono text-matrix mb-2">PREVIEW</div>
            <div className="font-mono text-white">{question}</div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="border border-cyber bg-cyber/10 p-4 text-cyber font-mono text-sm">
            ⚠️ {error}
          </div>
        )}

        {/* Creation Fee Info */}
        <div className="border border-gray-700 bg-gray-900/50 p-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-sm text-gray-400">CREATION FEE</span>
            <span className="font-mono text-sm text-matrix">{MARKET_CREATION_FEE} SOL</span>
          </div>
          <p className="text-gray-500 text-xs font-mono mt-1">
            A small fee to prevent spam and support the platform
          </p>
        </div>

        {/* Submit */}
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 border border-gray-700 text-gray-400 font-mono py-3 hover:border-gray-500 hover:text-white transition-colors"
            disabled={loading}
          >
            CANCEL
          </button>
          <button
            type="submit"
            disabled={loading || !publicKey}
            className="flex-1 btn-glitch py-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="animate-pulse">CREATING...</span>
            ) : !publicKey ? (
              "CONNECT WALLET"
            ) : (
              "CREATE MARKET"
            )}
          </button>
        </div>

        {!publicKey && (
          <p className="text-center text-gray-500 text-sm font-mono">
            Connect your wallet to create a market
          </p>
        )}
      </form>
    </div>
  );
}
