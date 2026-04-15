/**
 * Query: the active wallet's LP position (shares + deposit timestamp) plus
 * its current USDC value (readonly simulations against the Vault).
 */
import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@txnlab/use-wallet-react";
import { getVaultClient } from "../../services/algorand/clients-factory";
import type { UiLpPosition } from "../../services/algorand/types";
import { qk } from "./queryKeys";

export interface LpPositionWithValue {
  position: UiLpPosition | null;
  /** Value in microUSDC. 0 when no position. */
  valueMicroUsdc: bigint;
}

export function useLpPosition() {
  const { activeAddress } = useWallet();

  return useQuery<LpPositionWithValue>({
    queryKey: qk.lpPosition(activeAddress ?? ""),
    queryFn: async () => {
      if (!activeAddress) {
        return { position: null, valueMicroUsdc: 0n };
      }
      const vault = getVaultClient();

      let position: UiLpPosition | null = null;
      try {
        const raw = await vault.getLpPosition({
          args: { lp: activeAddress },
        });
        if (raw && raw.shares > 0n) {
          position = {
            shares: raw.shares,
            depositTimestamp: raw.depositTimestamp,
          };
        }
      } catch {
        // No LP position yet.
        position = null;
      }

      if (!position) {
        return { position: null, valueMicroUsdc: 0n };
      }

      let valueMicroUsdc = 0n;
      try {
        const raw = await vault.getLpValue({ args: { lp: activeAddress } });
        valueMicroUsdc = (raw as bigint) ?? 0n;
      } catch (err) {
        console.warn("[orion] getLpValue failed", err);
      }

      return { position, valueMicroUsdc };
    },
    enabled: Boolean(activeAddress),
    refetchInterval: 15_000,
    staleTime: 10_000,
  });
}
