import { useWallet } from "@txnlab/use-wallet-react";
import { formatAddress } from "../services/algorand/modern-wallet";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const item = {
  hidden: { y: 20, opacity: 0 },
  show: { y: 0, opacity: 1, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const } },
};

export default function Home() {
  const {
    activeWallet,
    activeAddress,
  } = useWallet();

  const isConnected = Boolean(activeWallet && activeAddress);

  const tradePairs = [
    { symbol: "ETHUSD", name: "ETH/USD", icon: "/eth.png", color: "from-blue-500/20 to-indigo-500/20" },
    { symbol: "BTCUSD", name: "BTC/USD", icon: "/btc.png", color: "from-orange-500/20 to-amber-500/20" },
    { symbol: "SOLUSD", name: "SOL/USD", icon: "/sol.png", color: "from-purple-500/20 to-violet-500/20" },
    { symbol: "ALGOUSD", name: "ALGO/USD", icon: "/algorand.png", color: "from-white/[0.06] to-white/[0.02]" },
  ];

  return (
    <motion.div
      className="w-full min-h-screen bg-surface pt-24 px-6 py-8"
      initial="hidden"
      animate="show"
      variants={container}
    >
      <div className="max-w-6xl mx-auto">
        <motion.div className="mb-8" variants={item}>
          <h1 className="text-3xl font-bold text-accent-dark mb-1">
            Dashboard
          </h1>
          <p className="text-accent-dark/40">
            Trade perpetual futures with leverage on Algorand
          </p>
        </motion.div>

        {!isConnected ? (
          <motion.div
            className="rounded-2xl p-12 text-center border border-accent/[0.06] bg-accent/[0.02] relative overflow-hidden"
            variants={item}
          >
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-[300px] h-[200px] bg-accent/5 rounded-full blur-[80px]" />
            </div>
            <div className="relative z-10">
              <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-accent/10 flex items-center justify-center">
                <svg className="w-7 h-7 text-accent-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-accent-dark mb-3">
                Connect Your Wallet
              </h2>
              <p className="text-accent-dark/40 mb-6 max-w-md mx-auto">
                Connect your Algorand wallet to start trading perpetual futures with up to 100x leverage
              </p>
              <Link
                to="/trade/ETHUSD"
                className="inline-flex items-center px-6 py-3 rounded-xl font-semibold text-white transition-all duration-300 hover:shadow-glow-accent"
                style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' }}
              >
                Start Trading
                <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            </div>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Wallet Info */}
            <motion.div
              className="rounded-2xl p-6 border border-accent/[0.06] bg-accent/[0.02]"
              variants={item}
            >
              <h3 className="text-sm font-medium text-accent-dark/40 mb-5 uppercase tracking-wider">
                Wallet
              </h3>
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-accent-dark/30 mb-1">Address</p>
                  <p className="font-mono text-sm text-accent-dark/80">
                    {activeAddress ? formatAddress(activeAddress) : 'Not connected'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-accent-dark/30 mb-1">Provider</p>
                  <p className="text-sm text-accent-dark/80">
                    {activeWallet?.metadata?.name || 'None'}
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Quick Actions */}
            <motion.div
              className="rounded-2xl p-6 border border-accent/[0.06] bg-accent/[0.02]"
              variants={item}
            >
              <h3 className="text-sm font-medium text-accent-dark/40 mb-5 uppercase tracking-wider">
                Quick Trade
              </h3>
              <div className="space-y-2">
                {tradePairs.map((pair) => (
                  <Link
                    key={pair.symbol}
                    to={`/trade/${pair.symbol}`}
                    className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl border border-accent/[0.04] bg-gradient-to-r ${pair.color} hover:border-accent/20 transition-all duration-200`}
                  >
                    <img src={pair.icon} alt="" className="w-6 h-6" />
                    <span className="font-medium text-accent-dark text-sm">{pair.name}</span>
                    <svg className="w-4 h-4 text-accent-dark/30 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
