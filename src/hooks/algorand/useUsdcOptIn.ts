/**
 * Mutation: opt the active account into USDC.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAlgorandClient } from "./useAlgorandClient";
import { USDC_ASSET_ID } from "../../services/algorand/config";
import { qk } from "./queryKeys";

export function useUsdcOptIn() {
  const { algorand, activeAddress } = useAlgorandClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!activeAddress) {
        throw new Error("Connect a wallet first");
      }
      const result = await algorand.send.assetOptIn({
        sender: activeAddress,
        assetId: USDC_ASSET_ID,
      });
      return result.txIds[0];
    },
    onSuccess: () => {
      if (activeAddress) {
        queryClient.invalidateQueries({ queryKey: qk.usdcBalance(activeAddress) });
      }
    },
  });
}
