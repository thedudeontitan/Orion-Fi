/**
 * Trade history — off-chain reconstruction.
 *
 * The DEX contract deletes position boxes on `closePosition` and
 * `liquidatePosition`, so closed trades can only be recovered from the ARC-28
 * event logs emitted by those methods. This module combines two sources:
 *
 *   1. A localStorage cache written at close-time by `useClosePosition`, so the
 *      most recent close is visible instantly and includes the client-side txId
 *      and realized payout.
 *   2. An indexer backfill that decodes `PositionOpenedEvent`,
 *      `PositionClosedEvent`, and `PositionLiquidatedEvent` logs, correlating
 *      opens to closes by `positionId` so we can report size/margin/entry for
 *      trades that originated in a different browser.
 *
 * Cache wins on merge for fields the indexer cannot provide (close txId, exact
 * realized payout — the indexer's `payout` already matches, but the localStorage
 * copy is still authoritative because it captured `marginMicroUsdc` directly).
 */
import algosdk from "algosdk";
import { sha512_256 } from "js-sha512";
import { getAlgorandClient } from "./client";
import { APP_IDS } from "./config";
import type { TradeHistoryEntry } from "./types";

const KEY_PREFIX = "orion.history.";

function storageKey(address: string): string {
  return `${KEY_PREFIX}${address}`;
}

// ---------------------------------------------------------------------------
// ARC-28 event selectors
// ---------------------------------------------------------------------------
// Selectors are the first 4 bytes of SHA-512/256 of the event signature
// (name + tuple of arg types, no return). Signatures match the ARC-56 spec at
// contracts/smart_contracts/out/PerpetualDEX.arc56.json.
const OPENED_SIG = "PositionOpenedEvent(uint64,address,string,uint64,uint64,uint64,bool)";
const CLOSED_SIG = "PositionClosedEvent(uint64,address,uint64,bool,uint64)";
const LIQUIDATED_SIG = "PositionLiquidatedEvent(uint64,address,uint64)";

function selectorOf(signature: string): Uint8Array {
  const digest = sha512_256.array(signature);
  return new Uint8Array(digest.slice(0, 4));
}

const SELECTOR_OPENED = selectorOf(OPENED_SIG);
const SELECTOR_CLOSED = selectorOf(CLOSED_SIG);
const SELECTOR_LIQUIDATED = selectorOf(LIQUIDATED_SIG);

// Corresponding ABI tuples for decoding the bytes after the 4-byte selector.
const TUPLE_OPENED = algosdk.ABIType.from("(uint64,address,string,uint64,uint64,uint64,bool)");
const TUPLE_CLOSED = algosdk.ABIType.from("(uint64,address,uint64,bool,uint64)");
const TUPLE_LIQUIDATED = algosdk.ABIType.from("(uint64,address,uint64)");

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i) & 0xff;
  return out;
}

// ---------------------------------------------------------------------------
// localStorage cache
// ---------------------------------------------------------------------------
type SerializedEntry = Omit<
  TradeHistoryEntry,
  | "id"
  | "leverage"
  | "sizeMicroUsdc"
  | "marginMicroUsdc"
  | "entryPriceScaled"
  | "pnlMicroUsdc"
  | "payoutMicroUsdc"
  | "openedAt"
  | "closedAt"
> & {
  id: string;
  leverage: string;
  sizeMicroUsdc: string;
  marginMicroUsdc: string;
  entryPriceScaled: string;
  pnlMicroUsdc: string;
  payoutMicroUsdc: string;
  openedAt?: string;
  closedAt: string;
};

function serialize(entry: TradeHistoryEntry): SerializedEntry {
  return {
    id: entry.id.toString(),
    kind: entry.kind,
    symbol: entry.symbol,
    isLong: entry.isLong,
    leverage: entry.leverage.toString(),
    sizeMicroUsdc: entry.sizeMicroUsdc.toString(),
    marginMicroUsdc: entry.marginMicroUsdc.toString(),
    entryPriceScaled: entry.entryPriceScaled.toString(),
    pnlMicroUsdc: entry.pnlMicroUsdc.toString(),
    payoutMicroUsdc: entry.payoutMicroUsdc.toString(),
    openedAt: entry.openedAt !== undefined ? entry.openedAt.toString() : undefined,
    closedAt: entry.closedAt.toString(),
    txId: entry.txId,
  };
}

function deserialize(s: SerializedEntry): TradeHistoryEntry {
  return {
    id: BigInt(s.id),
    kind: s.kind,
    symbol: s.symbol,
    isLong: s.isLong,
    leverage: BigInt(s.leverage),
    sizeMicroUsdc: BigInt(s.sizeMicroUsdc),
    marginMicroUsdc: BigInt(s.marginMicroUsdc),
    entryPriceScaled: BigInt(s.entryPriceScaled),
    pnlMicroUsdc: BigInt(s.pnlMicroUsdc),
    payoutMicroUsdc: BigInt(s.payoutMicroUsdc),
    openedAt: s.openedAt !== undefined ? BigInt(s.openedAt) : undefined,
    closedAt: BigInt(s.closedAt),
    txId: s.txId,
  };
}

function readEntries(address: string): TradeHistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey(address));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SerializedEntry[];
    return parsed.map(deserialize);
  } catch {
    return [];
  }
}

function writeEntries(address: string, entries: TradeHistoryEntry[]): void {
  if (typeof localStorage === "undefined") return;
  // Dedupe by id, keeping the most information-rich copy (one with txId wins).
  const byId = new Map<string, TradeHistoryEntry>();
  for (const e of entries) {
    const key = e.id.toString();
    const existing = byId.get(key);
    if (!existing) {
      byId.set(key, e);
      continue;
    }
    byId.set(key, mergeEntries(existing, e));
  }
  const serialized = Array.from(byId.values()).map(serialize);
  localStorage.setItem(storageKey(address), JSON.stringify(serialized));
}

export function getHistoryEntries(address: string): TradeHistoryEntry[] {
  return readEntries(address);
}

export function persistHistoryEntry(address: string, entry: TradeHistoryEntry): void {
  const existing = readEntries(address);
  writeEntries(address, [...existing, entry]);
}

export function removeHistoryEntry(address: string, id: bigint): void {
  const existing = readEntries(address);
  writeEntries(
    address,
    existing.filter((e) => e.id !== id),
  );
}

// ---------------------------------------------------------------------------
// Indexer backfill
// ---------------------------------------------------------------------------

interface OpenedSnapshot {
  symbol: string;
  sizeMicroUsdc: bigint;
  entryPriceScaled: bigint;
  leverage: bigint;
  isLong: boolean;
  openedAt?: bigint;
}

interface DecodedDexEvents {
  opens: Map<string, OpenedSnapshot>;
  closes: Array<{
    id: bigint;
    pnlMagnitude: bigint;
    pnlIsNegative: boolean;
    payout: bigint;
    closedAt: bigint;
    txId?: string;
  }>;
  liqs: Array<{ id: bigint; reward: bigint; closedAt: bigint; txId?: string }>;
}

/**
 * Normalize an indexer log entry to raw bytes. algosdk v3 returns logs as
 * `Uint8Array[]`; the raw indexer JSON uses base64 strings. Tolerate both so
 * the decoder works in any runtime.
 */
function logToBytes(log: unknown): Uint8Array | null {
  if (log == null) return null;
  if (typeof log === "string") {
    try {
      return base64ToBytes(log);
    } catch {
      return null;
    }
  }
  if (log instanceof Uint8Array) return log;
  // Generic ArrayBuffer / typed-array-like: fall back to Array.from.
  if (Array.isArray(log)) return new Uint8Array(log as number[]);
  return null;
}

/**
 * Low-level decoder: walk every app-call tx for the given address, match
 * ARC-28 event selectors, and return the decoded events bucketed by type.
 * The caller decides how to interpret them (history rows vs. open-position
 * IDs for localStorage hydration).
 */
async function decodeDexEventsForAddress(
  address: string,
): Promise<DecodedDexEvents | null> {
  const dexAppId = APP_IDS.perpetualDex;
  if (dexAppId === 0n) return null;

  const algorand = getAlgorandClient();
  const indexer = algorand.client.indexer;
  const response = await indexer
    .searchForTransactions()
    .applicationID(Number(dexAppId))
    .address(address)
    .limit(200)
    .do();

  const opens: DecodedDexEvents["opens"] = new Map();
  const closes: DecodedDexEvents["closes"] = [];
  const liqs: DecodedDexEvents["liqs"] = [];

  // The indexer response shape is `TransactionsResponse` in v3 (class instance)
  // or a plain object in older SDKs. Tolerate both field styles.
  const txs = (
    (response as unknown as { transactions?: unknown[] }).transactions ?? []
  ) as Array<Record<string, unknown>>;

  for (const tx of txs) {
    const rawRoundTime =
      (tx["round-time"] as number | bigint | undefined) ??
      (tx["roundTime"] as number | bigint | undefined);
    const roundTime =
      typeof rawRoundTime === "bigint"
        ? rawRoundTime
        : typeof rawRoundTime === "number"
          ? BigInt(rawRoundTime)
          : undefined;
    const txId = tx["id"] as string | undefined;
    const logs = (tx["logs"] ?? []) as unknown[];

    for (const log of logs) {
      const bytes = logToBytes(log);
      if (!bytes || bytes.length < 4) continue;
      const selector = bytes.slice(0, 4);
      const payload = bytes.slice(4);

      try {
        if (bytesEqual(selector, SELECTOR_OPENED)) {
          const decoded = TUPLE_OPENED.decode(payload) as [
            bigint,
            string,
            string,
            bigint,
            bigint,
            bigint,
            boolean,
          ];
          const [positionId, trader, symbol, size, entryPrice, leverage, isLong] =
            decoded;
          if (String(trader) !== address) continue;
          opens.set(positionId.toString(), {
            symbol,
            sizeMicroUsdc: size,
            entryPriceScaled: entryPrice,
            leverage,
            isLong,
            openedAt: roundTime,
          });
        } else if (bytesEqual(selector, SELECTOR_CLOSED)) {
          const decoded = TUPLE_CLOSED.decode(payload) as [
            bigint,
            string,
            bigint,
            boolean,
            bigint,
          ];
          const [positionId, trader, pnlMagnitude, pnlIsNegative, payout] = decoded;
          if (String(trader) !== address) continue;
          closes.push({
            id: positionId,
            pnlMagnitude,
            pnlIsNegative,
            payout,
            closedAt: roundTime ?? 0n,
            txId,
          });
        } else if (bytesEqual(selector, SELECTOR_LIQUIDATED)) {
          const decoded = TUPLE_LIQUIDATED.decode(payload) as [bigint, string, bigint];
          const [positionId, , reward] = decoded;
          // Liquidator ≠ trader. Attribution comes from the prior OPENED
          // event (already filtered by address above).
          liqs.push({
            id: positionId,
            reward,
            closedAt: roundTime ?? 0n,
            txId,
          });
        }
      } catch {
        /* malformed log — ignore */
      }
    }
  }

  return { opens, closes, liqs };
}

/**
 * Return the IDs of positions that this address opened and hasn't closed or
 * been liquidated out of. Used by `positions.ts:hydratePositionsFromIndexer`
 * to backfill localStorage on a fresh browser/session.
 */
export async function fetchOpenPositionIdsFromIndexer(
  address: string,
): Promise<bigint[]> {
  try {
    const events = await decodeDexEventsForAddress(address);
    if (!events) return [];
    const { opens, closes, liqs } = events;
    const closedIds = new Set<string>([
      ...closes.map((c) => c.id.toString()),
      ...liqs.map((l) => l.id.toString()),
    ]);
    const openIds: bigint[] = [];
    for (const [idStr] of opens) {
      if (!closedIds.has(idStr)) openIds.push(BigInt(idStr));
    }
    return openIds;
  } catch (err) {
    console.warn("[orion] open-position indexer scan failed", err);
    return [];
  }
}

/**
 * Decode all ARC-28 event logs for the given address from the DEX app. Returns
 * a list of history entries with whatever information the indexer can supply.
 */
export async function decodeHistoryFromIndexer(
  address: string,
): Promise<TradeHistoryEntry[]> {
  try {
    const events = await decodeDexEventsForAddress(address);
    if (!events) return [];
    const { opens, closes, liqs } = events;

    const entries: TradeHistoryEntry[] = [];

    for (const c of closes) {
      const open = opens.get(c.id.toString());
      if (!open) continue; // Can't reconstruct a row without the open.
      const marginMicroUsdc =
        open.leverage > 0n ? open.sizeMicroUsdc / open.leverage : 0n;
      const pnlSigned = c.pnlIsNegative ? -c.pnlMagnitude : c.pnlMagnitude;
      entries.push({
        id: c.id,
        kind: "CLOSED",
        symbol: open.symbol,
        isLong: open.isLong,
        leverage: open.leverage,
        sizeMicroUsdc: open.sizeMicroUsdc,
        marginMicroUsdc,
        entryPriceScaled: open.entryPriceScaled,
        pnlMicroUsdc: pnlSigned,
        payoutMicroUsdc: c.payout,
        openedAt: open.openedAt,
        closedAt: c.closedAt,
        txId: c.txId,
      });
    }

    for (const l of liqs) {
      const open = opens.get(l.id.toString());
      if (!open) continue;
      const marginMicroUsdc =
        open.leverage > 0n ? open.sizeMicroUsdc / open.leverage : 0n;
      entries.push({
        id: l.id,
        kind: "LIQUIDATED",
        symbol: open.symbol,
        isLong: open.isLong,
        leverage: open.leverage,
        sizeMicroUsdc: open.sizeMicroUsdc,
        marginMicroUsdc,
        entryPriceScaled: open.entryPriceScaled,
        pnlMicroUsdc: -marginMicroUsdc,
        payoutMicroUsdc: 0n,
        openedAt: open.openedAt,
        closedAt: l.closedAt,
        txId: l.txId,
      });
    }

    return entries;
  } catch (err) {
    console.warn("[orion] trade history indexer decode failed", err);
    return [];
  }
}

/**
 * Merge two entries for the same position id, preferring fields from `b` when
 * present and falling back to `a` otherwise. `a` is typically the localStorage
 * cache and `b` the indexer-derived entry.
 */
function mergeEntries(a: TradeHistoryEntry, b: TradeHistoryEntry): TradeHistoryEntry {
  return {
    id: a.id,
    kind: b.kind ?? a.kind,
    symbol: b.symbol || a.symbol,
    isLong: b.isLong ?? a.isLong,
    leverage: b.leverage || a.leverage,
    sizeMicroUsdc: b.sizeMicroUsdc || a.sizeMicroUsdc,
    marginMicroUsdc: a.marginMicroUsdc || b.marginMicroUsdc,
    entryPriceScaled: b.entryPriceScaled || a.entryPriceScaled,
    pnlMicroUsdc: a.pnlMicroUsdc !== 0n ? a.pnlMicroUsdc : b.pnlMicroUsdc,
    payoutMicroUsdc: a.payoutMicroUsdc || b.payoutMicroUsdc,
    openedAt: a.openedAt ?? b.openedAt,
    closedAt: a.closedAt > 0n ? a.closedAt : b.closedAt,
    txId: a.txId ?? b.txId,
  };
}

/**
 * Return the full merged trade history for an address, write the result back
 * to localStorage, and sort newest-first.
 */
export async function fetchTradeHistoryForAddress(
  address: string,
): Promise<TradeHistoryEntry[]> {
  const cached = readEntries(address);
  const remote = await decodeHistoryFromIndexer(address);

  const byId = new Map<string, TradeHistoryEntry>();
  for (const e of remote) byId.set(e.id.toString(), e);
  for (const e of cached) {
    const key = e.id.toString();
    const existing = byId.get(key);
    byId.set(key, existing ? mergeEntries(e, existing) : e);
  }

  const merged = Array.from(byId.values()).sort((x, y) =>
    y.closedAt > x.closedAt ? 1 : y.closedAt < x.closedAt ? -1 : 0,
  );

  writeEntries(address, merged);
  return merged;
}
