/**
 * /earn/liquidity — LPs deposit USDC into the Vault to earn yield from
 * perpetual trader PnL. Shows pool stats, user LP position, and an
 * inline vault deposit flow.
 */
import { useState } from "react";
import { motion } from "framer-motion";
import { VaultStats } from "../components/vault/VaultStats";
import { LpPositionCard } from "../components/vault/LpPositionCard";
import { VaultDepositPanel } from "../components/vault/DepositModal";
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
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  return (
    <motion.div
      className="min-h-screen mt-16 bg-[radial-gradient(circle_at_top_left,_rgba(124,58,237,0.12),_transparent_34%),linear-gradient(180deg,#ffffff_0%,#faf5ff_100%)]"
      initial="hidden"
      animate="show"
      variants={container}
    >
      <div className="px-6 py-10 max-w-[1200px] mx-auto space-y-6">
        <motion.div variants={item} className="space-y-2">
          <h1 className="text-3xl font-semibold text-accent-dark">
            Liquidity Vault
          </h1>
          <p className="max-w-2xl text-sm text-accent-dark/60">
            Deposit USDC to become the counterparty for perpetual traders and
            earn a share of protocol fees + net trader PnL. Withdrawals settle
            in USDC minus a small fee.
          </p>
        </motion.div>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <motion.div variants={item} className="space-y-6">
            <VaultStats />
            <LpPositionCard onWithdraw={() => setWithdrawOpen(true)} />
          </motion.div>

          <motion.section
            variants={item}
            className="self-start rounded-[28px] border border-accent/[0.14] bg-white/95 p-6 shadow-[0_24px_70px_rgba(91,33,182,0.12)]"
          >
            <div className="mb-5 space-y-2">
              <div className="text-[10px] uppercase tracking-[0.22em] text-accent-dark/40">
                Vault Deposit
              </div>
              <h2 className="text-2xl font-semibold text-accent-dark">
                Add USDC liquidity directly from this page
              </h2>
              <p className="max-w-lg text-sm leading-6 text-accent-dark/60">
                Supply USDC to back open perpetual positions. Your deposit earns
                protocol fees and absorbs trader PnL, so available liquidity is
                what allows profitable traders to close successfully.
              </p>
            </div>
            <VaultDepositPanel />
          </motion.section>
        </div>
      </div>
      <WithdrawModal
        open={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
      />
    </motion.div>
  );
}
