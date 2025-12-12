import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { expect } from "chai";
import { SeerProgram } from "../target/types/seer_program";
import { createHash } from "crypto";


describe("Initialize Config", () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.SeerProgram as Program<SeerProgram>;

  it("Initializes program config with treasury", async () => {
    // Your treasury wallet address
    const treasuryAddress = new PublicKey("BfxvKDgh3nWpM5JX2NF7M7MJLirJkuWHMM3n5JohStx");

    // Derive the config PDA
    const [configPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      program.programId
    );

    console.log("\n🔧 Initializing Program Config...");
    console.log("Program ID:", program.programId.toString());
    console.log("Config PDA:", configPda.toString());
    console.log("Authority (your wallet):", provider.wallet.publicKey.toString());
    console.log("Treasury:", treasuryAddress.toString());

    try {
      // Check if config already exists
      try {
        const existingConfig = await program.account.programConfig.fetch(configPda);
        console.log("\n⚠️  Config already exists!");
        console.log("Existing Authority:", existingConfig.authority.toString());
        console.log("Existing Treasury:", existingConfig.treasury.toString());
        return; // Skip initialization if already exists
      } catch (e) {
        // Config doesn't exist, proceed with initialization
        console.log("\n✓ Config PDA is available, proceeding with initialization...");
      }

      // Initialize the config
      const tx = await program.methods
        .initializeConfig(treasuryAddress)
        .accountsPartial({
          authority: provider.wallet.publicKey,
        })
        .rpc();

      console.log("\n✅ Config initialized successfully!");
      console.log("Transaction signature:", tx);

      // Fetch and display the config
      const configAccount = await program.account.programConfig.fetch(configPda);
      console.log("\n📋 Config Details:");
      console.log("Authority:", configAccount.authority.toString());
      console.log("Treasury:", configAccount.treasury.toString());
      console.log("Bump:", configAccount.bump);

      expect(configAccount.authority.toString()).to.equal(provider.wallet.publicKey.toString());
      expect(configAccount.treasury.toString()).to.equal(treasuryAddress.toString());

    } catch (error) {
      console.error("\n❌ Error initializing config:", error);
      throw error;
    }
  });

  it("Updates treasury address", async () => {
    // Use the same treasury for now (you can change this later)
    const newTreasuryAddress = new PublicKey("BfxvKDgh3nWpM5JX2NF7M7MJLirJkuWHMM3n5JohStx");

    const [configPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      program.programId
    );

    console.log("\n🔄 Updating Treasury Address...");
    console.log("New Treasury:", newTreasuryAddress.toString());

    try {
      const tx = await program.methods
        .updateTreasury(newTreasuryAddress)
        .accountsPartial({
          authority: provider.wallet.publicKey,
          config: configPda,
        })
        .rpc();

      console.log("\n✅ Treasury updated successfully!");
      console.log("Transaction signature:", tx);

      // Verify the update
      const configAccount = await program.account.programConfig.fetch(configPda);
      console.log("\n📋 Updated Treasury:", configAccount.treasury.toString());

      expect(configAccount.treasury.toString()).to.equal(newTreasuryAddress.toString());

    } catch (error) {
      console.error("\n❌ Error updating treasury:", error);
      throw error;
    }
  });
});