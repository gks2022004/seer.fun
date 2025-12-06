// Pyth price feed IDs for Solana Devnet
// See: https://www.pyth.network/developers/price-feed-ids

export interface PythFeed {
  id: string;
  name: string;
  symbol: string;
  description: string;
}

export const PYTH_FEEDS: Record<string, PythFeed> = {
  "BTC/USD": {
    id: "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
    name: "Bitcoin",
    symbol: "BTC/USD",
    description: "Bitcoin price in USD"
  },
  "ETH/USD": {
    id: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
    name: "Ethereum",
    symbol: "ETH/USD",
    description: "Ethereum price in USD"
  },
  "SOL/USD": {
    id: "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
    name: "Solana",
    symbol: "SOL/USD",
    description: "Solana price in USD"
  },
  "USDC/USD": {
    id: "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a",
    name: "USD Coin",
    symbol: "USDC/USD",
    description: "USDC price in USD"
  },
  "USDT/USD": {
    id: "0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b",
    name: "Tether",
    symbol: "USDT/USD",
    description: "USDT price in USD"
  },
};

export const PYTH_FEEDS_ARRAY = Object.values(PYTH_FEEDS);

// Pyth price update account for devnet
export const PYTH_PRICE_SERVICE_DEVNET = "https://hermes.pyth.network";
