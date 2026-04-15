/**
 * Query: the current funding rate for a market (readonly).
 *
 * The DEX exposes `getFundingRate(symbol) -> uint64` which returns the current
 * rate in basis points per funding interval.
 */
import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@txnlab/use-wallet-react";
import { getDexClient } from "../../services/algorand/clients-factory";
import { qk } from "./queryKeys";

export function useFundingRate(symbol: string | undefined) {
  const { activeAddress } = useWallet();
  return useQuery<bigint | null>({
    queryKey: qk.fundingRate(symbol ?? ""),
    queryFn: async () => {
      if (!symbol || !activeAddress) return null;
      try {
        const dex = getDexClient(activeAddress);
        const raw = await dex.getFundingRate({ args: { symbol } });
        return (raw as bigint) ?? null;
      } catch (err) {
        console.warn("[orion] getFundingRate failed", err);
        return null;
      }
    },
    enabled: Boolean(symbol) && Boolean(activeAddress),
    refetchInterval: 30_000,
    staleTime: 20_000,
  });
}

/** Format a bps/hour uint64 as a percentage string. */
export function formatFundingRate(rate: bigint | null | undefined): string {
  if (rate === null || rate === undefined) return "—";
  // Contract returns bps per funding interval (typically hourly).
  const bps = Number(rate);
  const pct = bps / 100; // bps -> %
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(4)}%/hr`;
}
