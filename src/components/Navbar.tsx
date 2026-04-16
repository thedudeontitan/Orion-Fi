import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@txnlab/use-wallet-react";
import { formatAddress } from "../services/algorand/modern-wallet";

const navContainer = {
  hidden: { y: -100, opacity: 0 },
  show: {
    y: 0,
    opacity: 1,
    transition: {
      type: "spring" as const,
      stiffness: 120,
      damping: 20,
      staggerChildren: 0.08,
    },
  },
};

const navItem = {
  hidden: { y: -20, opacity: 0 },
  show: {
    y: 0,
    opacity: 1,
    transition: { duration: 0.4 },
  },
};

export default function Navbar() {
  const location = useLocation();
  const { wallets, activeWallet, activeAddress } = useWallet();

  const [showWalletModal, setShowWalletModal] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = async (walletId: string) => {
    const wallet = wallets?.find((w) => w.id === walletId);
    if (!wallet) return;

    setIsConnecting(true);
    try {
      await wallet.connect();
      setShowWalletModal(false);
    } catch (err) {
      console.error("Failed to connect wallet:", err);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (activeWallet) {
      try {
        await activeWallet.disconnect();
      } catch (err) {
        console.error("Failed to disconnect wallet:", err);
      }
    }
  };

  const isConnected = Boolean(activeWallet && activeAddress);

  const isActive = (path: string) => {
    if (path === "/markets") return location.pathname === "/markets";
    if (path === "/trade") return location.pathname.startsWith("/trade");
    return location.pathname === path;
  };

  return (
    <>
      <motion.div
        className="fixed top-0 left-0 right-0 z-50 glass-strong"
        style={{
          borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
        }}
        initial="hidden"
        animate="show"
        variants={navContainer}
      >
        <div className="flex items-center justify-between px-6 py-3 max-w-[1600px] mx-auto">
          {/* Logo */}
          <motion.div variants={navItem}>
            <Link to="/" className="flex items-center space-x-3">
              <motion.img
                src="/logo.png"
                alt="Orion Fi Logo"
                className="w-9 h-9 rounded-xl"
                whileHover={{ scale: 1.08, rotate: 3 }}
                transition={{ type: "spring", stiffness: 300 }}
              />
              <span className="text-xl font-bold text-gradient">Orion Fi</span>
            </Link>
          </motion.div>

          {/* Navigation */}
          <motion.div
            className="hidden lg:flex items-center space-x-1"
            variants={navItem}
          >
            {[
              { path: "/markets", label: "Markets" },
              {
                path: "/trade",
                label: "Trade",
                href: "/trade/ALGOUSD",
                icon: "/algorand.png",
              },
            ].map((nav) => (
              <motion.div
                key={nav.path}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Link
                  to={nav.href || nav.path}
                  className={`relative flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                    isActive(nav.path)
                      ? "text-accent-dark bg-accent/[0.06]"
                      : "text-accent-dark/50 hover:text-accent-dark/80 hover:bg-accent/[0.03]"
                  }`}
                >
                  {nav.icon && (
                    <motion.img
                      src={nav.icon}
                      alt=""
                      className="w-4 h-4"
                      whileHover={{ rotate: 10 }}
                    />
                  )}
                  <span>{nav.label}</span>
                  {isActive(nav.path) && (
                    <motion.div
                      className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-gradient-accent"
                      layoutId="navbar-indicator"
                      transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 30,
                      }}
                    />
                  )}
                </Link>
              </motion.div>
            ))}

            <Menu as="div" className="relative">
              <MenuButton className="flex items-center space-x-1 px-4 py-2 rounded-xl text-sm font-medium text-accent-dark/50 hover:text-accent-dark/80 hover:bg-accent/[0.03] transition-all duration-200">
                <span>Earn</span>
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </MenuButton>
              <MenuItems className="absolute right-0 mt-2 w-48 rounded-xl glass-strong shadow-card overflow-hidden">
                <MenuItem>
                  <Link
                    to="/earn/liquidity"
                    className="block px-4 py-3 text-sm text-accent-dark/70 hover:text-accent-dark hover:bg-accent/[0.06] transition-colors"
                  >
                    Liquidity Mining
                  </Link>
                </MenuItem>
              </MenuItems>
            </Menu>
          </motion.div>

          {/* Wallet */}
          <motion.div
            className="flex items-center space-x-3"
            variants={navItem}
          >
            {!isConnected ? (
              <motion.button
                onClick={() => setShowWalletModal(true)}
                className="px-5 py-2.5 font-semibold text-sm text-white rounded-xl transition-all duration-300"
                style={{
                  background:
                    "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                }}
                whileHover={{
                  scale: 1.03,
                  boxShadow: "0 0 24px rgba(99, 102, 241, 0.3)",
                }}
                whileTap={{ scale: 0.97 }}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5, type: "spring", stiffness: 200 }}
                disabled={isConnecting}
              >
                {isConnecting ? "Connecting..." : "Connect Wallet"}
              </motion.button>
            ) : (
              <motion.div
                className="flex items-center space-x-2"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 200 }}
              >
                <motion.div
                  className="rounded-xl px-4 py-2 flex items-center space-x-3 bg-accent/[0.04] border border-accent/[0.06]"
                  whileHover={{ backgroundColor: "rgba(255,255,255,0.06)" }}
                >
                  <div className="w-2 h-2 rounded-full bg-success animate-glow" />
                  <div className="font-mono text-sm text-accent-dark">
                    {activeAddress ? formatAddress(activeAddress) : "Connected"}
                  </div>
                </motion.div>

                <Menu as="div" className="relative">
                  <MenuButton className="flex items-center space-x-2 rounded-xl px-3 py-2.5 transition-all duration-200 bg-accent/[0.04] border border-accent/[0.06] hover:bg-accent/[0.06]">
                    <div className="w-6 h-6 rounded-full bg-gradient-accent" />
                    <svg
                      className="w-3.5 h-3.5 text-accent-dark/40"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </MenuButton>
                  <MenuItems className="absolute right-0 mt-2 w-48 rounded-xl glass-strong shadow-card overflow-hidden">
                    <MenuItem>
                      <button
                        onClick={handleDisconnect}
                        className="block w-full text-left px-4 py-3 text-sm text-danger-light hover:bg-danger/10 transition-colors"
                      >
                        Disconnect
                      </button>
                    </MenuItem>
                  </MenuItems>
                </Menu>
              </motion.div>
            )}
          </motion.div>
        </div>
      </motion.div>

      {/* Wallet Selection Modal - outside animated navbar to prevent transform breaking fixed positioning */}
      <AnimatePresence>
        {showWalletModal && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center backdrop-blur-sm"
            style={{ backgroundColor: "rgba(91, 33, 182, 0.2)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowWalletModal(false)}
          >
            <motion.div
              className="rounded-2xl p-6 w-full max-w-md mx-4 border border-accent/[0.08]"
              style={{ backgroundColor: "#ffffff" }}
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold text-accent-dark">
                  Connect Wallet
                </h3>
                <button
                  onClick={() => setShowWalletModal(false)}
                  className="text-accent-dark/40 hover:text-accent-dark/70 transition-colors p-1 rounded-lg hover:bg-accent/[0.06]"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              <div className="space-y-2">
                {wallets?.map((wallet) => (
                  <motion.button
                    key={wallet.id}
                    onClick={() => handleConnect(wallet.id)}
                    className="w-full p-4 rounded-xl border border-accent/[0.06] text-left flex items-center space-x-4 transition-all duration-200"
                    style={{ backgroundColor: "rgba(124,58,237,0.04)" }}
                    whileHover={{
                      backgroundColor: "rgba(124,58,237,0.1)",
                      borderColor: "rgba(124,58,237,0.3)",
                    }}
                    whileTap={{ scale: 0.98 }}
                    disabled={isConnecting || wallet.isConnected}
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg bg-gradient-accent">
                      {wallet.id === "pera" && "🟣"}
                      {wallet.id === "defly" && "🦋"}
                      {wallet.id === "exodus" && "🚀"}
                      {wallet.id === "lute" && "🎵"}
                      {wallet.id === "walletconnect" && "🔗"}
                      {![
                        "pera",
                        "defly",
                        "exodus",
                        "lute",
                        "walletconnect",
                      ].includes(wallet.id) && "👛"}
                    </div>
                    <div>
                      <div className="font-medium text-accent-dark">
                        {wallet.metadata.name}
                      </div>
                      <div className="text-sm text-accent-dark/40">
                        {wallet.isConnected
                          ? "Connected"
                          : `Connect with ${wallet.metadata.name}`}
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>

              <div className="mt-5 text-xs text-center text-accent-dark/30">
                Choose your preferred Algorand wallet
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
