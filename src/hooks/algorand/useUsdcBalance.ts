/**
 * Query: USDC balance + opt-in status for the active wallet.
 */
import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@txnlab/use-wallet-react";
import { getUsdcAccountState, type UsdcAccountState } from "../../services/algorand/usdc";
import { qk } from "./queryKeys";

export function useUsdcBalance() {
  const { activeAddress } = useWallet();

  return useQuery<UsdcAccountState>({
    queryKey: qk.usdcBalance(activeAddress ?? ""),
    queryFn: async () => {
      if (!activeAddress) return { optedIn: false, balance: 0n };
      return getUsdcAccountState(activeAddress);
    },
    enabled: Boolean(activeAddress),
    refetchInterval: 15_000,
    staleTime: 10_000,
  });
}
