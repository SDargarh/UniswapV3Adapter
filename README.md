# Arbitrum Fork Setup & Deployment Guide

This guide walks you through setting up a local Arbitrum fork, deploying adapters, configuring subgraphs, and running the frontend.

## Prerequisites

- Node.js and npm installed
- Docker and Docker Compose installed
- Git installed

## Environment Setup

Create a `.env` file in the root directory with the following variables:

```env
INFURA_API_KEY=""
ADAPTER_ADDRESS="0xB03A64bB249581664753ED44778E4c9693e5b2e5"
```

## 1. Fork Arbitrum Setup

Start the local Hardhat Arbitrum fork in the root directory:

```bash
npm run node
```

Keep this terminal running throughout the process.

## 2. Adapter Deployment Steps

In a new terminal, from the root directory, run the deployment scripts in sequence:

```bash
# Deploy contracts
npm run deploy

# Fund accounts
npm run fund

# Run smoke tests
npm run test
```

After successful deployment, add the `ADAPTER_ADDRESS` to your `.env` file (see Environment Setup section above).

## 3. Subgraph Setup

### Start Graph Node

In a new terminal, from the root directory:

```bash
docker-compose up -d
```

**Note**: The `docker-compose.yml` is pre-configured with ethereum network mapping:
```
ethereum: 'arbitrum-one:http://host.docker.internal:8545'
```
This connects to the subgraph's arbitrum-one network configuration.

**Note**: The arbitrum-one config is pre-configured at:
```
subgraph/v3-subgraph/config/arbitrum-one/config.json
```
```json
{
  "network": "arbitrum-one",
  "factory": "0x1F98431c8aD98523631AE4a59f267346ea31F984",
  "startblock": "369125072"
}
```

### Build and Deploy Subgraph

Navigate to the subgraph directory and build:

```bash
cd subgraph/v3-subgraph
npm run build -- --network arbitrum-one --subgraph-type v3-tokens
```

Create the subgraph:

```bash
npx graph create --node http://localhost:8020/ v3-tokens-arb-adapter
```

NOTE: If you have uncommitted changes. Please commit your changes and then try.
Build and deploy locally:

```bash
npm run build -- --network arbitrum-one --subgraph-type v3-tokens --deploy --local
```

### GraphQL Endpoint

Once deployed, you can query the subgraph at:
```
http://localhost:8000/subgraphs/name/v3-tokens-arb-adapter/graphql
```

## 4. Frontend Run Instructions

Navigate to the frontend directory and start the development server:

```bash
cd frontend
npm run dev
```

## 5. Token & Contract Addresses

### Deployed Contracts

- **Adapter Contract**: `0xB03A64bB249581664753ED44778E4c9693e5b2e5`


## 6. Example GraphQL Queries

### Get Recent Token Swaps

```graphql
query GetTokensSwappedEvents { 
  tokensSwappedEvents(first: 10, orderBy: timestamp, orderDirection: desc) { 
    id 
    tokenIn 
    tokenOut 
    fee 
    amountIn 
    amountOut 
    blockNumber 
    timestamp 
    transactionHash 
  } 
}
```

### Get Recent Liquidity Removals

```graphql
query GetLiquidityRemovedEvents { 
  liquidityRemovedEvents(first: 10, orderBy: timestamp, orderDirection: desc) { 
    id 
    tokenId 
    tokenA 
    tokenB 
    fee 
    amount0 
    amount1 
    blockNumber 
    timestamp 
    transactionHash 
  } 
}
```

### Get Recent Liquidity Additions

```graphql
query GetLiquidityAddedEvents { 
  liquidityAddedEvents(first: 10, orderBy: timestamp, orderDirection: desc) { 
    id 
    tokenId 
    tokenA 
    tokenB 
    fee 
    amountA 
    amountB 
    blockNumber 
    timestamp 
    transactionHash 
  } 
}
```

### Get Pair Statistics

```graphql
query GetPairTotals { 
  pairs(first: 100, orderBy: totalLiquidityAdded, orderDirection: desc) { 
    id 
    tokenA 
    tokenB 
    totalLiquidityAdded 
    totalLiquidityRemoved 
    totalSwappedUSDC 
  } 
}
```

## Terminal Workflow Summary

1. **Terminal 1**: `npm run node` (keep running)
2. **Terminal 2**: Run `deploy`, `fund`, `smoke` scripts sequentially
3. **Terminal 3**: `docker-compose up -d`
4. **Terminal 4**: Navigate to `subgraph/v3-subgraph` and run build/deploy commands
5. **Terminal 5**: Navigate to `frontend` and run `npm run dev`

## Troubleshooting

- Ensure all terminals remain open during the process
- If deployment fails, check that the Hardhat node is running
- Verify Docker is running before starting the graph node
- Make sure to update the `.env` file with the correct adapter address after deployment

## Package Scripts

The following npm scripts should be available in your `package.json`:

```json
{
  "scripts": {
    "compile": "npx hardhat compile",
    "clean": "npx hardhat clean",
    "deploy": "npx hardhat run scripts/deploy.ts --network localhost",
    "fund": "npx hardhat run scripts/fund.ts --network localhost",
    "test": "npx hardhat run scripts/smoke.ts --network localhost",
    "node": "npx hardhat node --network hardhat"
  }
}
```