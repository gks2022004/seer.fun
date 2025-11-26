// Auto-generated IDL type for seer_program
// This will be replaced by the actual generated types after `anchor build`

export type SeerProgram = {
  version: "0.1.0";
  name: "seer_program";
  instructions: [
    {
      name: "initializeMarket";
      accounts: [
        { name: "creator"; isMut: true; isSigner: true },
        { name: "market"; isMut: true; isSigner: false },
        { name: "marketVault"; isMut: false; isSigner: false },
        { name: "systemProgram"; isMut: false; isSigner: false }
      ];
      args: [
        { name: "question"; type: "string" },
        { name: "endTime"; type: "i64" }
      ];
    },
    {
      name: "placeBet";
      accounts: [
        { name: "bettor"; isMut: true; isSigner: true },
        { name: "market"; isMut: true; isSigner: false },
        { name: "marketVault"; isMut: true; isSigner: false },
        { name: "userPosition"; isMut: true; isSigner: false },
        { name: "systemProgram"; isMut: false; isSigner: false }
      ];
      args: [
        { name: "amount"; type: "u64" },
        { name: "betYes"; type: "bool" }
      ];
    },
    {
      name: "resolveMarket";
      accounts: [
        { name: "creator"; isMut: false; isSigner: true },
        { name: "market"; isMut: true; isSigner: false }
      ];
      args: [{ name: "outcome"; type: "bool" }];
    },
    {
      name: "claimWinnings";
      accounts: [
        { name: "bettor"; isMut: true; isSigner: true },
        { name: "market"; isMut: false; isSigner: false },
        { name: "marketVault"; isMut: true; isSigner: false },
        { name: "userPosition"; isMut: true; isSigner: false },
        { name: "systemProgram"; isMut: false; isSigner: false }
      ];
      args: [];
    }
  ];
  accounts: [
    {
      name: "market";
      type: {
        kind: "struct";
        fields: [
          { name: "creator"; type: "publicKey" },
          { name: "question"; type: "string" },
          { name: "yesAmount"; type: "u64" },
          { name: "noAmount"; type: "u64" },
          { name: "resolved"; type: "bool" },
          { name: "outcome"; type: "bool" },
          { name: "endTime"; type: "i64" },
          { name: "bump"; type: "u8" },
          { name: "totalBettors"; type: "u32" }
        ];
      };
    },
    {
      name: "userPosition";
      type: {
        kind: "struct";
        fields: [
          { name: "bettor"; type: "publicKey" },
          { name: "market"; type: "publicKey" },
          { name: "yesAmount"; type: "u64" },
          { name: "noAmount"; type: "u64" },
          { name: "claimed"; type: "bool" },
          { name: "bump"; type: "u8" }
        ];
      };
    }
  ];
  events: [
    {
      name: "MarketCreated";
      fields: [
        { name: "market"; type: "publicKey"; index: false },
        { name: "creator"; type: "publicKey"; index: false },
        { name: "question"; type: "string"; index: false },
        { name: "endTime"; type: "i64"; index: false }
      ];
    },
    {
      name: "BetPlaced";
      fields: [
        { name: "market"; type: "publicKey"; index: false },
        { name: "bettor"; type: "publicKey"; index: false },
        { name: "amount"; type: "u64"; index: false },
        { name: "betYes"; type: "bool"; index: false },
        { name: "totalYes"; type: "u64"; index: false },
        { name: "totalNo"; type: "u64"; index: false }
      ];
    },
    {
      name: "MarketResolved";
      fields: [
        { name: "market"; type: "publicKey"; index: false },
        { name: "outcome"; type: "bool"; index: false },
        { name: "totalPool"; type: "u64"; index: false }
      ];
    },
    {
      name: "WinningsClaimed";
      fields: [
        { name: "market"; type: "publicKey"; index: false },
        { name: "bettor"; type: "publicKey"; index: false },
        { name: "amount"; type: "u64"; index: false }
      ];
    }
  ];
  errors: [
    { code: 6000; name: "QuestionTooLong"; msg: "Question exceeds maximum length of 200 characters" },
    { code: 6001; name: "InvalidEndTime"; msg: "End time must be in the future" },
    { code: 6002; name: "InvalidBetAmount"; msg: "Bet amount must be greater than 0" },
    { code: 6003; name: "MarketResolved"; msg: "Market has already been resolved" },
    { code: 6004; name: "MarketAlreadyResolved"; msg: "Market has already been resolved" },
    { code: 6005; name: "MarketEnded"; msg: "Betting period has ended" },
    { code: 6006; name: "MarketNotEnded"; msg: "Market has not ended yet" },
    { code: 6007; name: "MarketNotResolved"; msg: "Market has not been resolved yet" },
    { code: 6008; name: "AlreadyClaimed"; msg: "Winnings have already been claimed" },
    { code: 6009; name: "NoWinningPosition"; msg: "You do not have a winning position" },
    { code: 6010; name: "Unauthorized"; msg: "Unauthorized action" }
  ];
};

export const IDL: SeerProgram = {
  version: "0.1.0",
  name: "seer_program",
  instructions: [
    {
      name: "initializeMarket",
      accounts: [
        { name: "creator", isMut: true, isSigner: true },
        { name: "market", isMut: true, isSigner: false },
        { name: "marketVault", isMut: false, isSigner: false },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [
        { name: "question", type: "string" },
        { name: "endTime", type: "i64" },
      ],
    },
    {
      name: "placeBet",
      accounts: [
        { name: "bettor", isMut: true, isSigner: true },
        { name: "market", isMut: true, isSigner: false },
        { name: "marketVault", isMut: true, isSigner: false },
        { name: "userPosition", isMut: true, isSigner: false },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [
        { name: "amount", type: "u64" },
        { name: "betYes", type: "bool" },
      ],
    },
    {
      name: "resolveMarket",
      accounts: [
        { name: "creator", isMut: false, isSigner: true },
        { name: "market", isMut: true, isSigner: false },
      ],
      args: [{ name: "outcome", type: "bool" }],
    },
    {
      name: "claimWinnings",
      accounts: [
        { name: "bettor", isMut: true, isSigner: true },
        { name: "market", isMut: false, isSigner: false },
        { name: "marketVault", isMut: true, isSigner: false },
        { name: "userPosition", isMut: true, isSigner: false },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [],
    },
  ],
  accounts: [
    {
      name: "market",
      type: {
        kind: "struct",
        fields: [
          { name: "creator", type: "publicKey" },
          { name: "question", type: "string" },
          { name: "yesAmount", type: "u64" },
          { name: "noAmount", type: "u64" },
          { name: "resolved", type: "bool" },
          { name: "outcome", type: "bool" },
          { name: "endTime", type: "i64" },
          { name: "bump", type: "u8" },
          { name: "totalBettors", type: "u32" },
        ],
      },
    },
    {
      name: "userPosition",
      type: {
        kind: "struct",
        fields: [
          { name: "bettor", type: "publicKey" },
          { name: "market", type: "publicKey" },
          { name: "yesAmount", type: "u64" },
          { name: "noAmount", type: "u64" },
          { name: "claimed", type: "bool" },
          { name: "bump", type: "u8" },
        ],
      },
    },
  ],
  events: [
    {
      name: "MarketCreated",
      fields: [
        { name: "market", type: "publicKey", index: false },
        { name: "creator", type: "publicKey", index: false },
        { name: "question", type: "string", index: false },
        { name: "endTime", type: "i64", index: false },
      ],
    },
    {
      name: "BetPlaced",
      fields: [
        { name: "market", type: "publicKey", index: false },
        { name: "bettor", type: "publicKey", index: false },
        { name: "amount", type: "u64", index: false },
        { name: "betYes", type: "bool", index: false },
        { name: "totalYes", type: "u64", index: false },
        { name: "totalNo", type: "u64", index: false },
      ],
    },
    {
      name: "MarketResolved",
      fields: [
        { name: "market", type: "publicKey", index: false },
        { name: "outcome", type: "bool", index: false },
        { name: "totalPool", type: "u64", index: false },
      ],
    },
    {
      name: "WinningsClaimed",
      fields: [
        { name: "market", type: "publicKey", index: false },
        { name: "bettor", type: "publicKey", index: false },
        { name: "amount", type: "u64", index: false },
      ],
    },
  ],
  errors: [
    { code: 6000, name: "QuestionTooLong", msg: "Question exceeds maximum length of 200 characters" },
    { code: 6001, name: "InvalidEndTime", msg: "End time must be in the future" },
    { code: 6002, name: "InvalidBetAmount", msg: "Bet amount must be greater than 0" },
    { code: 6003, name: "MarketResolved", msg: "Market has already been resolved" },
    { code: 6004, name: "MarketAlreadyResolved", msg: "Market has already been resolved" },
    { code: 6005, name: "MarketEnded", msg: "Betting period has ended" },
    { code: 6006, name: "MarketNotEnded", msg: "Market has not ended yet" },
    { code: 6007, name: "MarketNotResolved", msg: "Market has not been resolved yet" },
    { code: 6008, name: "AlreadyClaimed", msg: "Winnings have already been claimed" },
    { code: 6009, name: "NoWinningPosition", msg: "You do not have a winning position" },
    { code: 6010, name: "Unauthorized", msg: "Unauthorized action" },
  ],
};
