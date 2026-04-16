/**
 * User's LP position card — shares, current USDC value, deposit date,
 * and a withdraw action.
 */
import { motion } from "framer-motion";
import { useWallet } from "@txnlab/use-wallet-react";
import { useLpPosition } from "../../hooks/algorand/useLpPosition";
import { formatUsdc } from "../../services/algorand/usdc";
import { SHARE_PRECISION } from "../../services/algorand/config";

function formatSharesHuman(shares: bigint): string {
  const n = Number(shares) / Number(SHARE_PRECISION);
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });
}

function formatDepositDate(ts: bigint): string {
  const seconds = Number(ts);
  if (seconds <= 0) return "—";
  return new Date(seconds * 1000).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

interface Props {
  onWithdraw: () => void;
}

export function LpPositionCard({ onWithdraw }: Props) {
  const { activeAddress } = useWallet();
  const { data, isLoading } = useLpPosition();

  const hasPosition =
    Boolean(data?.position) && (data?.position?.shares ?? 0n) > 0n;

  return (
    <motion.div
      className="rounded-[24px] border border-accent/[0.12] bg-white/90 p-6 shadow-[0_18px_55px_rgba(91,33,182,0.08)]"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="text-[10px] text-accent-dark/40 uppercase tracking-wider">
          Your LP Position
        </div>
        {hasPosition && data?.position && (
          <div className="text-[10px] text-accent-dark/40 font-mono">
            Since {formatDepositDate(data.position.depositTimestamp)}
          </div>
        )}
      </div>

      {!activeAddress ? (
        <div className="py-6 text-center text-sm text-accent-dark/45">
          Connect your wallet to view your LP position
        </div>
      ) : isLoading ? (
        <div className="py-6 text-center text-sm text-accent-dark/45">
          Loading position…
        </div>
      ) : !hasPosition ? (
        <div className="py-4 text-center text-sm text-accent-dark/45">
          You have no LP position yet.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-[10px] text-accent-dark/40 uppercase tracking-wider mb-1">
                Shares
              </div>
              <div className="text-lg font-semibold text-accent-dark font-mono">
                {formatSharesHuman(data!.position!.shares)}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-accent-dark/40 uppercase tracking-wider mb-1">
                Current Value
              </div>
              <div className="text-lg font-semibold text-accent-dark font-mono">
                ${formatUsdc(data!.valueMicroUsdc)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <motion.button
              onClick={onWithdraw}
              className="py-2.5 rounded-xl text-sm font-semibold text-accent-dark border border-accent/[0.14] bg-accent/[0.03]"
              whileHover={{ scale: 1.01, borderColor: "rgba(124,58,237,0.28)" }}
              whileTap={{ scale: 0.98 }}
            >
              Withdraw
            </motion.button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
