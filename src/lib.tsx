export const environments = { LOCAL: "localnet", TESTNET: "testnet", MAINNET: "mainnet" };
export const environment = import.meta.env.VITE_ALGORAND_NETWORK || environments.TESTNET;
export const isLocal = environment === environments.LOCAL;
export const isTestnet = environment === environments.TESTNET;
export const isMainnet = environment === environments.MAINNET;

// Algorand network URLs
export const providerUrl = isMainnet
  ? "https://mainnet-api.algonode.cloud"
  : isLocal
  ? "http://localhost:4001"
  : "https://testnet-api.algonode.cloud";

export const explorerUrl = isMainnet
  ? "https://algoexplorer.io"
  : isLocal
  ? "http://localhost:8980"
  : "https://testnet.algoexplorer.io";

export const playgroundUrl = `${explorerUrl}/api-dev/indexer-v2`;

export const renderTransactionId = (transactionId: string) => {
  return (
    <a
      href={`${explorerUrl}/tx/${transactionId}`}
      target="_blank"
      rel="noreferrer"
      className="underline"
    >
      {transactionId}
    </a>
  );
};

export const renderFormattedBalance = (balance: number | string) => {
  return Number(balance).toFixed(4);
};
