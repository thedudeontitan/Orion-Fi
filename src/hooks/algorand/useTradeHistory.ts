/**
 * Query: closed/liquidated trade history for the active wallet.
 *
 * Merges a localStorage cache written at close-time by `useClosePosition` with
 * an indexer backfill that decodes ARC-28 event logs emitted by the DEX. See
 * `src/services/algorand/history.ts` for the reconstruction logic.
 */
import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@txnlab/use-wallet-react";
import { fetchTradeHistoryForAddress } from "../../services/algorand/history";
import type { TradeHistoryEntry } from "../../services/algorand/types";
import { qk } from "./queryKeys";

export function useTradeHistory() {
  const { activeAddress } = useWallet();

  return useQuery<TradeHistoryEntry[]>({
    queryKey: qk.tradeHistory(activeAddress ?? ""),
    queryFn: async () => {
      if (!activeAddress) return [];
      return fetchTradeHistoryForAddress(activeAddress);
    },
    enabled: Boolean(activeAddress),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}
