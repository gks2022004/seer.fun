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

describe("Seer Program - AI-Powered Prediction Markets", () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.SeerProgram as Program<SeerProgram>;
  
  const creator = Keypair.generate();
  const bettor1 = Keypair.generate();
  const bettor2 = Keypair.generate();
  const bettor3 = Keypair.generate();
  
  // Main market for most tests
  const question = "Will BTC hit $100k by end of 2024?";
  const questionHash = hashQuestion(question);
  
  let marketPda: PublicKey;
  let marketVaultPda: PublicKey;

  before(async () => {
    console.log("\n🚀 Setting up test environment...\n");
    
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

    const airdropBettor3 = await provider.connection.requestAirdrop(
      bettor3.publicKey,
      10 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropBettor3);

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

    console.log("Program ID:", program.programId.toString());
    console.log("Creator:", creator.publicKey.toString());
    console.log("Market PDA:", marketPda.toString());
    console.log("Vault PDA:", marketVaultPda.toString());
  });

  describe("Market Creation", () => {
    it("Creates a prediction market successfully", async () => {
      const endTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

      const tx = await program.methods
        .initializeMarket(Array.from(questionHash), question, new anchor.BN(endTime))
        .accountsPartial({
          creator: creator.publicKey,
        })
        .signers([creator])
        .rpc();

      console.log("✅ Market created - Transaction:", tx);

      const market = await program.account.market.fetch(marketPda);
      expect(market.creator.toString()).to.equal(creator.publicKey.toString());
      expect(market.question).to.equal(question);
      expect(market.yesAmount.toNumber()).to.equal(0);
      expect(market.noAmount.toNumber()).to.equal(0);
      expect(market.resolved).to.be.false;
      expect(market.totalBettors).to.equal(0);
      expect(market.endTime.toNumber()).to.equal(endTime);
    });

    it("Fails to create market with question too long", async () => {
      const longQuestion = "x".repeat(201); // Exceeds 200 char limit
      const longQuestionHash = hashQuestion(longQuestion);
      const endTime = Math.floor(Date.now() / 1000) + 3600;

      try {
        await program.methods
          .initializeMarket(Array.from(longQuestionHash), longQuestion, new anchor.BN(endTime))
          .accountsPartial({
            creator: creator.publicKey,
          })
          .signers([creator])
          .rpc();
        
        expect.fail("Should have thrown error for question too long");
      } catch (err) {
        expect(err.toString()).to.include("QuestionTooLong");
      }
    });

    it("Fails to create market with past end time", async () => {
      const pastQuestion = "Past market test";
      const pastQuestionHash = hashQuestion(pastQuestion);
      const pastEndTime = Math.floor(Date.now() / 1000) - 1; // Past time

      try {
        await program.methods
          .initializeMarket(Array.from(pastQuestionHash), pastQuestion, new anchor.BN(pastEndTime))
          .accountsPartial({
            creator: creator.publicKey,
          })
          .signers([creator])
          .rpc();
        
        expect.fail("Should have thrown error for invalid end time");
      } catch (err) {
        expect(err.toString()).to.include("InvalidEndTime");
      }
    });
  });

  describe("Betting", () => {
    it("Places a YES bet successfully", async () => {
      const betAmount = new anchor.BN(1 * LAMPORTS_PER_SOL);

      const [userPositionPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("position"),
          marketPda.toBuffer(),
          bettor1.publicKey.toBuffer(),
        ],
        program.programId
      );

      const vaultBalanceBefore = await provider.connection.getBalance(marketVaultPda);

      const tx = await program.methods
        .placeBet(betAmount, true)
        .accountsPartial({
          bettor: bettor1.publicKey,
          market: marketPda,
        })
        .signers([bettor1])
        .rpc();

      console.log("YES bet placed - Transaction:", tx);

      const market = await program.account.market.fetch(marketPda);
      expect(market.yesAmount.toNumber()).to.equal(LAMPORTS_PER_SOL);
      expect(market.noAmount.toNumber()).to.equal(0);
      expect(market.totalBettors).to.equal(1);

      const position = await program.account.userPosition.fetch(userPositionPda);
      expect(position.bettor.toString()).to.equal(bettor1.publicKey.toString());
      expect(position.market.toString()).to.equal(marketPda.toString());
      expect(position.yesAmount.toNumber()).to.equal(LAMPORTS_PER_SOL);
      expect(position.noAmount.toNumber()).to.equal(0);
      expect(position.claimed).to.be.false;

      const vaultBalanceAfter = await provider.connection.getBalance(marketVaultPda);
      expect(vaultBalanceAfter - vaultBalanceBefore).to.equal(LAMPORTS_PER_SOL);
    });

    it("Places a NO bet successfully", async () => {
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

      console.log("NO bet placed - Transaction:", tx);

      const market = await program.account.market.fetch(marketPda);
      expect(market.yesAmount.toNumber()).to.equal(LAMPORTS_PER_SOL);
      expect(market.noAmount.toNumber()).to.equal(2 * LAMPORTS_PER_SOL);
      expect(market.totalBettors).to.equal(2);

      const position = await program.account.userPosition.fetch(userPositionPda);
      expect(position.yesAmount.toNumber()).to.equal(0);
      expect(position.noAmount.toNumber()).to.equal(2 * LAMPORTS_PER_SOL);
    });

    it("Allows multiple bets from same user", async () => {
      const betAmount = new anchor.BN(0.5 * LAMPORTS_PER_SOL);

      const [userPositionPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("position"),
          marketPda.toBuffer(),
          bettor1.publicKey.toBuffer(),
        ],
        program.programId
      );

      // Bettor1 places another YES bet
      await program.methods
        .placeBet(betAmount, true)
        .accountsPartial({
          bettor: bettor1.publicKey,
          market: marketPda,
        })
        .signers([bettor1])
        .rpc();

      const market = await program.account.market.fetch(marketPda);
      expect(market.yesAmount.toNumber()).to.equal(1.5 * LAMPORTS_PER_SOL);
      expect(market.totalBettors).to.equal(2); // Should not increment

      const position = await program.account.userPosition.fetch(userPositionPda);
      expect(position.yesAmount.toNumber()).to.equal(1.5 * LAMPORTS_PER_SOL);
    });

    it("Allows user to bet on both sides", async () => {
      const betAmount = new anchor.BN(0.3 * LAMPORTS_PER_SOL);

      const [userPositionPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("position"),
          marketPda.toBuffer(),
          bettor3.publicKey.toBuffer(),
        ],
        program.programId
      );

      // Bettor3 bets on YES
      await program.methods
        .placeBet(betAmount, true)
        .accountsPartial({
          bettor: bettor3.publicKey,
          market: marketPda,
        })
        .signers([bettor3])
        .rpc();

      // Bettor3 bets on NO
      await program.methods
        .placeBet(betAmount, false)
        .accountsPartial({
          bettor: bettor3.publicKey,
          market: marketPda,
        })
        .signers([bettor3])
        .rpc();

      const position = await program.account.userPosition.fetch(userPositionPda);
      expect(position.yesAmount.toNumber()).to.equal(0.3 * LAMPORTS_PER_SOL);
      expect(position.noAmount.toNumber()).to.equal(0.3 * LAMPORTS_PER_SOL);

      const market = await program.account.market.fetch(marketPda);
      expect(market.totalBettors).to.equal(3);
    });

    it("Fails to place bet with zero amount", async () => {
      try {
        await program.methods
          .placeBet(new anchor.BN(0), true)
          .accountsPartial({
            bettor: bettor1.publicKey,
            market: marketPda,
          })
          .signers([bettor1])
          .rpc();
        
        expect.fail("Should have thrown error for zero bet");
      } catch (err) {
        expect(err.toString()).to.include("InvalidBetAmount");
      }
    });
  });

  describe("Market Resolution & Claiming", () => {
    // Create a separate market for resolution tests
    let resolveMarketPda: PublicKey;
    let resolveMarketVaultPda: PublicKey;
    const resolveQuestion = "Will AI resolve this market correctly?";
    const resolveQuestionHash = hashQuestion(resolveQuestion);

    before(async () => {
      [resolveMarketPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("market"),
          creator.publicKey.toBuffer(),
          resolveQuestionHash,
        ],
        program.programId
      );

      [resolveMarketVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), resolveMarketPda.toBuffer()],
        program.programId
      );

      // Create market with short end time (10 seconds)
      const endTime = Math.floor(Date.now() / 1000) + 10;
      await program.methods
        .initializeMarket(Array.from(resolveQuestionHash), resolveQuestion, new anchor.BN(endTime))
        .accountsPartial({
          creator: creator.publicKey,
        })
        .signers([creator])
        .rpc();

      // Place bets: YES = 3 SOL, NO = 2 SOL
      await program.methods
        .placeBet(new anchor.BN(3 * LAMPORTS_PER_SOL), true)
        .accountsPartial({
          bettor: bettor1.publicKey,
          market: resolveMarketPda,
        })
        .signers([bettor1])
        .rpc();

      await program.methods
        .placeBet(new anchor.BN(2 * LAMPORTS_PER_SOL), false)
        .accountsPartial({
          bettor: bettor2.publicKey,
          market: resolveMarketPda,
        })
        .signers([bettor2])
        .rpc();

      console.log("\n⏳ Waiting 11 seconds for market to end...");
      await new Promise(resolve => setTimeout(resolve, 11000));
    });

    it("Resolves market with YES outcome", async () => {
      const tx = await program.methods
        .resolveMarket(true) // YES wins
        .accountsPartial({
          creator: creator.publicKey,
          market: resolveMarketPda,
        })
        .signers([creator])
        .rpc();

      console.log("✅ Market resolved - Transaction:", tx);

      const market = await program.account.market.fetch(resolveMarketPda);
      expect(market.resolved).to.be.true;
      expect(market.outcome).to.be.true; // YES won
    });

    it("Allows YES bettor to claim winnings", async () => {
      const [userPositionPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("position"),
          resolveMarketPda.toBuffer(),
          bettor1.publicKey.toBuffer(),
        ],
        program.programId
      );

      const bettorBalanceBefore = await provider.connection.getBalance(bettor1.publicKey);

      const tx = await program.methods
        .claimWinnings()
        .accountsPartial({
          bettor: bettor1.publicKey,
          market: resolveMarketPda,
        })
        .signers([bettor1])
        .rpc();

      console.log("✅ Winnings claimed - Transaction:", tx);

      const bettorBalanceAfter = await provider.connection.getBalance(bettor1.publicKey);
      const position = await program.account.userPosition.fetch(userPositionPda);
      
      expect(position.claimed).to.be.true;
      
      // YES bettor bet 3 SOL, total pool is 5 SOL, should get all 5 SOL back
      // (3/3) * 5 = 5 SOL
      const expectedWinnings = 5 * LAMPORTS_PER_SOL;
      const actualWinnings = bettorBalanceAfter - bettorBalanceBefore;
      
      // Allow small difference for transaction fees
      expect(actualWinnings).to.be.closeTo(expectedWinnings, 0.01 * LAMPORTS_PER_SOL);
    });

    it("Prevents NO bettor from claiming (they lost)", async () => {
      try {
        await program.methods
          .claimWinnings()
          .accountsPartial({
            bettor: bettor2.publicKey,
            market: resolveMarketPda,
          })
          .signers([bettor2])
          .rpc();
        
        expect.fail("Should have thrown error for losing position");
      } catch (err) {
        expect(err.toString()).to.include("NoWinningPosition");
      }
    });

    it("Prevents double claiming", async () => {
      try {
        await program.methods
          .claimWinnings()
          .accountsPartial({
            bettor: bettor1.publicKey,
            market: resolveMarketPda,
          })
          .signers([bettor1])
          .rpc();
        
        expect.fail("Should have thrown error for already claimed");
      } catch (err) {
        expect(err.toString()).to.include("AlreadyClaimed");
      }
    });

    it("Prevents non-creator from resolving market", async () => {
      // Create another market
      const unauthorizedQuestion = "Unauthorized resolution test";
      const unauthorizedHash = hashQuestion(unauthorizedQuestion);
      const [unauthorizedMarketPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("market"),
          creator.publicKey.toBuffer(),
          unauthorizedHash,
        ],
        program.programId
      );

      const endTime = Math.floor(Date.now() / 1000) + 1;
      await program.methods
        .initializeMarket(Array.from(unauthorizedHash), unauthorizedQuestion, new anchor.BN(endTime))
        .accountsPartial({
          creator: creator.publicKey,
        })
        .signers([creator])
        .rpc();

      await new Promise(resolve => setTimeout(resolve, 2000));

      try {
        await program.methods
          .resolveMarket(true)
          .accountsPartial({
            creator: bettor1.publicKey, // Not the creator!
            market: unauthorizedMarketPda,
          })
          .signers([bettor1])
          .rpc();
        
        expect.fail("Should have thrown error for unauthorized");
      } catch (err) {
        expect(err.toString()).to.include("Unauthorized");
      }
    });
  });

  describe("Edge Cases", () => {
    it("Prevents betting on resolved market", async () => {
      // Create and immediately resolve a market
      const resolvedQuestion = "Already resolved market";
      const resolvedHash = hashQuestion(resolvedQuestion);
      const [resolvedMarketPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("market"),
          creator.publicKey.toBuffer(),
          resolvedHash,
        ],
        program.programId
      );

      const endTime = Math.floor(Date.now() / 1000) + 1;
      await program.methods
        .initializeMarket(Array.from(resolvedHash), resolvedQuestion, new anchor.BN(endTime))
        .accountsPartial({
          creator: creator.publicKey,
        })
        .signers([creator])
        .rpc();

      await new Promise(resolve => setTimeout(resolve, 2000));

      await program.methods
        .resolveMarket(true)
        .accountsPartial({
          creator: creator.publicKey,
          market: resolvedMarketPda,
        })
        .signers([creator])
        .rpc();

      try {
        await program.methods
          .placeBet(new anchor.BN(1 * LAMPORTS_PER_SOL), true)
          .accountsPartial({
            bettor: bettor1.publicKey,
            market: resolvedMarketPda,
          })
          .signers([bettor1])
          .rpc();
        
        expect.fail("Should have thrown error for betting on resolved market");
      } catch (err) {
        expect(err.toString()).to.include("MarketResolved");
      }
    });

    it("Prevents resolving market before end time", async () => {
      const futureQuestion = "Future market";
      const futureHash = hashQuestion(futureQuestion);
      const [futureMarketPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("market"),
          creator.publicKey.toBuffer(),
          futureHash,
        ],
        program.programId
      );

      const endTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      await program.methods
        .initializeMarket(Array.from(futureHash), futureQuestion, new anchor.BN(endTime))
        .accountsPartial({
          creator: creator.publicKey,
        })
        .signers([creator])
        .rpc();

      try {
        await program.methods
          .resolveMarket(true)
          .accountsPartial({
            creator: creator.publicKey,
            market: futureMarketPda,
          })
          .signers([creator])
          .rpc();
        
        expect.fail("Should have thrown error for resolving before end time");
      } catch (err) {
        expect(err.toString()).to.include("MarketNotEnded");
      }
    });
  });

  after(() => {
    console.log("\n✨ All tests completed successfully!\n");
  });
});
