import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { getSymbolPrice } from "../utils/GetSymbolPrice";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.2,
    },
  },
};

const item = {
  hidden: { y: 24, opacity: 0 },
  show: {
    y: 0,
    opacity: 1,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export default function LandingPage() {
  const [ethPrice, setEthPrice] = useState<number>(0);
  const [btcPrice, setBtcPrice] = useState<number>(0);
  const [algoPrice, setAlgoPrice] = useState<number>(0);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      getSymbolPrice("ETHUSD").then(setEthPrice),
      getSymbolPrice("BTCUSD").then(setBtcPrice),
      getSymbolPrice("ALGOUSD").then(setAlgoPrice),
    ]);
  }, []);

  const popularMarkets = [
    {
      symbol: "ETH",
      name: "Ethereum",
      price: ethPrice,
      change: -3.23,
      icon: "/eth.png",
    },
    {
      symbol: "BTC",
      name: "Bitcoin",
      price: btcPrice,
      change: 2.41,
      icon: "/btc.png",
    },
    {
      symbol: "ALGO",
      name: "Algorand",
      price: algoPrice,
      change: 1.24,
      icon: "/algorand.png",
    },
  ];

  const features = [
    {
      title: "Oracle-Anchored AMM",
      description:
        "Trade directly against a shared liquidity vault at guaranteed oracle prices",
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M13 10V3L4 14h7v7l9-11h-7z"
          />
        </svg>
      ),
    },
    {
      title: "On-Chain Settlement",
      description:
        "Trustless and transparent trade settlement via smart contracts",
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
          />
        </svg>
      ),
    },
    {
      title: "Leverage Trading",
      description:
        "Trade with up to 100x leverage on major assets like ETH, BTC, and ALGO",
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
          />
        </svg>
      ),
    },
    {
      title: "Low Trading Costs",
      description:
        "Minimal fees leveraging efficient infrastructure for cost-effective trading",
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
    },
    {
      title: "Advanced Analytics",
      description:
        "Real-time price feeds, PnL tracking, and comprehensive portfolio analytics",
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
      ),
    },
    {
      title: "Smart Risk Management",
      description:
        "Competitive funding rates and advanced risk controls for safer trading",
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
      ),
    },
  ];

  const roadmapData = [
    {
      quarter: "Q1 2026",
      title: "Initial Launch",
      description: "Launch of core trading features and initial market pairs",
      items: [
        "ETH, BTC, ALGO trading pairs",
        "Oracle-anchored AMM deployment",
        "Basic leverage trading features",
      ],
    },
    {
      quarter: "Q2 2026",
      title: "Advanced Trading Features",
      description: "Enhanced trading capabilities and improved user experience",
      items: [
        "Automated liquidation mechanism",
        "Funding rate optimizations",
        "Advanced order types",
      ],
      status: "current",
    },
    {
      quarter: "Q3 2026",
      title: "Analytics and Insights",
      description: "Comprehensive trading analytics and portfolio insights",
      items: [
        "Advanced PnL tracking",
        "Portfolio analytics dashboard",
        "Market trend analysis",
      ],
    },
    {
      quarter: "Q4 2026",
      title: "Platform Expansion",
      description: "Additional features and market expansion",
      items: [
        "Cross-chain perpetual DEX integration",
        "Trading competitions",
        "Enhanced liquidity pools",
      ],
    },
  ];

  return (
    <motion.main
      className="min-h-screen bg-surface"
      initial="hidden"
      animate="show"
      variants={container}
    >
      <div className="pt-20 px-4 lg:px-6 max-w-[1400px] mx-auto mt-4">
        {/* Hero Section */}
        <motion.div
          className="relative flex flex-col gap-10 p-8 lg:p-16 rounded-3xl overflow-hidden"
          variants={item}
        >
          {/* Gradient Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-accent/20 via-accent-violet/10 to-transparent" />
          <div className="absolute inset-0 bg-surface-50/60" />

          {/* Dot Pattern */}
          <div className="absolute inset-0 opacity-[0.03]">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
              <pattern
                id="hero-dots"
                x="0"
                y="0"
                width="32"
                height="32"
                patternUnits="userSpaceOnUse"
              >
                <circle cx="16" cy="16" r="1.5" fill="white" />
              </pattern>
              <rect width="100%" height="100%" fill="url(#hero-dots)" />
            </svg>
          </div>

          {/* Glow Orbs */}
          <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-accent/10 rounded-full blur-[128px]" />
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-accent-violet/10 rounded-full blur-[128px]" />

          <div className="w-full flex flex-col lg:flex-row gap-12 lg:gap-16 relative z-10">
            <motion.div
              className="flex flex-col gap-8 flex-1"
              variants={container}
            >
              <motion.div
                className="inline-flex items-center space-x-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20 w-fit"
                variants={item}
              >
                <div className="w-2 h-2 rounded-full bg-accent animate-glow" />
                <span className="text-sm font-medium text-accent-light">
                  Live on Algorand Testnet
                </span>
              </motion.div>

              <motion.h1
                className="text-4xl lg:text-6xl font-bold leading-[1.1] tracking-tight"
                variants={item}
              >
                <span className="text-accent-dark">Next-Gen</span>
                <br />
                <span className="text-gradient">Perpetual Trading</span>
              </motion.h1>

              <motion.p
                className="text-lg text-accent-dark/50 max-w-xl leading-relaxed"
                variants={item}
              >
                Experience lightning-fast perpetual trading with an oracle-anchored AMM, delivering zero slippage and deep liquidity from day one.
              </motion.p>

              <motion.div className="flex items-center gap-4" variants={item}>
                <motion.button
                  className="px-8 py-4 rounded-2xl font-bold text-white transition-all duration-300 flex items-center gap-2"
                  style={{
                    background:
                      "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                  }}
                  onClick={() => navigate("/trade/ALGOUSD")}
                  whileHover={{
                    scale: 1.03,
                    boxShadow: "0 0 32px rgba(99, 102, 241, 0.3)",
                  }}
                  whileTap={{ scale: 0.97 }}
                >
                  Start Trading
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 7l5 5m0 0l-5 5m5-5H6"
                    />
                  </svg>
                </motion.button>
                <motion.button
                  className="px-8 py-4 rounded-2xl font-bold text-accent-dark/70 border border-accent/[0.08] hover:border-accent/[0.15] hover:bg-accent/[0.03] transition-all duration-300"
                  onClick={() => navigate("/markets")}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                >
                  View Markets
                </motion.button>
              </motion.div>
            </motion.div>

            <motion.div
              className="lg:w-[380px] flex flex-col gap-3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5, duration: 0.6 }}
            >
              <motion.div
                className="p-6 rounded-2xl border border-accent/[0.06] bg-accent/[0.03] backdrop-blur-xl"
                whileHover={{ borderColor: "rgba(99, 102, 241, 0.2)", y: -2 }}
                transition={{ duration: 0.2 }}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
                    <svg
                      className="w-4 h-4 text-accent-light"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                      />
                    </svg>
                  </div>
                  <span className="text-lg font-bold text-accent-dark">
                    Trade Major Assets
                  </span>
                </div>
                <p className="text-sm text-accent-dark/40 pl-11">
                  ETH, BTC, and ALGO with up to 100x leverage
                </p>
              </motion.div>

              <motion.div
                className="p-6 rounded-2xl border border-accent/[0.06] bg-accent/[0.03] backdrop-blur-xl"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7, duration: 0.6 }}
                whileHover={{ borderColor: "rgba(99, 102, 241, 0.2)", y: -2 }}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-success/20 flex items-center justify-center">
                    <svg
                      className="w-4 h-4 text-success-light"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                  </div>
                  <span className="text-lg font-bold text-accent-dark">
                    Zero Slippage
                  </span>
                </div>
                <p className="text-sm text-accent-dark/40 pl-11">
                  Oracle-first architecture ensures accurate pricing
                </p>
              </motion.div>

              <motion.div
                className="p-6 rounded-2xl border border-accent/[0.06] bg-accent/[0.03] backdrop-blur-xl"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.9, duration: 0.6 }}
                whileHover={{ borderColor: "rgba(99, 102, 241, 0.2)", y: -2 }}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-warning/20 flex items-center justify-center">
                    <svg
                      className="w-4 h-4 text-warning-light"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                      />
                    </svg>
                  </div>
                  <span className="text-lg font-bold text-accent-dark">
                    Fully Secure
                  </span>
                </div>
                <p className="text-sm text-accent-dark/40 pl-11">
                  On-chain settlement with smart contract security
                </p>
              </motion.div>
            </motion.div>
          </div>

          {/* Stats */}
          <motion.div
            className="flex flex-wrap gap-12 lg:gap-20 relative z-10 pt-4"
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
          >
            {[
              { value: "4", label: "Trading Pairs" },
              { value: "100x", label: "Max Leverage" },
              { value: "0.1%", label: "Trading Fee" },
            ].map((stat) => (
              <motion.div
                key={stat.label}
                className="flex flex-col gap-1"
                variants={item}
              >
                <span className="text-4xl lg:text-5xl font-bold text-gradient">
                  {stat.value}
                </span>
                <span className="text-sm text-accent-dark/40">
                  {stat.label}
                </span>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>

        {/* Popular Markets */}
        <motion.section
          className="py-20"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          variants={container}
        >
          <motion.div className="text-center mb-12" variants={item}>
            <h2 className="text-3xl lg:text-4xl font-bold mb-4 text-accent-dark">
              Popular Markets
            </h2>
            <p className="text-lg text-accent-dark/40 max-w-2xl mx-auto">
              Trade the most popular crypto assets with competitive spreads
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {popularMarkets.map((market) => (
              <motion.div
                key={market.symbol}
                onClick={() => navigate(`/trade/${market.symbol}USD`)}
                className="p-6 rounded-2xl cursor-pointer group border border-accent/[0.06] bg-accent/[0.02] hover:border-accent/20 hover:bg-accent/[0.04] transition-all duration-300"
                variants={item}
                whileHover={{ y: -4 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="flex items-center space-x-3 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-accent/[0.06] flex items-center justify-center group-hover:bg-accent/10 transition-colors">
                    {market.icon ? (
                      <img
                        src={market.icon}
                        alt={market.name}
                        className="w-6 h-6"
                      />
                    ) : (
                      <span className="text-accent-dark font-bold">
                        {market.symbol[0]}
                      </span>
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-accent-dark">
                      {market.symbol}/USD
                    </h3>
                    <p className="text-xs text-accent-dark/40">{market.name}</p>
                  </div>
                </div>
                <div className="text-2xl font-bold text-accent-dark mb-1">
                  $
                  {market.price.toLocaleString(undefined, {
                    minimumFractionDigits: market.price < 1 ? 6 : 2,
                    maximumFractionDigits: market.price < 1 ? 8 : 2,
                  })}
                </div>
                <div
                  className={`text-sm font-medium ${
                    market.change >= 0 ? "text-success" : "text-danger"
                  }`}
                >
                  {market.change >= 0 ? "+" : ""}
                  {market.change}%
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Features Section */}
        <motion.section
          className="py-20"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          variants={container}
        >
          <motion.div className="text-center mb-12" variants={item}>
            <h2 className="text-3xl lg:text-4xl font-bold mb-4 text-accent-dark">
              Advanced Trading Features
            </h2>
            <p className="text-lg text-accent-dark/40 max-w-2xl mx-auto">
              Everything you need for professional perpetual trading in one
              platform
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                className="p-6 rounded-2xl border border-accent/[0.06] bg-accent/[0.02] group hover:border-accent/15 transition-all duration-300"
                variants={item}
                whileHover={{ y: -3 }}
              >
                <div className="h-11 w-11 rounded-xl flex items-center justify-center mb-5 text-accent-light bg-accent/10 group-hover:bg-accent/20 transition-colors">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-bold text-accent-dark mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-accent-dark/40 leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Roadmap Section */}
        <section className="py-20 px-0 lg:px-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4 text-accent-dark">
              Platform Roadmap
            </h2>
            <p className="text-lg text-accent-dark/40 max-w-2xl mx-auto">
              Our journey to build the most advanced perpetual trading platform
            </p>
          </div>

          <div className="relative">
            <div className="absolute left-8 lg:left-1/2 top-0 bottom-0 w-px -translate-x-1/2 bg-gradient-to-b from-accent/40 via-accent-violet/30 to-transparent" />

            <div className="space-y-16">
              {roadmapData.map((milestone, index) => (
                <div
                  key={index}
                  className={`relative flex flex-col lg:flex-row gap-8 lg:gap-16 items-start ${
                    index % 2 === 0 ? "lg:flex-row-reverse" : ""
                  }`}
                >
                  <div
                    className={`absolute left-8 lg:left-1/2 w-6 h-6 -translate-x-1/2 rounded-full ${
                      milestone.status === "current"
                        ? "bg-gradient-accent shadow-glow-accent"
                        : "bg-surface-300 border border-accent/[0.1]"
                    }`}
                  />

                  <div
                    className={`w-full lg:w-[calc(50%-3rem)] pl-20 lg:pl-0 ${
                      index % 2 === 0 ? "lg:text-right" : ""
                    }`}
                  >
                    <div
                      className={`p-6 rounded-2xl border transition-all duration-300 hover:translate-y-[-2px] ${
                        milestone.status === "current"
                          ? "border-accent/20 bg-accent/[0.04]"
                          : "border-accent/[0.06] bg-accent/[0.02]"
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3 flex-wrap">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-medium ${
                                milestone.status === "current"
                                  ? "bg-accent/15 text-accent-light"
                                  : "bg-accent/[0.06] text-accent-dark/50"
                              }`}
                            >
                              {milestone.quarter}
                            </span>
                            {milestone.status === "current" && (
                              <span className="text-xs px-3 py-1 rounded-full flex items-center gap-2 bg-success/10 text-success">
                                <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                                Current
                              </span>
                            )}
                          </div>
                          <h3 className="text-xl font-bold text-accent-dark mb-2">
                            {milestone.title}
                          </h3>
                          <p className="text-sm text-accent-dark/40 mb-4">
                            {milestone.description}
                          </p>
                          <ul className="space-y-2">
                            {milestone.items.map((listItem, itemIndex) => (
                              <li
                                key={itemIndex}
                                className="flex items-center gap-2 text-sm text-accent-dark/50"
                              >
                                <div className="w-1 h-1 rounded-full bg-accent/60" />
                                <span>{listItem}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20">
          <div className="text-center relative">
            {/* Glow */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-[400px] h-[200px] bg-accent/10 rounded-full blur-[100px]" />
            </div>

            <div className="relative z-10">
              <h2 className="text-3xl lg:text-5xl font-bold mb-4 text-accent-dark">
                Ready to Start Trading?
              </h2>
              <p className="text-lg text-accent-dark/40 max-w-2xl mx-auto mb-8">
                Join thousands of traders already using Orion Fi to trade crypto
                derivatives
              </p>
              <motion.button
                onClick={() => navigate("/trade/ALGOUSD")}
                className="px-10 py-5 rounded-2xl font-bold text-white text-lg transition-all duration-300"
                style={{
                  background:
                    "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                }}
                whileHover={{
                  scale: 1.03,
                  boxShadow: "0 0 40px rgba(99, 102, 241, 0.3)",
                }}
                whileTap={{ scale: 0.97 }}
              >
                Launch App
              </motion.button>
            </div>
          </div>
        </section>
      </div>

      {/* Footer */}
      <footer className="border-t border-accent/[0.06] py-8 bg-surface-50/50">
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-3 mb-4 md:mb-0">
              <img
                src="/logo.png"
                alt="Orion Fi Logo"
                className="w-7 h-7 rounded-lg"
              />
              <span className="text-lg font-bold text-gradient">Orion Fi</span>
            </div>
            <div className="flex space-x-6 text-sm">
              <Link
                to="/docs"
                className="text-accent-dark/30 hover:text-accent-dark/60 transition-colors"
              >
                Docs
              </Link>
              <Link
                to="/terms"
                className="text-accent-dark/30 hover:text-accent-dark/60 transition-colors"
              >
                Terms
              </Link>
              <Link
                to="/privacy"
                className="text-accent-dark/30 hover:text-accent-dark/60 transition-colors"
              >
                Privacy
              </Link>
              <Link
                to="https://github.com/HackArchive/Orion-finance"
                target="_blank"
                className="text-accent-dark/30 hover:text-accent-dark/60 transition-colors"
              >
                GitHub
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </motion.main>
  );
}
