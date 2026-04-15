/**
 * Mutation: open a perpetual position.
 *
 * Atomic group: USDC axfer (margin) → DEX app address, followed by the
 * `openPosition(symbol, leverage, isLong, marginPayment)uint64` app call.
 * The typed client handles group composition via the `marginPayment` arg.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { microAlgo } from "@algorandfoundation/algokit-utils";
import { getDexClient } from "../../services/algorand/clients-factory";
import { USDC_ASSET_ID } from "../../services/algorand/config";
import { persistPositionId } from "../../services/algorand/positions";
import { qk } from "./queryKeys";
import { useAlgorandClient } from "./useAlgorandClient";

export interface OpenPositionInput {
  symbol: string;
  /** Human USDC amount already converted to microUSDC (bigint). */
  marginMicroUsdc: bigint;
  leverage: number;
  isLong: boolean;
  /** Live price at submit time, scaled by PRICE_SCALE (1e6). */
  priceScaled: bigint;
}

export interface OpenPositionOutput {
  positionId: bigint;
  txId: string;
}

export function useOpenPosition() {
  const { algorand, activeAddress } = useAlgorandClient();
  const queryClient = useQueryClient();

  return useMutation<OpenPositionOutput, Error, OpenPositionInput>({
    mutationFn: async ({
      symbol,
      marginMicroUsdc,
      leverage,
      isLong,
      priceScaled,
    }) => {
      if (!activeAddress) throw new Error("Connect a wallet first");
      if (marginMicroUsdc <= 0n) throw new Error("Margin must be positive");
      if (priceScaled <= 0n) throw new Error("Invalid price");

      const dex = getDexClient();

      const marginAxfer = await algorand.createTransaction.assetTransfer({
        sender: activeAddress,
        receiver: dex.appAddress,
        assetId: USDC_ASSET_ID,
        amount: marginMicroUsdc,
      });

      const result = await dex.send.openPosition({
        args: {
          symbol,
          leverage: BigInt(leverage),
          isLong,
          price: priceScaled,
          marginPayment: marginAxfer,
        },
        sender: activeAddress,
        populateAppCallResources: true,
        coverAppCallInnerTransactionFees: true,
        maxFee: microAlgo(10_000),
      });

      const positionId = result.return as bigint;
      if (positionId === undefined || positionId === null) {
        throw new Error("openPosition did not return a position ID");
      }

      persistPositionId(activeAddress, positionId);

      return { positionId, txId: result.txIds[0] };
    },
    onSuccess: () => {
      if (!activeAddress) return;
      queryClient.invalidateQueries({ queryKey: qk.positions(activeAddress) });
      queryClient.invalidateQueries({ queryKey: qk.usdcBalance(activeAddress) });
      queryClient.invalidateQueries({ queryKey: qk.poolState() });
      queryClient.invalidateQueries({ queryKey: qk.utilization() });
    },
  });
}
