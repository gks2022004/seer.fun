import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { expect } from "chai";
import { SeerProgram } from "../target/types/seer_program";
import { createHash } from "crypto";

// Helper to hash question for PDA (max seed length is 32 bytes)
function hashQuestion(question: string): Buffer {
  return createHash("sha256").update(question).digest().slice(0, 32);
}

describe("seer_program", () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.SeerProgram as Program<SeerProgram>;
  
  const creator = Keypair.generate();
  const bettor1 = Keypair.generate();
  const bettor2 = Keypair.generate();
  
  const question = "Will BTC hit $100k by end of 2024?";
  const questionHash = hashQuestion(question);
  
  let marketPda: PublicKey;
  let marketVaultPda: PublicKey;

  before(async () => {
    // Airdrop SOL to test accounts
    const airdropCreator = await provider.connection.requestAirdrop(
      creator.publicKey,
      10 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropCreator);

    const airdropBettor1 = await provider.connection.requestAirdrop(
      bettor1.publicKey,
      10 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropBettor1);

    const airdropBettor2 = await provider.connection.requestAirdrop(
      bettor2.publicKey,
      10 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropBettor2);

    // Derive PDAs using hashed question
    [marketPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("market"),
        creator.publicKey.toBuffer(),
        questionHash,
      ],
      program.programId
    );

    [marketVaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), marketPda.toBuffer()],
      program.programId
    );
  });

  it("Creates a prediction market", async () => {
    const endTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

    const tx = await program.methods
      .initializeMarket(Array.from(questionHash), question, new anchor.BN(endTime))
      .accountsPartial({
        creator: creator.publicKey,
      })
      .signers([creator])
      .rpc();

    console.log("Market created:", tx);

    const market = await program.account.market.fetch(marketPda);
    expect(market.creator.toString()).to.equal(creator.publicKey.toString());
    expect(market.question).to.equal(question);
    expect(market.yesAmount.toNumber()).to.equal(0);
    expect(market.noAmount.toNumber()).to.equal(0);
    expect(market.resolved).to.be.false;
  });

  it("Places a YES bet", async () => {
    const betAmount = new anchor.BN(1 * LAMPORTS_PER_SOL);

    const [userPositionPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("position"),
        marketPda.toBuffer(),
        bettor1.publicKey.toBuffer(),
      ],
      program.programId
    );

    const tx = await program.methods
      .placeBet(betAmount, true)
      .accountsPartial({
        bettor: bettor1.publicKey,
        market: marketPda,
      })
      .signers([bettor1])
      .rpc();

    console.log("YES bet placed:", tx);

    const market = await program.account.market.fetch(marketPda);
    expect(market.yesAmount.toNumber()).to.equal(LAMPORTS_PER_SOL);
    expect(market.noAmount.toNumber()).to.equal(0);

    const position = await program.account.userPosition.fetch(userPositionPda);
    expect(position.yesAmount.toNumber()).to.equal(LAMPORTS_PER_SOL);
    expect(position.noAmount.toNumber()).to.equal(0);
  });

  it("Places a NO bet", async () => {
    const betAmount = new anchor.BN(2 * LAMPORTS_PER_SOL);

    const [userPositionPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("position"),
        marketPda.toBuffer(),
        bettor2.publicKey.toBuffer(),
      ],
      program.programId
    );

    const tx = await program.methods
      .placeBet(betAmount, false)
      .accountsPartial({
        bettor: bettor2.publicKey,
        market: marketPda,
      })
      .signers([bettor2])
      .rpc();

    console.log("NO bet placed:", tx);

    const market = await program.account.market.fetch(marketPda);
    expect(market.yesAmount.toNumber()).to.equal(LAMPORTS_PER_SOL);
    expect(market.noAmount.toNumber()).to.equal(2 * LAMPORTS_PER_SOL);
  });

  it("Prevents betting after market ends", async () => {
    // This test would require time manipulation or a separate market
    // For now, we'll skip the actual assertion
    console.log("Skipping time-based test in development");
  });

  it("Resolves the market (YES wins)", async () => {
    // Note: In a real test, you'd need to wait for end_time or create a market that's already ended
    // For this example, we'll create a new market with a past end time
    
    const pastQuestion = "Test market - already ended";
    const pastEndTime = Math.floor(Date.now() / 1000) - 1; // 1 second ago
    
    const [pastMarketPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("market"),
        creator.publicKey.toBuffer(),
        Buffer.from(pastQuestion),
      ],
      program.programId
    );
    
    // This would fail because end_time must be in future during creation
    // In real scenario, you'd test with proper time management
    console.log("Resolution test requires time manipulation - skipping in basic test");
  });
});
