/**
 * Lora explorer URL builders — replaces the deprecated algoexplorer URLs.
 */
import { NETWORK } from "./config";

const LORA_BASE = "https://lora.algokit.io";

function networkSegment(): string {
  switch (NETWORK) {
    case "mainnet":
      return "mainnet";
    case "localnet":
      return "localnet";
    case "testnet":
    default:
      return "testnet";
  }
}

export function txUrl(txId: string): string {
  return `${LORA_BASE}/${networkSegment()}/transaction/${txId}`;
}

export function appUrl(appId: bigint | number): string {
  return `${LORA_BASE}/${networkSegment()}/application/${appId.toString()}`;
}

export function assetUrl(assetId: bigint | number): string {
  return `${LORA_BASE}/${networkSegment()}/asset/${assetId.toString()}`;
}

export function accountUrl(address: string): string {
  return `${LORA_BASE}/${networkSegment()}/account/${address}`;
}
