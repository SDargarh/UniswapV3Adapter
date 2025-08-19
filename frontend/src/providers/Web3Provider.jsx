import React from 'react';
import {
  getDefaultConfig,
  RainbowKitProvider,
} from '@rainbow-me/rainbowkit';
import {
  WagmiProvider,
} from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { arbitrum } from 'wagmi/chains';
import { createPublicClient, http } from 'viem';

// Define your local Hardhat chain. The chainId must match what your Hardhat config uses.
const hardhatLocal = {
  id: 31337,
  name: 'Hardhat Local',
  network: 'hardhat',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: ['http://127.0.0.1:8545'],
    },
    public: {
      http: ['http://127.0.0.1:8545'],
    },
  },
  testnet: true,
};

// Get a WalletConnect Project ID from https://cloud.walletconnect.com
// This is free and required for WalletConnect functionality.
const projectId = '66d34d6945b449f00d3eb2ddb55bd835';

const config = getDefaultConfig({
  appName: 'Uniswap V3 Adapter',
  projectId,
  chains: [hardhatLocal, arbitrum],
  ssr: true, // You may not need this for a simple Vite app, but it's a good practice.
});

const queryClient = new QueryClient();

export const Web3Provider = ({ children }) => {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider chains={config.chains} initialChain={hardhatLocal}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
};