import { txUrl } from "./services/algorand/explorer";

export const environments = { LOCAL: "localnet", TESTNET: "testnet", MAINNET: "mainnet" };
export const environment = import.meta.env.VITE_ALGORAND_NETWORK || environments.TESTNET;
export const isLocal = environment === environments.LOCAL;
export const isTestnet = environment === environments.TESTNET;
export const isMainnet = environment === environments.MAINNET;

// Algorand algod URLs
export const providerUrl = isMainnet
  ? "https://mainnet-api.algonode.cloud"
  : isLocal
  ? "http://localhost:4001"
  : "https://testnet-api.algonode.cloud";

export const renderTransactionId = (transactionId: string) => {
  return (
    <a
      href={txUrl(transactionId)}
      target="_blank"
      rel="noreferrer"
      className="underline"
    >
      {transactionId.slice(0, 8)}…{transactionId.slice(-6)}
    </a>
  );
};

export const renderFormattedBalance = (balance: number | string) => {
  return Number(balance).toFixed(4);
};
