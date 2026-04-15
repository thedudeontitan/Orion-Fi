/**
 * Mutation: deposit USDC into the Vault and receive LP shares.
 *
 * Atomic group mirrors `useOpenPosition` — an axfer to the Vault app, then
 * a typed `deposit(payment)` call. Returns the number of shares minted.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { microAlgo } from "@algorandfoundation/algokit-utils";
import { getVaultClient } from "../../services/algorand/clients-factory";
import { USDC_ASSET_ID } from "../../services/algorand/config";
import { qk } from "./queryKeys";
import { useAlgorandClient } from "./useAlgorandClient";

export interface VaultDepositInput {
  amountMicroUsdc: bigint;
}

export interface VaultDepositOutput {
  shares: bigint;
  txId: string;
}

export function useVaultDeposit() {
  const { algorand, activeAddress } = useAlgorandClient();
  const queryClient = useQueryClient();

  return useMutation<VaultDepositOutput, Error, VaultDepositInput>({
    mutationFn: async ({ amountMicroUsdc }) => {
      if (!activeAddress) throw new Error("Connect a wallet first");
      if (amountMicroUsdc <= 0n) throw new Error("Amount must be positive");

      const vault = getVaultClient();

      const payment = await algorand.createTransaction.assetTransfer({
        sender: activeAddress,
        receiver: vault.appAddress,
        assetId: USDC_ASSET_ID,
        amount: amountMicroUsdc,
      });

      const result = await vault.send.deposit({
        args: { payment },
        sender: activeAddress,
        populateAppCallResources: true,
        coverAppCallInnerTransactionFees: true,
        maxFee: microAlgo(10_000),
      });

      return {
        shares: (result.return as bigint) ?? 0n,
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
