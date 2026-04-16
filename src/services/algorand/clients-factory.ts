/**
 * Typed-client factory functions. Each client reuses the shared AlgorandClient
 * (whose signer has been attached via attachSigner()) so they can submit txns.
 */
import algosdk from "algosdk";
import { PerpetualDexClient } from "../../clients/PerpetualDEXClient";
import { VaultClient } from "../../clients/VaultClient";
import { PriceOracleClient } from "../../clients/PriceOracleClient";
import { FundingRateManagerClient } from "../../clients/FundingRateManagerClient";
import { getAlgorandClient } from "./client";
import { APP_IDS } from "./config";

function readonlySender(appId: bigint, sender?: string): string {
  return sender ?? algosdk.getApplicationAddress(Number(appId)).toString();
}

/**
 * All readonly ABI methods go through algokit-utils' `send.call`, which requires
 * a sender even for simulate-backed calls. Pass the connected wallet address
 * (when available) so `defaultSender` is set on the client.
 */
export function getDexClient(sender?: string): PerpetualDexClient {
  return new PerpetualDexClient({
    algorand: getAlgorandClient(),
    appId: APP_IDS.perpetualDex,
    defaultSender: readonlySender(APP_IDS.perpetualDex, sender),
  });
}

export function getVaultClient(sender?: string): VaultClient {
  return new VaultClient({
    algorand: getAlgorandClient(),
    appId: APP_IDS.vault,
    defaultSender: readonlySender(APP_IDS.vault, sender),
  });
}

export function getOracleClient(sender?: string): PriceOracleClient {
  return new PriceOracleClient({
    algorand: getAlgorandClient(),
    appId: APP_IDS.priceOracle,
    defaultSender: readonlySender(APP_IDS.priceOracle, sender),
  });
}

export function getFundingClient(sender?: string): FundingRateManagerClient {
  return new FundingRateManagerClient({
    algorand: getAlgorandClient(),
    appId: APP_IDS.fundingRateManager,
    defaultSender: readonlySender(APP_IDS.fundingRateManager, sender),
  });
}
