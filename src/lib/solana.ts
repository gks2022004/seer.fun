import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import { SEER_PROGRAM_ID, type MarketAccount } from "./seer-program";

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
    offset += 4;

    // Market type (1 byte enum)
    const marketTypeVariant = data[offset];
    offset += 1;
    const marketType = marketTypeVariant === 0 ? { event: {} } : { price: {} };

    // Pyth feed ID (1 byte option + 32 bytes if Some)
    const hasPythFeed = data[offset] === 1;
    offset += 1;
    let pythFeedId: string | null = null;
    if (hasPythFeed) {
      const feedIdBytes = data.slice(offset, offset + 32);
      pythFeedId = "0x" + Buffer.from(feedIdBytes).toString("hex");
      offset += 32;
    }

    // Target price (1 byte option + 8 bytes i64 if Some)
    const hasTargetPrice = data[offset] === 1;
    offset += 1;
    let targetPrice: bigint | null = null;
    if (hasTargetPrice) {
      targetPrice = data.readBigInt64LE(offset);
    }

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
      marketType,
      pythFeedId,
      targetPrice,
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

// Create VersionedTransaction for placing a bet (required by Dialect Blinks)
export async function createBetVersionedTransaction(
  bettor: PublicKey,
  market: PublicKey,
  amountSol: number,
  betYes: boolean
): Promise<VersionedTransaction> {
  const amountLamports = Math.floor(amountSol * LAMPORTS_PER_SOL);
  const instruction = createPlaceBetInstruction(bettor, market, amountLamports, betYes);
  
  // Add priority fee instructions for faster confirmation
  const computeUnitPrice = ComputeBudgetProgram.setComputeUnitPrice({
    microLamports: 50000, // Priority fee
  });
  
  const computeUnitLimit = ComputeBudgetProgram.setComputeUnitLimit({
    units: 200000, // Compute units
  });
  
  // Get latest blockhash with "confirmed" commitment for faster confirmation
  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  
  // Create a transaction message with priority fee instructions first
  const message = new TransactionMessage({
    payerKey: bettor,
    recentBlockhash: blockhash,
    instructions: [computeUnitPrice, computeUnitLimit, instruction],
  }).compileToV0Message();
  
  // Create and return a versioned transaction
  return new VersionedTransaction(message);
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

// Create claim_winnings instruction
export function createClaimWinningsInstruction(
  bettor: PublicKey,
  market: PublicKey
): TransactionInstruction {
  const [marketVault] = getMarketVaultPDA(market);
  const [userPosition] = getUserPositionPDA(market, bettor);

  // claim_winnings discriminator: [161, 215, 24, 59, 14, 236, 242, 221]
  const discriminator = Buffer.from([161, 215, 24, 59, 14, 236, 242, 221]);

  return new TransactionInstruction({
    keys: [
      { pubkey: bettor, isSigner: true, isWritable: true },
      { pubkey: market, isSigner: false, isWritable: false },
      { pubkey: marketVault, isSigner: false, isWritable: true },
      { pubkey: userPosition, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId,
    data: discriminator,
  });
}

// Create claim winnings transaction
export async function createClaimTransaction(
  bettor: PublicKey,
  market: PublicKey
): Promise<Transaction> {
  const transaction = new Transaction();
  const instruction = createClaimWinningsInstruction(bettor, market);
  transaction.add(instruction);

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.lastValidBlockHeight = lastValidBlockHeight;
  transaction.feePayer = bettor;

  return transaction;
}

// Create resolve_market instruction
export function createResolveMarketInstruction(
  creator: PublicKey,
  market: PublicKey,
  outcome: boolean // true = YES wins, false = NO wins
): TransactionInstruction {
  // resolve_market discriminator: [155, 23, 80, 173, 46, 74, 23, 239]
  const discriminator = Buffer.from([155, 23, 80, 173, 46, 74, 23, 239]);
  
  // Serialize outcome (1 byte bool)
  const outcomeBuffer = Buffer.from([outcome ? 1 : 0]);
  
  const data = Buffer.concat([discriminator, outcomeBuffer]);

  return new TransactionInstruction({
    keys: [
      { pubkey: creator, isSigner: true, isWritable: false },
      { pubkey: market, isSigner: false, isWritable: true },
    ],
    programId,
    data,
  });
}

// Create resolve market transaction
export async function createResolveMarketTransaction(
  creator: PublicKey,
  market: PublicKey,
  outcome: boolean
): Promise<Transaction> {
  const transaction = new Transaction();
  const instruction = createResolveMarketInstruction(creator, market, outcome);
  transaction.add(instruction);

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.lastValidBlockHeight = lastValidBlockHeight;
  transaction.feePayer = creator;

  return transaction;
}

// Create auto-resolve price market instruction
export function createAutoResolvePriceMarketInstruction(
  caller: PublicKey,
  market: PublicKey,
  pythPriceAccount: PublicKey
): TransactionInstruction {
  // resolve_price_market discriminator: [174, 136, 131, 161, 205, 54, 38, 95]
  const discriminator = Buffer.from([174, 136, 131, 161, 205, 54, 38, 95]);

  return new TransactionInstruction({
    keys: [
      { pubkey: caller, isSigner: true, isWritable: false },
      { pubkey: market, isSigner: false, isWritable: true },
      { pubkey: pythPriceAccount, isSigner: false, isWritable: false },
    ],
    programId,
    data: discriminator,
  });
}

// Create auto-resolve price market transaction
export async function createAutoResolvePriceMarketTransaction(
  caller: PublicKey,
  market: PublicKey,
  pythFeedId: string
): Promise<Transaction> {
  const transaction = new Transaction();

  // Add compute budget for Pyth oracle operations
  const computeBudget = ComputeBudgetProgram.setComputeUnitLimit({
    units: 400_000,
  });
  transaction.add(computeBudget);

  // Add priority fee
  const priorityFee = ComputeBudgetProgram.setComputeUnitPrice({
    microLamports: 100_000,
  });
  transaction.add(priorityFee);

  // Pyth Solana Receiver program on devnet
  // Note: This is the new Pyth Pull Oracle program
  const pythSolanaReceiverProgramId = new PublicKey("rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ");
  
  // Derive price update account from feed ID
  const feedIdBuffer = Buffer.from(pythFeedId.replace("0x", ""), "hex");
  
  // The price update account PDA
  const [priceUpdateAccount] = PublicKey.findProgramAddressSync(
    [Buffer.from("price_update"), feedIdBuffer],
    pythSolanaReceiverProgramId
  );

  console.log("Pyth Feed ID:", pythFeedId);
  console.log("Price Update Account:", priceUpdateAccount.toBase58());

  // Check if price update account exists
  try {
    const accountInfo = await connection.getAccountInfo(priceUpdateAccount);
    if (!accountInfo) {
      throw new Error(
        `Pyth price feed not found on devnet. ` +
        `Price feeds need to be posted to the Pyth Receiver program first. ` +
        `For devnet testing, you may need to use a price feed that has been recently updated, ` +
        `or use the Pyth Hermes API to push price updates.`
      );
    }
    console.log("Price update account exists, owner:", accountInfo.owner.toBase58());
  } catch (error) {
    console.error("Error checking price update account:", error);
    throw error;
  }

  const instruction = createAutoResolvePriceMarketInstruction(
    caller,
    market,
    priceUpdateAccount
  );
  transaction.add(instruction);

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.lastValidBlockHeight = lastValidBlockHeight;
  transaction.feePayer = caller;

  return transaction;
}

// Fetch current Pyth price for a feed
export async function fetchPythPrice(pythFeedId: string): Promise<{ price: number; expo: number } | null> {
  try {
    const pythProgramId = new PublicKey("gSbePebfvPy7tRqimPoVecS2UsBvYv46ynrzWocc92s");
    const feedIdBuffer = Buffer.from(pythFeedId.replace("0x", ""), "hex");
    const [pythPriceAccount] = PublicKey.findProgramAddressSync(
      [feedIdBuffer],
      pythProgramId
    );

    const accountInfo = await connection.getAccountInfo(pythPriceAccount);
    if (!accountInfo || !accountInfo.data) {
      return null;
    }

    // Simplified Pyth price parsing (real implementation would use @pythnetwork/client)
    // For now, return a placeholder
    return { price: 0, expo: -8 };
  } catch (error) {
    console.error("Error fetching Pyth price:", error);
    return null;
  }
}
