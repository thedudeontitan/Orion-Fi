/**
 * Queries: Vault pool-wide stats (TVL, reserves, share price, utilization).
 */
import { useQuery } from "@tanstack/react-query";
import { getVaultClient } from "../../services/algorand/clients-factory";
import type { UiPoolState } from "../../services/algorand/types";
import { qk } from "./queryKeys";

export function usePoolState() {
  return useQuery<UiPoolState | null>({
    queryKey: qk.poolState(),
    queryFn: async () => {
      try {
        const vault = getVaultClient();
        const [totalDeposits, reserves, reservedMargin, totalShares] =
          await vault.getPoolState();
        return { totalDeposits, reserves, reservedMargin, totalShares };
      } catch (err) {
        console.warn("[orion] getPoolState failed", err);
        return null;
      }
    },
    refetchInterval: 15_000,
    staleTime: 10_000,
  });
}

export function useSharePrice() {
  return useQuery<bigint | null>({
    queryKey: qk.sharePrice(),
    queryFn: async () => {
      try {
        const vault = getVaultClient();
        return (await vault.getSharePrice()) ?? null;
      } catch {
        return null;
      }
    },
    refetchInterval: 15_000,
    staleTime: 10_000,
  });
}

export function useUtilization() {
  return useQuery<bigint | null>({
    queryKey: qk.utilization(),
    queryFn: async () => {
      try {
        const vault = getVaultClient();
        return (await vault.getUtilization()) ?? null;
      } catch {
        return null;
      }
    },
    refetchInterval: 15_000,
    staleTime: 10_000,
  });
}
