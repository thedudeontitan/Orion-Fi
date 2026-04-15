/**
 * Bridges the @txnlab/use-wallet signer into the shared AlgorandClient so that
 * typed-client calls for the active address are automatically signed.
 */
import type { TransactionSigner } from "algosdk";
import { getAlgorandClient } from "./client";

export function attachSigner(
  address: string | null | undefined,
  signer: TransactionSigner | null | undefined,
): void {
  const algorand = getAlgorandClient();
  if (address && signer) {
    algorand.setDefaultSigner(signer);
    algorand.setSigner(address, signer);
  }
}
