/**
 * User's LP position card — shares, current USDC value, deposit date,
 * plus Deposit and Withdraw buttons.
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
  onDeposit: () => void;
  onWithdraw: () => void;
}

export function LpPositionCard({ onDeposit, onWithdraw }: Props) {
  const { activeAddress } = useWallet();
  const { data, isLoading } = useLpPosition();

  const hasPosition =
    Boolean(data?.position) && (data?.position?.shares ?? 0n) > 0n;

  return (
    <motion.div
      className="rounded-2xl p-5 border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="text-[10px] text-white/30 uppercase tracking-wider">
          Your LP Position
        </div>
        {hasPosition && data?.position && (
          <div className="text-[10px] text-white/30 font-mono">
            Since {formatDepositDate(data.position.depositTimestamp)}
          </div>
        )}
      </div>

      {!activeAddress ? (
        <div className="py-6 text-center text-sm text-white/40">
          Connect your wallet to view your LP position
        </div>
      ) : isLoading ? (
        <div className="py-6 text-center text-sm text-white/40">
          Loading position…
        </div>
      ) : !hasPosition ? (
        <div className="space-y-4">
          <div className="py-4 text-center text-sm text-white/40">
            You have no LP position yet.
          </div>
          <motion.button
            onClick={onDeposit}
            className="w-full py-3 rounded-xl text-sm font-semibold text-white"
            style={{
              background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
            }}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
          >
            Deposit USDC
          </motion.button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1">
                Shares
              </div>
              <div className="text-lg font-semibold text-white font-mono">
                {formatSharesHuman(data!.position!.shares)}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1">
                Current Value
              </div>
              <div className="text-lg font-semibold text-white font-mono">
                ${formatUsdc(data!.valueMicroUsdc)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <motion.button
              onClick={onDeposit}
              className="py-2.5 rounded-xl text-sm font-semibold text-white"
              style={{
                background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
              }}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
            >
              Deposit
            </motion.button>
            <motion.button
              onClick={onWithdraw}
              className="py-2.5 rounded-xl text-sm font-semibold text-white border border-white/10 bg-white/[0.03]"
              whileHover={{ scale: 1.01, borderColor: "rgba(255,255,255,0.2)" }}
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
