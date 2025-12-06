import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair } from "@solana/web3.js";
import { SeerProgram } from "../target/types/seer_program";
import { expect } from "chai";

describe("Seer Program - Pyth Price Markets", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.SeerProgram as Program<SeerProgram>;
  const creator = provider.wallet;

  console.log("Program ID:", program.programId.toString());
  console.log("Creator:", creator.publicKey.toString());

  it("Creates an Event Market", async () => {
    const marketId = Keypair.generate().publicKey.toBytes().slice(0, 32);
    const question = "Will Bitcoin reach $150k by end of 2025?";
    const endTime = new anchor.BN(Date.now() / 1000 + 86400 * 30); // 30 days from now

    const [marketPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("market"), creator.publicKey.toBuffer(), Buffer.from(marketId)],
      program.programId
    );

    const [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), marketPda.toBuffer()],
      program.programId
    );

    console.log("Creating Event Market...");
    console.log("Market PDA:", marketPda.toString());

    const tx = await program.methods
      .initializeMarket(
        Array.from(marketId),
        question,
        endTime,
        { event: {} }, // MarketType::Event
        null, // No Pyth feed for event markets
        null  // No target price for event markets
      )
      .accountsPartial({
        creator: creator.publicKey,
        market: marketPda,
        marketVault: vaultPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    console.log("✅ Event Market created:", tx);

    // Verify market account
    const market = await program.account.market.fetch(marketPda);
    expect(market.creator.toString()).to.equal(creator.publicKey.toString());
    expect(market.question).to.equal(question);
    expect("event" in market.marketType).to.be.true;
    expect(market.pythFeedId).to.be.null;
    expect(market.targetPrice).to.be.null;

    console.log("Market Type:", market.marketType);
    console.log("Question:", market.question);
  });

  it("Creates a Price Market with Pyth", async () => {
    const marketId = Keypair.generate().publicKey.toBytes().slice(0, 32);
    const question = "Will BTC be above $100,000 on Dec 31, 2025?";
    const endTime = new anchor.BN(Date.now() / 1000 + 86400 * 7); // 7 days from now
    
    // BTC/USD Pyth feed ID for devnet
    const pythFeedId = "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43";
    const targetPrice = new anchor.BN(10000000); // $100,000.00 in cents

    const [marketPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("market"), creator.publicKey.toBuffer(), Buffer.from(marketId)],
      program.programId
    );

    const [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), marketPda.toBuffer()],
      program.programId
    );

    console.log("Creating Price Market...");
    console.log("Market PDA:", marketPda.toString());
    console.log("Pyth Feed:", pythFeedId);
    console.log("Target Price: $100,000");

    const tx = await program.methods
      .initializeMarket(
        Array.from(marketId),
        question,
        endTime,
        { price: {} }, // MarketType::Price
        pythFeedId,    // Pyth feed ID
        targetPrice    // Target price
      )
      .accountsPartial({
        creator: creator.publicKey,
        market: marketPda,
        marketVault: vaultPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    console.log("✅ Price Market created:", tx);

    // Verify market account
    const market = await program.account.market.fetch(marketPda);
    expect(market.creator.toString()).to.equal(creator.publicKey.toString());
    expect(market.question).to.equal(question);
    expect("price" in market.marketType).to.be.true;
    expect(market.pythFeedId).to.not.be.null;
    expect(market.targetPrice?.toString()).to.equal(targetPrice.toString());

    console.log("Market Type:", market.marketType);
    console.log("Question:", market.question);
    console.log("Pyth Feed ID:", market.pythFeedId);
    console.log("Target Price:", market.targetPrice?.toString());
  });

  it("Cannot create Price Market without Pyth params", async () => {
    const marketId = Keypair.generate().publicKey.toBytes().slice(0, 32);
    const question = "Will SOL reach $300?";
    const endTime = new anchor.BN(Date.now() / 1000 + 86400 * 7);

    const [marketPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("market"), creator.publicKey.toBuffer(), Buffer.from(marketId)],
      program.programId
    );

    const [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), marketPda.toBuffer()],
      program.programId
    );

    try {
      await program.methods
        .initializeMarket(
          Array.from(marketId),
          question,
          endTime,
          { price: {} }, // Price market
          null,          // Missing Pyth feed
          null           // Missing target price
        )
        .accountsPartial({
          creator: creator.publicKey,
          market: marketPda,
          marketVault: vaultPda,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      throw new Error("Should have failed");
    } catch (err: any) {
      console.log("✅ Correctly rejected price market without Pyth params");
      expect(err.toString()).to.include("MissingPythFeed");
    }
  });
});
