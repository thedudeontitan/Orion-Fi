/**
 * Environment-driven Algorand app/asset IDs and protocol constants.
 */

function readBigIntEnv(key: string): bigint {
  const raw = import.meta.env[key];
  if (raw === undefined || raw === null || raw === "") {
    return 0n;
  }
  try {
    return BigInt(raw);
  } catch {
    console.warn(`[orion] invalid bigint env ${key}: ${raw}`);
    return 0n;
  }
}

export const NETWORK = (import.meta.env.VITE_ALGORAND_NETWORK ?? "testnet") as
  | "localnet"
  | "testnet"
  | "mainnet";

export const APP_IDS = {
  priceOracle: readBigIntEnv("VITE_PRICE_ORACLE_APP_ID"),
  perpetualDex: readBigIntEnv("VITE_PERPETUAL_DEX_APP_ID"),
  vault: readBigIntEnv("VITE_VAULT_APP_ID"),
  fundingRateManager: readBigIntEnv("VITE_FUNDING_RATE_MANAGER_APP_ID"),
} as const;

export const USDC_ASSET_ID = readBigIntEnv("VITE_USDC_ASSET_ID");

export const USDC_DECIMALS = 6;

/** SHARE_PRECISION used by the Vault — 1e6, same as USDC. */
export const SHARE_PRECISION = 1_000_000n;

/** Protocol fee denominator — e.g. 50 bps = 0.5%. */
export const BASIS_POINTS = 10_000n;

/**
 * Scale factor the PerpetualDEX contract expects for all price arguments
 * (1 USD = 1_000_000). The frontend multiplies live Pyth prices by this
 * value before passing them into open/close/liquidate methods, and divides
 * the stored `entryPrice` by it when rendering.
 */
export const PRICE_SCALE = 1_000_000n;

/** Vault withdrawal fee in basis points (Vault.algo.ts DEFAULT_WITHDRAWAL_FEE = 10 bps = 0.1%). */
export const VAULT_WITHDRAWAL_FEE_BPS = 10n;
