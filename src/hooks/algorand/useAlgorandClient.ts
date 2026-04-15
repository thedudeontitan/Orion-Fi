/**
 * Signer handoff + shared AlgorandClient access.
 *
 * Every mutation hook calls `useAlgorandClient()` so that the signer attached
 * to the shared AlgorandClient singleton always reflects the currently-active
 * wallet account from @txnlab/use-wallet-react.
 */
import { useEffect } from "react";
import { useWallet } from "@txnlab/use-wallet-react";
import { getAlgorandClient } from "../../services/algorand/client";
import { attachSigner } from "../../services/algorand/signer";

export function useAlgorandClient() {
  const { activeAddress, transactionSigner } = useWallet();

  useEffect(() => {
    attachSigner(activeAddress, transactionSigner);
  }, [activeAddress, transactionSigner]);

  return {
    algorand: getAlgorandClient(),
    activeAddress: activeAddress ?? null,
  };
}
