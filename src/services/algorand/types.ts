/**
 * UI domain types that wrap the raw on-chain structs.
 */
import type { PerpPosition } from "../../clients/PerpetualDEXClient";
import type { LpPosition } from "../../clients/VaultClient";

/** Raw on-chain position struct (as returned by the typed client). */
export type OnChainPerpPosition = PerpPosition;

/** UI-friendly open position. All USD amounts are in 1e6 scale (microUSDC/price). */
export interface UiPosition {
  id: bigint;
  trader: string;
  symbol: string;
  /** Notional size in microUSDC (margin * leverage). */
  sizeMicroUsdc: bigint;
  /** Entry price in 1e6 scale. */
  entryPriceScaled: bigint;
  /** Margin in microUSDC. */
  marginMicroUsdc: bigint;
  leverage: bigint;
  isLong: boolean;
  /** Unix seconds. */
  timestamp: bigint;
  liquidationPriceScaled: bigint;
}

export type OnChainLpPosition = LpPosition;

export interface UiLpPosition {
  shares: bigint;
  depositTimestamp: bigint;
}

export interface UiPoolState {
  /** Total USDC deposited by LPs (microUSDC). */
  totalDeposits: bigint;
  /** Reserves (microUSDC). */
  reserves: bigint;
  /** Open trader margin currently reserved (microUSDC). */
  reservedMargin: bigint;
  /** Total outstanding shares. */
  totalShares: bigint;
}

/**
 * A closed (or liquidated) position entry, reconstructed from ARC-28 event
 * logs plus a localStorage cache written at close-time. Because the on-chain
 * position box is deleted on close/liquidate, the indexer is the only way to
 * backfill trades that happened in another browser; the localStorage cache
 * gives a fast first-paint and records the close txId.
 */
export interface TradeHistoryEntry {
  id: bigint;
  kind: "CLOSED" | "LIQUIDATED";
  symbol: string;
  isLong: boolean;
  leverage: bigint;
  sizeMicroUsdc: bigint;
  marginMicroUsdc: bigint;
  entryPriceScaled: bigint;
  /**
   * Realized PnL in signed microUSDC (positive = profit). For LIQUIDATED this
   * equals -margin. For CLOSED, payout - margin.
   */
  pnlMicroUsdc: bigint;
  payoutMicroUsdc: bigint;
  openedAt?: bigint;
  /** Unix seconds. */
  closedAt: bigint;
  txId?: string;
}
