/**
 * Query: single position by ID (readonly).
 */
import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@txnlab/use-wallet-react";
import { fetchPosition } from "../../services/algorand/positions";
import type { UiPosition } from "../../services/algorand/types";
import { qk } from "./queryKeys";

export function usePosition(id: bigint | undefined) {
  const { activeAddress } = useWallet();
  return useQuery<UiPosition | null>({
    queryKey: qk.position(id),
    queryFn: async () =>
      id !== undefined ? fetchPosition(id, activeAddress ?? undefined) : null,
    enabled: id !== undefined && Boolean(activeAddress),
    refetchInterval: 15_000,
    staleTime: 10_000,
  });
}
