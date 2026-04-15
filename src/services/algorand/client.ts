/**
 * Singleton AlgorandClient for the active network.
 *
 * A single instance is used across the app so that a wallet signer attached
 * via `attachSigner()` in signer.ts persists to every typed client call.
 */
import { AlgorandClient } from "@algorandfoundation/algokit-utils";
import { NETWORK } from "./config";

let algorandClient: AlgorandClient | null = null;

export function getAlgorandClient(): AlgorandClient {
  if (algorandClient) return algorandClient;

  switch (NETWORK) {
    case "mainnet":
      algorandClient = AlgorandClient.mainNet();
      break;
    case "localnet":
      algorandClient = AlgorandClient.defaultLocalNet();
      break;
    case "testnet":
    default:
      algorandClient = AlgorandClient.testNet();
      break;
  }

  return algorandClient;
}
