/**
 * Query: list of open positions for the active wallet.
 *
 * Reads localStorage IDs, fetches each via dex.getPosition() in parallel,
 * and optionally reconciles with the indexer.
 */
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useWallet } from "@txnlab/use-wallet-react";
import {
  fetchPositionsForAddress,
  hydratePositionsFromIndexer,
} from "../../services/algorand/positions";
import type { UiPosition } from "../../services/algorand/types";
import { qk } from "./queryKeys";

export function usePositions() {
  const { activeAddress } = useWallet();

  // Reconcile with indexer on address change (best-effort, fire-and-forget).
  useEffect(() => {
    if (!activeAddress) return;
    void hydratePositionsFromIndexer(activeAddress);
  }, [activeAddress]);

  return useQuery<UiPosition[]>({
    queryKey: qk.positions(activeAddress ?? ""),
    queryFn: async () => {
      if (!activeAddress) return [];
      return fetchPositionsForAddress(activeAddress);
    },
    enabled: Boolean(activeAddress),
    refetchInterval: 15_000,
    staleTime: 10_000,
  });
}
