/**
 * Mutation: close an open position.
 *
 * Before calling the contract we snapshot the position (size, entry, margin,
 * leverage, etc.) so we can build a full `TradeHistoryEntry` as soon as the
 * close transaction confirms. The contract deletes the position box on close,
 * so this snapshot is the only way to record the pre-close state client-side.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { microAlgo } from "@algorandfoundation/algokit-utils";
import { getDexClient } from "../../services/algorand/clients-factory";
import {
  fetchPosition,
  removePositionId,
} from "../../services/algorand/positions";
import { persistHistoryEntry } from "../../services/algorand/history";
import { qk } from "./queryKeys";
import { useAlgorandClient } from "./useAlgorandClient";

export interface ClosePositionInput {
  positionId: bigint;
  /** Live price at submit time, scaled by PRICE_SCALE (1e6). */
  priceScaled: bigint;
}

export interface ClosePositionOutput {
  payoutMicroUsdc: bigint;
  txId: string;
}

export function useClosePosition() {
  const { activeAddress } = useAlgorandClient();
  const queryClient = useQueryClient();

  return useMutation<ClosePositionOutput, Error, ClosePositionInput>({
    mutationFn: async ({ positionId, priceScaled }) => {
      if (!activeAddress) throw new Error("Connect a wallet first");
      if (priceScaled <= 0n) throw new Error("Invalid price");

      // Snapshot the position BEFORE closing so we can record history even
      // though the contract deletes the box on close.
      const snapshot = await fetchPosition(positionId, activeAddress);

      const dex = getDexClient(activeAddress);
      const result = await dex.send.closePosition({
        args: { positionId, price: priceScaled },
        sender: activeAddress,
        populateAppCallResources: true,
        coverAppCallInnerTransactionFees: true,
        maxFee: microAlgo(10_000),
      });

      const payoutMicroUsdc = (result.return as bigint) ?? 0n;
      const txId = result.txIds[0];

      if (snapshot) {
        persistHistoryEntry(activeAddress, {
          id: positionId,
          kind: "CLOSED",
          symbol: snapshot.symbol,
          isLong: snapshot.isLong,
          leverage: snapshot.leverage,
          sizeMicroUsdc: snapshot.sizeMicroUsdc,
          marginMicroUsdc: snapshot.marginMicroUsdc,
          entryPriceScaled: snapshot.entryPriceScaled,
          payoutMicroUsdc,
          pnlMicroUsdc:
            BigInt(payoutMicroUsdc) - BigInt(snapshot.marginMicroUsdc),
          openedAt: snapshot.timestamp,
          closedAt: BigInt(Math.floor(Date.now() / 1000)),
          txId,
        });
      }

      removePositionId(activeAddress, positionId);

      return { payoutMicroUsdc, txId };
    },
    onSuccess: () => {
      if (!activeAddress) return;
      queryClient.invalidateQueries({ queryKey: qk.positions(activeAddress) });
      queryClient.invalidateQueries({ queryKey: qk.tradeHistory(activeAddress) });
      queryClient.invalidateQueries({ queryKey: qk.usdcBalance(activeAddress) });
      queryClient.invalidateQueries({ queryKey: qk.poolState() });
      queryClient.invalidateQueries({ queryKey: qk.utilization() });
    },
  });
}
