/**
 * Position persistence — localStorage IDs + indexer fallback reconciliation.
 *
 * Strategy:
 *   1. On open, persist the new position ID to `orion.positions.<address>`.
 *   2. On close/liquidation, remove the ID.
 *   3. On wallet connect, hydrate from the indexer using the DEX app ID and
 *      the user's address; decode ARC-28 events to reconcile.
 *   4. usePositions reads the stored IDs, fetches each via dex.getPosition()
 *      in parallel, and silently prunes IDs that throw "Position not found".
 */
import { fetchOpenPositionIdsFromIndexer } from "./history";
import { getDexClient } from "./clients-factory";
import type { UiPosition } from "./types";

const KEY_PREFIX = "orion.positions.";

function storageKey(address: string): string {
  return `${KEY_PREFIX}${address}`;
}

function readIds(address: string): bigint[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey(address));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    return parsed.map((s) => BigInt(s));
  } catch {
    return [];
  }
}

function writeIds(address: string, ids: bigint[]): void {
  if (typeof localStorage === "undefined") return;
  const deduped = Array.from(new Set(ids.map((id) => id.toString())));
  localStorage.setItem(storageKey(address), JSON.stringify(deduped));
}

export function getPersistedPositionIds(address: string): bigint[] {
  return readIds(address);
}

export function persistPositionId(address: string, id: bigint): void {
  const existing = readIds(address);
  if (existing.some((x) => x === id)) return;
  writeIds(address, [...existing, id]);
}

export function removePositionId(address: string, id: bigint): void {
  const existing = readIds(address);
  writeIds(
    address,
    existing.filter((x) => x !== id),
  );
}

/**
 * Fetch a single position via readonly call. Returns null if the position
 * no longer exists (e.g. already closed or liquidated).
 *
 * `sender` is required by algokit-utils for simulate-backed readonly calls.
 * Pass the active wallet address so the client has a defaultSender.
 */
export async function fetchPosition(
  id: bigint,
  sender?: string,
): Promise<UiPosition | null> {
  try {
    const dex = getDexClient(sender);
    const raw = await dex.getPosition({ args: { positionId: id } });
    if (!raw) return null;
    return {
      id,
      trader: raw.trader,
      symbol: raw.symbol,
      sizeMicroUsdc: raw.size,
      entryPriceScaled: raw.entryPrice,
      marginMicroUsdc: raw.margin,
      leverage: raw.leverage,
      isLong: raw.isLong,
      timestamp: raw.timestamp,
      liquidationPriceScaled: raw.liquidationPrice,
    };
  } catch (err) {
    console.warn(`[orion] getPosition(${id}) failed`, err);
    return null;
  }
}

/**
 * Fetch all positions recorded for an address, pruning invalid IDs.
 */
export async function fetchPositionsForAddress(address: string): Promise<UiPosition[]> {
  const ids = getPersistedPositionIds(address);
  if (ids.length === 0) return [];

  const results = await Promise.all(ids.map((id) => fetchPosition(id, address)));
  const positions: UiPosition[] = [];
  const validIds: bigint[] = [];

  results.forEach((pos, i) => {
    if (!pos) return; // getPosition threw → position no longer exists, drop ID
    // Defensive trader check: algokit-utils may hand back an Address wrapper
    // or a plain string depending on client-gen version. Normalise to string
    // before comparing so we never wipe localStorage on a type mismatch.
    const traderStr = String(pos.trader);
    if (traderStr === address) {
      positions.push(pos);
    }
    // Keep the ID either way — if the trader mismatches on this read, it may
    // still be valid (e.g. indexer lag, case/normalisation). Only IDs whose
    // underlying box has disappeared (pos === null) get pruned.
    validIds.push(ids[i]);
  });

  // Prune stale IDs so future reads are faster.
  if (validIds.length !== ids.length) {
    writeIds(address, validIds);
  }

  return positions;
}

/**
 * Reconcile localStorage with on-chain events. Delegates to
 * `fetchOpenPositionIdsFromIndexer`, which decodes ARC-28 event selectors
 * and returns only positions that are opened-but-not-yet-closed for this
 * account. Discovered IDs are merged with the persisted list.
 *
 * Best-effort: failures are logged but not thrown so the UI keeps working
 * with the localStorage-only fallback.
 */
export async function hydratePositionsFromIndexer(address: string): Promise<void> {
  try {
    const discovered = await fetchOpenPositionIdsFromIndexer(address);
    if (discovered.length === 0) return;
    const merged = new Set<string>(
      getPersistedPositionIds(address).map((b) => b.toString()),
    );
    for (const id of discovered) merged.add(id.toString());
    writeIds(
      address,
      Array.from(merged).map((s) => BigInt(s)),
    );
  } catch (err) {
    console.warn("[orion] indexer reconciliation failed", err);
  }
}
