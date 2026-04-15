/**
 * Vault pool stats card: TVL, share price, utilization, withdrawal fee.
 */
import { motion } from "framer-motion";
import {
  usePoolState,
  useSharePrice,
  useUtilization,
} from "../../hooks/algorand/usePoolState";
import { formatUsdc } from "../../services/algorand/usdc";
import {
  SHARE_PRECISION,
  BASIS_POINTS,
  VAULT_WITHDRAWAL_FEE_BPS,
} from "../../services/algorand/config";

function formatSharePrice(raw: bigint | null | undefined): string {
  if (raw === null || raw === undefined) return "—";
  // Share price is microUSDC per share (scaled by SHARE_PRECISION 1e6).
  const n = Number(raw) / Number(SHARE_PRECISION);
  return `$${n.toFixed(4)}`;
}

function formatUtilization(raw: bigint | null | undefined): string {
  if (raw === null || raw === undefined) return "—";
  // Contract returns bps (0–10_000).
  const pct = Number(raw) / Number(BASIS_POINTS) * 100;
  return `${pct.toFixed(2)}%`;
}

export function VaultStats() {
  const { data: pool } = usePoolState();
  const { data: sharePrice } = useSharePrice();
  const { data: utilization } = useUtilization();

  const tvl = pool?.totalDeposits ?? 0n;

  const stats = [
    { label: "Pool TVL", value: `$${formatUsdc(tvl)}` },
    { label: "Share Price", value: formatSharePrice(sharePrice) },
    { label: "Utilization", value: formatUtilization(utilization) },
    {
      label: "Withdrawal Fee",
      value: `${(Number(VAULT_WITHDRAWAL_FEE_BPS) / 100).toFixed(2)}%`,
    },
  ];

  return (
    <motion.div
      className="rounded-2xl p-5 border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="text-[10px] text-white/30 uppercase tracking-wider mb-4">
        Vault Stats
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label}>
            <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1">
              {s.label}
            </div>
            <div className="text-lg font-semibold text-white font-mono">
              {s.value}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
