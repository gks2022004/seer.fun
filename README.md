# Seer.fun

A decentralized prediction market platform built on Solana with AI-powered resolution and native Twitter/X integration via Solana Blinks.

## Overview

Seer.fun enables users to create and participate in prediction markets directly from Twitter. Users can bet on real-world events using SOL, with outcomes intelligently resolved using AI-powered analysis from Perplexity, then confirmed by market creators.

## Features

- **AI-Powered Resolution**: Markets are resolved using Perplexity AI that analyzes real-world data and provides resolution suggestions with confidence scores
- **Prediction Markets**: Create yes/no markets on any topic with customizable end times
- **Solana Blinks**: Place bets directly from Twitter/X without leaving the app
- **On-chain Settlement**: All bets and payouts are handled by Solana smart contracts
- **Shareable Markets**: Generate Blink URLs to share markets on social media
- **Professional Charts**: Real-time odds visualization with interactive charting

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS, Recharts
- **Blockchain**: Solana, Anchor Framework
- **AI Resolution**: Perplexity API (Sonar model with real-time web search)
- **Wallet**: Solana Wallet Adapter (Phantom, Solflare, etc.)
- **Actions**: Solana Actions / Blinks

## Project Structure

```
seer.fun/
├── src/
│   ├── app/                    # Next.js app router pages
│   │   ├── api/
│   │   │   ├── actions/        # Blink API endpoints
│   │   │   └── ai/suggest/     # AI resolution API
│   │   ├── dashboard/          # Market dashboard pages
│   │   └── market/             # Market detail pages
│   ├── components/             # React components
│   ├── hooks/                  # Custom React hooks
│   └── lib/                    # Utility functions and Solana helpers
│       ├── perplexity.ts       # AI resolution service
│       └── seer-program.ts     # Program IDL and types
├── anchor/
│   ├── programs/seer_program/  # Solana smart contract (Rust)
│   └── tests/                  # Contract tests
└── public/                     # Static assets
```

## Smart Contract

The Seer program is deployed on Solana Devnet:

```
Program ID: BwGjxxo2jjAE1aACq4L74L2WzaLjFrxuvvbTMxHyrKbS
```

### Instructions

| Instruction | Description |
|-------------|-------------|
| `initialize_market` | Create a new prediction market |
| `place_bet` | Place a YES or NO bet on a market |
| `resolve_market` | Resolve a market (creator only, can use AI suggestion) |
| `claim_winnings` | Claim winnings from a resolved market |

### Resolution Flow

All markets use AI-assisted resolution:

1. Market creator clicks "Get AI Suggestion"
2. Perplexity AI analyzes real-world data via web search
3. AI returns suggested outcome (YES/NO) with confidence % and reasoning
4. Creator reviews and confirms the resolution
5. Smart contract settles and winners can claim

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
PERPLEXITY_API_KEY=your_perplexity_api_key_here
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

### AI Resolution

```
POST /api/ai/suggest               - Get AI resolution suggestion
     Body: { question: string, endTime: number }
     Returns: { suggestedOutcome: boolean, confidence: number, reasoning: string, sources: string[] }
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

When a market ends, the creator can:

1. Click "Get AI Suggestion" 
2. Review AI analysis with:
   - Suggested outcome (YES/NO)
   - Confidence percentage
   - Reasoning with sources
3. Accept AI suggestion or manually choose outcome
4. Confirm resolution on-chain

The AI uses Perplexity's real-time web search to analyze current events and provide data-backed recommendations.

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


