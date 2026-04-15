/**
 * Centralized React Query key factory. All Algorand-scoped hooks should pull
 * their query keys from here so invalidations are consistent.
 */
export const qk = {
  usdcBalance: (address: string) => ["usdc", "balance", address] as const,
  positions: (address: string) => ["positions", address] as const,
  position: (id: bigint | undefined) => ["position", id?.toString()] as const,
  fundingRate: (symbol: string) => ["funding-rate", symbol] as const,
  poolState: () => ["vault", "pool-state"] as const,
  sharePrice: () => ["vault", "share-price"] as const,
  utilization: () => ["vault", "utilization"] as const,
  lpPosition: (address: string) => ["vault", "lp-position", address] as const,
  lpValue: (address: string) => ["vault", "lp-value", address] as const,
  tradeHistory: (address: string) => ["history", address] as const,
} as const;
