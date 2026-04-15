/**
 * Mutation: burn LP shares and withdraw USDC from the Vault.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { microAlgo } from "@algorandfoundation/algokit-utils";
import { getVaultClient } from "../../services/algorand/clients-factory";
import { qk } from "./queryKeys";
import { useAlgorandClient } from "./useAlgorandClient";

export interface VaultWithdrawInput {
  sharesToBurn: bigint;
}

export interface VaultWithdrawOutput {
  payoutMicroUsdc: bigint;
  txId: string;
}

export function useVaultWithdraw() {
  const { activeAddress } = useAlgorandClient();
  const queryClient = useQueryClient();

  return useMutation<VaultWithdrawOutput, Error, VaultWithdrawInput>({
    mutationFn: async ({ sharesToBurn }) => {
      if (!activeAddress) throw new Error("Connect a wallet first");
      if (sharesToBurn <= 0n) throw new Error("Shares must be positive");

      const vault = getVaultClient();
      const result = await vault.send.withdraw({
        args: { sharesToBurn },
        sender: activeAddress,
        populateAppCallResources: true,
        coverAppCallInnerTransactionFees: true,
        maxFee: microAlgo(10_000),
      });

      return {
        payoutMicroUsdc: (result.return as bigint) ?? 0n,
        txId: result.txIds[0],
      };
    },
    onSuccess: () => {
      if (!activeAddress) return;
      queryClient.invalidateQueries({ queryKey: qk.usdcBalance(activeAddress) });
      queryClient.invalidateQueries({ queryKey: qk.lpPosition(activeAddress) });
      queryClient.invalidateQueries({ queryKey: qk.lpValue(activeAddress) });
      queryClient.invalidateQueries({ queryKey: qk.poolState() });
      queryClient.invalidateQueries({ queryKey: qk.sharePrice() });
      queryClient.invalidateQueries({ queryKey: qk.utilization() });
    },
  });
}
