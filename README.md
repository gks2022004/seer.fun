# Seer.fun

A decentralized prediction market platform built on Solana, featuring AI-powered market resolution and native Twitter/X integration through Solana Blinks.

## Overview

Seer.fun is a prediction market platform that enables users to create and participate in markets on real-world events. The platform leverages Solana blockchain for on-chain settlement, Perplexity AI for intelligent market resolution, and Solana Blinks for seamless Twitter/X integration.

## Key Features

- **AI-Assisted Resolution**: Automated market resolution using Perplexity AI with real-time web search and confidence scoring
- **Decentralized Markets**: Creator-initiated yes/no prediction markets with customizable end times
- **Social Integration**: Direct betting from Twitter/X through Solana Blinks without leaving the platform
- **On-Chain Settlement**: Trustless bet settlement and payout distribution via Solana smart contracts
- **Real-Time Analytics**: Interactive charts displaying market odds and participation metrics

## Technology Stack

**Frontend**
- Next.js 14 (App Router)
- React with TypeScript
- Tailwind CSS
- Recharts for data visualization

**Blockchain**
- Solana (Devnet/Mainnet)
- Anchor Framework
- Solana Wallet Adapter

**AI & APIs**
- Perplexity API (Sonar model)
- Solana Actions/Blinks

## Architecture

```
seer.fun/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── actions/          # Solana Blink endpoints
│   │   │   └── ai/suggest/       # AI resolution service
│   │   ├── dashboard/            # Market management interface
│   │   └── market/               # Market detail views
│   ├── components/               # React components
│   ├── hooks/                    # Custom React hooks
│   └── lib/
│       ├── perplexity.ts         # AI resolution integration
│       └── seer-program.ts       # Program IDL and utilities
├── anchor/
│   ├── programs/seer_program/    # Rust smart contract
│   └── tests/                    # Contract test suite
└── public/                       # Static assets
```

## Smart Contract

**Program ID (Devnet)**: `BwGjxxo2jjAE1aACq4L74L2WzaLjFrxuvvbTMxHyrKbS`

### Contract Instructions

| Instruction | Description | Access |
|-------------|-------------|--------|
| `initialize_market` | Create a new prediction market | Public |
| `place_bet` | Place YES or NO bet on a market | Public |
| `resolve_market` | Resolve market outcome | Creator only |
| `claim_winnings` | Withdraw winnings from resolved market | Winners only |

### AI-Assisted Resolution Process

1. Market creator initiates AI suggestion request
2. Perplexity AI analyzes current real-world data via web search
3. AI returns recommendation with outcome, confidence score, and reasoning
4. Creator reviews and confirms or overrides the suggestion
5. Market resolves on-chain, enabling winner claims

## Installation

### Prerequisites

- Node.js 18 or higher
- Solana CLI
- Anchor CLI (for contract development)
- Solana-compatible wallet

### Setup

```bash
# Clone repository
git clone https://github.com/gks2022004/seer.fun.git
cd seer.fun

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
```

### Environment Configuration

Required environment variables:

```env
NEXT_PUBLIC_SOLANA_RPC=https://api.devnet.solana.com
PERPLEXITY_API_KEY=your_api_key
```

### Development Commands

```bash
# Start development server
npm run dev

# Production build
npm run build

# Code linting
npm run lint
```

### Smart Contract Development

```bash
cd anchor

# Compile program
anchor build

# Run test suite
anchor test

# Deploy to devnet
anchor deploy
```

## API Reference

### Blink Actions API

**Get Market Metadata**
```
GET /api/actions/bet/[marketId]
```

**Create Bet Transaction**
```
POST /api/actions/bet/[marketId]
Body: { account: string, amount: string }
```

### AI Resolution API

**Request Resolution Suggestion**
```
POST /api/ai/suggest
Body: { question: string, endTime: number }
Response: {
  suggestedOutcome: boolean,
  confidence: number,
  reasoning: string,
  sources: string[]
}
```

### Blink Discovery

```
GET /.well-known/actions.json
```

## Usage Guide

### Creating a Market

1. Connect Solana wallet to the application
2. Navigate to Dashboard and select "Create Market"
3. Define prediction question and set end time
4. Submit transaction and await confirmation

### Placing Bets

**Web Application**
1. Browse active markets on dashboard
2. Select target market and choose position (YES/NO)
3. Enter bet amount in SOL
4. Sign and submit transaction

**Twitter/X Integration**
1. Share market Blink URL on Twitter/X
2. Blink renders as interactive card with market details
3. Users bet directly from Twitter interface

### Resolving Markets

Creator workflow for ended markets:

1. Access market detail page
2. Request AI resolution suggestion
3. Review AI-generated analysis including outcome, confidence, and supporting evidence
4. Confirm or manually override the suggested outcome
5. Submit resolution transaction

### Claiming Winnings

Winners claim proportional share of total bet pool based on their contribution to the winning side.

## Deployment

### Frontend Deployment (Vercel)

```bash
npm run build
vercel deploy
```

### Smart Contract Deployment (Mainnet)

```bash
solana config set --url mainnet-beta
cd anchor
anchor build
anchor deploy --provider.cluster mainnet
```

Update program ID in frontend configuration after deployment.

## Testing

```bash
# Frontend test suite
npm run test

# Smart contract tests
cd anchor
anchor test
```


## Support

For issues and questions, please open an issue on the GitHub repository.


