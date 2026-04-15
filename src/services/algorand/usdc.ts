/**
 * USDC opt-in + balance helpers.
 */
import { getAlgorandClient } from "./client";
import { USDC_ASSET_ID } from "./config";

export interface UsdcAccountState {
  optedIn: boolean;
  /** Balance in base units (microUSDC). 0 when not opted in. */
  balance: bigint;
}

export async function getUsdcAccountState(address: string): Promise<UsdcAccountState> {
  const algorand = getAlgorandClient();
  try {
    const info = await algorand.asset.getAccountInformation(address, USDC_ASSET_ID);
    return {
      optedIn: true,
      balance: info.balance,
    };
  } catch {
    return { optedIn: false, balance: 0n };
  }
}

export async function isOptedInToUsdc(address: string): Promise<boolean> {
  return (await getUsdcAccountState(address)).optedIn;
}

export async function getUsdcBalance(address: string): Promise<bigint> {
  return (await getUsdcAccountState(address)).balance;
}

/**
 * Convert a human USDC string ("10.50") to microUSDC (bigint).
 * Returns null if the input is not a valid positive number.
 */
export function parseUsdcAmount(input: string): bigint | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n <= 0) return null;
  return BigInt(Math.round(n * 1_000_000));
}

/** Format microUSDC as a human USDC string with 2 decimals. */
export function formatUsdc(micro: bigint | number, decimals = 2): string {
  const n = typeof micro === "bigint" ? Number(micro) : micro;
  return (n / 1_000_000).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
