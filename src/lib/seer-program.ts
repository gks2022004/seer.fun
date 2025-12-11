// Seer Program IDL - Simplified (AI-Resolved Markets)
export const SEER_PROGRAM_ID = "5XrAkDuDwvsqVxMkVETukYdAjuACH3poCAcP4hZJoKSQ";

export const SEER_IDL = {
  address: "BwGjxxo2jjAE1aACq4L74L2WzaLjFrxuvvbTMxHyrKbS",
  metadata: {
    name: "seer_program",
    version: "0.1.0",
    spec: "0.1.0",
    description: "Seer.fun - AI-Powered Prediction Markets on Solana",
  },
  instructions: [
    {
      name: "claim_winnings",
      discriminator: [161, 215, 24, 59, 14, 236, 242, 221],
      accounts: [
        { name: "bettor", writable: true, signer: true },
        { name: "market" },
        {
          name: "market_vault",
          writable: true,
          pda: {
            seeds: [
              { kind: "const", value: [118, 97, 117, 108, 116] },
              { kind: "account", path: "market" },
            ],
          },
        },
        {
          name: "user_position",
          writable: true,
          pda: {
            seeds: [
              { kind: "const", value: [112, 111, 115, 105, 116, 105, 111, 110] },
              { kind: "account", path: "market" },
              { kind: "account", path: "bettor" },
            ],
          },
        },
        { name: "system_program", address: "11111111111111111111111111111111" },
      ],
      args: [],
    },
    {
      name: "initialize_market",
      discriminator: [35, 35, 189, 193, 155, 48, 170, 203],
      accounts: [
        { name: "creator", writable: true, signer: true },
        {
          name: "market",
          writable: true,
          pda: {
            seeds: [
              { kind: "const", value: [109, 97, 114, 107, 101, 116] },
              { kind: "account", path: "creator" },
              { kind: "arg", path: "market_id" },
            ],
          },
        },
        {
          name: "market_vault",
          pda: {
            seeds: [
              { kind: "const", value: [118, 97, 117, 108, 116] },
              { kind: "account", path: "market" },
            ],
          },
        },
        { name: "system_program", address: "11111111111111111111111111111111" },
      ],
      args: [
        { name: "_market_id", type: { array: ["u8", 32] } },
        { name: "question", type: "string" },
        { name: "end_time", type: "i64" },
      ],
    },
    {
      name: "place_bet",
      discriminator: [222, 62, 67, 220, 63, 166, 126, 33],
      accounts: [
        { name: "bettor", writable: true, signer: true },
        { name: "market", writable: true },
        {
          name: "market_vault",
          writable: true,
          pda: {
            seeds: [
              { kind: "const", value: [118, 97, 117, 108, 116] },
              { kind: "account", path: "market" },
            ],
          },
        },
        {
          name: "user_position",
          writable: true,
          pda: {
            seeds: [
              { kind: "const", value: [112, 111, 115, 105, 116, 105, 111, 110] },
              { kind: "account", path: "market" },
              { kind: "account", path: "bettor" },
            ],
          },
        },
        { name: "system_program", address: "11111111111111111111111111111111" },
      ],
      args: [
        { name: "amount", type: "u64" },
        { name: "bet_yes", type: "bool" },
      ],
    },
    {
      name: "resolve_market",
      discriminator: [155, 23, 80, 173, 46, 74, 23, 239],
      accounts: [
        { name: "creator", signer: true },
        { name: "market", writable: true },
      ],
      args: [{ name: "outcome", type: "bool" }],
    },
  ],
  accounts: [
    { name: "Market", discriminator: [219, 190, 213, 55, 0, 227, 198, 154] },
    { name: "UserPosition", discriminator: [251, 248, 209, 245, 83, 234, 17, 27] },
  ],
  types: [
    {
      name: "Market",
      type: {
        kind: "struct",
        fields: [
          { name: "creator", type: "pubkey" },
          { name: "question", type: "string" },
          { name: "yes_amount", type: "u64" },
          { name: "no_amount", type: "u64" },
          { name: "resolved", type: "bool" },
          { name: "outcome", type: "bool" },
          { name: "end_time", type: "i64" },
          { name: "bump", type: "u8" },
          { name: "total_bettors", type: "u32" },
        ],
      },
    },
    {
      name: "UserPosition",
      type: {
        kind: "struct",
        fields: [
          { name: "bettor", type: "pubkey" },
          { name: "market", type: "pubkey" },
          { name: "yes_amount", type: "u64" },
          { name: "no_amount", type: "u64" },
          { name: "claimed", type: "bool" },
          { name: "bump", type: "u8" },
        ],
      },
    },
  ],
} as const;

// Market account structure for parsing
export interface MarketAccount {
  creator: string;
  question: string;
  yesAmount: bigint;
  noAmount: bigint;
  resolved: boolean;
  outcome: boolean;
  endTime: bigint;
  bump: number;
  totalBettors: number;
}
