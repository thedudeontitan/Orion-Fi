/**
 * Gates any UI that needs the active wallet to be opted into USDC.
 *
 * - If the wallet isn't connected, renders a subtle "Connect wallet" hint.
 * - If the wallet is connected but not opted in, renders an opt-in CTA.
 * - Once opted in, renders children.
 */
import { useWallet } from "@txnlab/use-wallet-react";
import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { useUsdcBalance } from "../../hooks/algorand/useUsdcBalance";
import { useUsdcOptIn } from "../../hooks/algorand/useUsdcOptIn";

interface Props {
  children: ReactNode;
  /** Optional custom CTA label. */
  optInLabel?: string;
}

export function UsdcOptInGate({ children, optInLabel = "Opt into USDC" }: Props) {
  const { activeAddress } = useWallet();
  const { data, isLoading } = useUsdcBalance();
  const optIn = useUsdcOptIn();

  if (!activeAddress) {
    return (
      <div className="p-4 rounded-xl border border-accent/[0.06] bg-accent/[0.02] text-center text-sm text-accent-dark/50">
        Connect your wallet to continue
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-4 rounded-xl border border-accent/[0.06] bg-accent/[0.02] text-center text-sm text-accent-dark/50">
        Checking USDC status…
      </div>
    );
  }

  if (!data?.optedIn) {
    return (
      <div className="p-4 rounded-xl border border-accent/[0.08] bg-accent/[0.03] space-y-3">
        <div className="text-xs text-accent-dark/60 leading-relaxed">
          Your wallet needs to opt into USDC before you can trade or deposit.
          Opt-in is a one-time no-cost transaction.
        </div>
        <motion.button
          onClick={() => optIn.mutate()}
          disabled={optIn.isPending}
          className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
          style={{
            background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
          }}
          whileHover={!optIn.isPending ? { scale: 1.01 } : {}}
          whileTap={!optIn.isPending ? { scale: 0.98 } : {}}
        >
          {optIn.isPending ? "Opting in…" : optInLabel}
        </motion.button>
        {optIn.isError && (
          <div className="text-xs text-danger">
            {(optIn.error as Error).message ?? "Opt-in failed"}
          </div>
        )}
      </div>
    );
  }

  return <>{children}</>;
}
