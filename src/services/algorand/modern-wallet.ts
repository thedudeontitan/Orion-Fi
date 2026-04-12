/**
 * Modern Algorand wallet integration using @txnlab/use-wallet-react
 */

import { NetworkId, WalletId, WalletManager } from '@txnlab/use-wallet-react';

// Supported wallets with configurations

// Get network from environment
const getNetworkId = (): NetworkId => {
  const network = import.meta.env.VITE_ALGORAND_NETWORK || 'testnet';
  switch (network) {
    case 'mainnet':
      return NetworkId.MAINNET;
    case 'localnet':
      return NetworkId.LOCALNET;
    case 'testnet':
    default:
      return NetworkId.TESTNET;
  }
};

// Create wallet manager instance
export const walletManager = new WalletManager({
  wallets: [
    WalletId.PERA,
    WalletId.DEFLY,
    WalletId.EXODUS,
    {
      id: WalletId.LUTE,
      options: {
        siteName: 'Orion Fi',
      }
    }
  ],
  networks: {
    [NetworkId.TESTNET]: {
      algod: {
        token: '',
        baseServer: import.meta.env.VITE_ALGOD_SERVER || 'https://testnet-api.algonode.cloud',
        port: '',
      }
    },
    [NetworkId.MAINNET]: {
      algod: {
        token: '',
        baseServer: 'https://mainnet-api.algonode.cloud',
        port: '',
      }
    },
    [NetworkId.LOCALNET]: {
      algod: {
        token: '',
        baseServer: 'http://localhost:4001',
        port: '',
      }
    }
  },
  defaultNetwork: getNetworkId(),
});

// Utility functions for formatting
export const formatAddress = (address: string): string => {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export const formatBalance = (balance: number | bigint, decimals: number = 6): string => {
  // Convert BigInt to number safely
  const numBalance = typeof balance === 'bigint' ? Number(balance) : balance;

  return (numBalance / Math.pow(10, decimals)).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: decimals === 6 ? 2 : 8
  });
};

// Network configuration
export const NETWORK_CONFIG = {
  testnet: {
    explorer: 'https://testnet.algoexplorer.io',
    algodServer: 'https://testnet-api.algonode.cloud',
    indexerServer: 'https://testnet-idx.algonode.cloud',
  },
  mainnet: {
    explorer: 'https://algoexplorer.io',
    algodServer: 'https://mainnet-api.algonode.cloud',
    indexerServer: 'https://mainnet-idx.algonode.cloud',
  },
  localnet: {
    explorer: 'http://localhost:8980',
    algodServer: 'http://localhost:4001',
    indexerServer: 'http://localhost:8980',
  }
};

export const getNetworkConfig = () => {
  const networkId = getNetworkId();
  switch (networkId) {
    case NetworkId.MAINNET:
      return NETWORK_CONFIG.mainnet;
    case NetworkId.LOCALNET:
      return NETWORK_CONFIG.localnet;
    case NetworkId.TESTNET:
    default:
      return NETWORK_CONFIG.testnet;
  }
};

