import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { SEER_PROGRAM_ID, type MarketAccount } from "./seer-program";
import * as borsh from "borsh";

// RPC endpoint (use devnet for testing, mainnet for production)
export const SOLANA_RPC = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";

export const connection = new Connection(SOLANA_RPC, "confirmed");

// Program ID as PublicKey
export const programId = new PublicKey(SEER_PROGRAM_ID);

// Derive Market Vault PDA
export function getMarketVaultPDA(marketPubkey: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), marketPubkey.toBuffer()],
    programId
  );
}

// Derive User Position PDA
export function getUserPositionPDA(
  marketPubkey: PublicKey,
  bettorPubkey: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("position"), marketPubkey.toBuffer(), bettorPubkey.toBuffer()],
    programId
  );
}

// Market account borsh schema for deserialization
class MarketSchema {
  creator: Uint8Array;
  question: string;
  yes_amount: bigint;
  no_amount: bigint;
  resolved: boolean;
  outcome: boolean;
  end_time: bigint;
  bump: number;
  total_bettors: number;

  constructor(props: {
    creator: Uint8Array;
    question: string;
    yes_amount: bigint;
    no_amount: bigint;
    resolved: boolean;
    outcome: boolean;
    end_time: bigint;
    bump: number;
    total_bettors: number;
  }) {
    this.creator = props.creator;
    this.question = props.question;
    this.yes_amount = props.yes_amount;
    this.no_amount = props.no_amount;
    this.resolved = props.resolved;
    this.outcome = props.outcome;
    this.end_time = props.end_time;
    this.bump = props.bump;
    this.total_bettors = props.total_bettors;
  }
}

// Manually decode market account data
export async function fetchMarketAccount(
  marketPubkey: PublicKey
): Promise<MarketAccount | null> {
  try {
    const accountInfo = await connection.getAccountInfo(marketPubkey);
    if (!accountInfo || !accountInfo.data) {
      return null;
    }

    const data = accountInfo.data;
    
    // Skip 8-byte discriminator
    let offset = 8;

    // Creator (32 bytes)
    const creator = new PublicKey(data.slice(offset, offset + 32)).toBase58();
    offset += 32;

    // Question (4 bytes length prefix + string)
    const questionLen = data.readUInt32LE(offset);
    offset += 4;
    const question = data.slice(offset, offset + questionLen).toString("utf-8");
    offset += questionLen;

    // Yes amount (8 bytes u64)
    const yesAmount = data.readBigUInt64LE(offset);
    offset += 8;

    // No amount (8 bytes u64)
    const noAmount = data.readBigUInt64LE(offset);
    offset += 8;

    // Resolved (1 byte bool)
    const resolved = data[offset] === 1;
    offset += 1;

    // Outcome (1 byte bool)
    const outcome = data[offset] === 1;
    offset += 1;

    // End time (8 bytes i64)
    const endTime = data.readBigInt64LE(offset);
    offset += 8;

    // Bump (1 byte)
    const bump = data[offset];
    offset += 1;

    // Total bettors (4 bytes u32)
    const totalBettors = data.readUInt32LE(offset);

    return {
      creator,
      question,
      yesAmount,
      noAmount,
      resolved,
      outcome,
      endTime,
      bump,
      totalBettors,
    };
  } catch (error) {
    console.error("Error fetching market account:", error);
    return null;
  }
}

// Create place_bet instruction
export function createPlaceBetInstruction(
  bettor: PublicKey,
  market: PublicKey,
  amount: number, // in lamports
  betYes: boolean
): TransactionInstruction {
  const [marketVault] = getMarketVaultPDA(market);
  const [userPosition] = getUserPositionPDA(market, bettor);

  // place_bet discriminator: [222, 62, 67, 220, 63, 166, 126, 33]
  const discriminator = Buffer.from([222, 62, 67, 220, 63, 166, 126, 33]);

  // Serialize arguments
  const amountBuffer = Buffer.alloc(8);
  amountBuffer.writeBigUInt64LE(BigInt(amount));

  const betYesBuffer = Buffer.from([betYes ? 1 : 0]);

  const data = Buffer.concat([discriminator, amountBuffer, betYesBuffer]);

  return new TransactionInstruction({
    keys: [
      { pubkey: bettor, isSigner: true, isWritable: true },
      { pubkey: market, isSigner: false, isWritable: true },
      { pubkey: marketVault, isSigner: false, isWritable: true },
      { pubkey: userPosition, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId,
    data,
  });
}

// Create transaction for placing a bet
export async function createBetTransaction(
  bettor: PublicKey,
  market: PublicKey,
  amountSol: number,
  betYes: boolean
): Promise<Transaction> {
  const transaction = new Transaction();
  
  const amountLamports = Math.floor(amountSol * LAMPORTS_PER_SOL);
  const instruction = createPlaceBetInstruction(bettor, market, amountLamports, betYes);
  
  transaction.add(instruction);
  
  // Get latest blockhash
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.lastValidBlockHeight = lastValidBlockHeight;
  transaction.feePayer = bettor;

  return transaction;
}

// Format SOL amount for display
export function formatSol(lamports: bigint | number): string {
  const sol = Number(lamports) / LAMPORTS_PER_SOL;
  return sol.toLocaleString("en-US", { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  });
}

// Calculate odds percentage
export function calculateOdds(yesAmount: bigint, noAmount: bigint): { yes: number; no: number } {
  const total = Number(yesAmount) + Number(noAmount);
  if (total === 0) {
    return { yes: 50, no: 50 };
  }
  const yesPercent = Math.round((Number(yesAmount) / total) * 100);
  return { yes: yesPercent, no: 100 - yesPercent };
}

// Time remaining formatter
export function formatTimeRemaining(endTime: bigint): string {
  const now = Math.floor(Date.now() / 1000);
  const end = Number(endTime);
  const diff = end - now;

  if (diff <= 0) return "ENDED";

  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const minutes = Math.floor((diff % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
