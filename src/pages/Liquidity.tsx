/**
 * /earn/liquidity — LPs deposit USDC into the Vault to earn yield from
 * perpetual trader PnL. Shows pool stats, user LP position, and opens
 * the deposit / withdraw modals.
 */
import { useState } from "react";
import { motion } from "framer-motion";
import { VaultStats } from "../components/vault/VaultStats";
import { LpPositionCard } from "../components/vault/LpPositionCard";
import { DepositModal } from "../components/vault/DepositModal";
import { WithdrawModal } from "../components/vault/WithdrawModal";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const item = {
  hidden: { y: 16, opacity: 0 },
  show: {
    y: 0,
    opacity: 1,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export default function Liquidity() {
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  return (
    <motion.div
      className="min-h-screen mt-16 bg-surface"
      initial="hidden"
      animate="show"
      variants={container}
    >
      <div className="px-6 py-10 max-w-[1200px] mx-auto space-y-6">
        {/* Header */}
        <motion.div variants={item} className="space-y-2">
          <h1 className="text-3xl font-semibold text-white">
            Liquidity Vault
          </h1>
          <p className="text-sm text-white/50 max-w-2xl">
            Deposit USDC to become the counterparty for perpetual traders and
            earn a share of protocol fees + net trader PnL. Withdrawals settle
            in USDC minus a small fee.
          </p>
        </motion.div>

        {/* Stats */}
        <motion.div variants={item}>
          <VaultStats />
        </motion.div>

        {/* User position */}
        <motion.div variants={item}>
          <LpPositionCard
            onDeposit={() => setDepositOpen(true)}
            onWithdraw={() => setWithdrawOpen(true)}
          />
        </motion.div>
      </div>

      <DepositModal
        open={depositOpen}
        onClose={() => setDepositOpen(false)}
      />
      <WithdrawModal
        open={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
      />
    </motion.div>
  );
}
