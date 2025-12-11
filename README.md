# Seer.fun

A decentralized prediction market platform built on Solana with native Twitter/X integration via Solana Blinks.

## Overview

Seer.fun enables users to create and participate in prediction markets directly from Twitter. Users can bet on real-world events using SOL, with outcomes determined either manually by market creators or automatically via Pyth price oracles.

## Features

- **Prediction Markets**: Create yes/no markets on any topic with customizable end times
- **Solana Blinks**: Place bets directly from Twitter/X without leaving the app
- **Pyth Oracle Integration**: Price-based markets auto-resolve using real-time oracle data
- **On-chain Settlement**: All bets and payouts are handled by Solana smart contracts
- **Shareable Markets**: Generate Blink URLs to share markets on social media

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Blockchain**: Solana, Anchor Framework
- **Oracles**: Pyth Network (for price markets)
- **Wallet**: Solana Wallet Adapter (Phantom, Solflare)
- **Actions**: Solana Actions / Blinks

## Project Structure

```
seer.fun/
├── src/
│   ├── app/                    # Next.js app router pages
│   │   ├── api/actions/        # Blink API endpoints
│   │   ├── dashboard/          # Market dashboard pages
│   │   └── market/             # Market detail pages
│   ├── components/             # React components
│   ├── hooks/                  # Custom React hooks
│   └── lib/                    # Utility functions and Solana helpers
├── anchor/
│   ├── programs/seer_program/  # Solana smart contract (Rust)
│   └── tests/                  # Contract tests
└── public/                     # Static assets
```

## Smart Contract

The Seer program is deployed on Solana Devnet:

```
Program ID: 5d9gPjzVJsPaVhw1LvSj8RBr2MXSca12mTQoh63CmN74
```

### Instructions

| Instruction | Description |
|-------------|-------------|
| `initialize_market` | Create a new prediction market |
| `place_bet` | Place a YES or NO bet on a market |
| `resolve_market` | Manually resolve a market (creator only) |
| `resolve_price_market` | Auto-resolve using Pyth oracle data |
| `claim_winnings` | Claim winnings from a resolved market |

### Market Types

1. **Event Markets**: Resolved manually by the market creator
2. **Price Markets**: Automatically resolved based on Pyth price feeds

## Getting Started

### Prerequisites

- Node.js 18+
- Solana CLI
- Anchor CLI (for smart contract development)
- A Solana wallet (Phantom recommended)

### Installation

```bash
# Clone the repository
git clone https://github.com/gks2022004/seer.fun.git
cd seer.fun

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your RPC URL
```

### Environment Variables

```bash
NEXT_PUBLIC_SOLANA_RPC=https://api.devnet.solana.com
```

### Development

```bash
# Start the development server
npm run dev

# Build for production
npm run build

# Run linting
npm run lint
```

### Smart Contract Development

```bash
cd anchor

# Build the program
anchor build

# Run tests
anchor test

# Deploy to devnet
anchor deploy
```

## API Endpoints

### Blink Actions

```
GET  /api/actions/bet/[marketId]  - Get Blink metadata for a market
POST /api/actions/bet/[marketId]  - Create bet transaction
```

### Actions JSON

```
GET  /.well-known/actions.json    - Blink discovery manifest
```

## Usage

### Creating a Market

1. Connect your Solana wallet
2. Navigate to Dashboard > Create Market
3. Enter your prediction question
4. Set the market end time
5. Submit the transaction

### Placing Bets

**Via Web App:**
1. Browse markets on the dashboard
2. Select a market
3. Choose YES or NO
4. Enter bet amount and confirm

**Via Twitter/X:**
1. Paste the market Blink URL in a tweet
2. The Blink card will render with betting options
3. Click to place bet directly from Twitter

### Resolving Markets

**Event Markets:**
- Only the creator can resolve after end time
- Choose YES or NO as the winning outcome

**Price Markets:**
- Anyone can trigger auto-resolution after end time
- Pyth oracle determines outcome based on target price

### Claiming Winnings

After a market resolves, winning bettors can claim their share of the pool proportional to their bet size.

## Deployment

### Frontend (Vercel)

```bash
npm run build
# Deploy to Vercel via Git integration or CLI
```

### Smart Contract (Mainnet)

```bash
solana config set --url mainnet-beta
cd anchor
anchor build
anchor deploy --provider.cluster mainnet
```

## Testing

```bash
# Frontend tests
npm run test

# Smart contract tests
cd anchor
anchor test
```


