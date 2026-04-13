import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { useWallet } from "@txnlab/use-wallet-react";
import TradingViewWidget from "../components/TradingView";
import { Symbols } from "../types";
import { getSymbolPrice } from "../utils/GetSymbolPrice";
import { formatAddress } from "../services/algorand/modern-wallet";

interface Position {
  id: number;
  symbol: string;
  size: number;
  entryPrice: number;
  margin: number;
  leverage: number;
  isLong: boolean;
  timestamp: number;
}

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

const slideIn = {
  hidden: { x: 200, opacity: 0 },
  show: {
    x: 0,
    opacity: 1,
    transition: { type: "spring" as const, stiffness: 100, damping: 20 },
  },
};

export default function Trade() {
  const { symbol } = useParams();
  const { activeWallet, activeAddress } = useWallet();

  const isConnected = Boolean(activeWallet && activeAddress);

  const [positions, setPositions] = useState<Position[]>([]);
  const [isTrading, setIsTrading] = useState(false);

  const [price, setPrice] = useState<number>(0);
  const [previousPrice, setPreviousPrice] = useState<number>(0);
  const [priceChange, setPriceChange] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<"MARKET" | "LIMIT">("MARKET");
  const [orderType, setOrderType] = useState<"BUY" | "SELL">("BUY");
  const [amount, setAmount] = useState<string>("100");
  const [leverage, setLeverage] = useState<number>(10);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    let isInitialFetch = true;

    const fetchPrice = async () => {
      if (symbol) {
        try {
          const newPrice = await getSymbolPrice(symbol as keyof typeof Symbols);
          if (isInitialFetch) {
            setPrice(newPrice);
            setPreviousPrice(newPrice);
            const mockChanges = {
              ETHUSD: -2.34,
              BTCUSD: 1.87,
              SOLUSD: -0.92,
              ALGOUSD: 3.45,
            };
            setPriceChange(
              mockChanges[symbol as keyof typeof mockChanges] || 0,
            );
            isInitialFetch = false;
          } else {
            if (previousPrice > 0) {
              const change = ((newPrice - previousPrice) / previousPrice) * 100;
              setPriceChange(change);
            }
            setPreviousPrice(price);
            setPrice(newPrice);
          }
        } catch (error) {
          console.error("Error fetching real-time price:", error);
        }
      }
    };

    fetchPrice();
    intervalId = setInterval(fetchPrice, 5000);
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [symbol, price, previousPrice]);

  const currentSymbol = symbol?.replace("USD", "") || "ETH";
  const indexPrice =
    price > 0
      ? price.toLocaleString(undefined, {
          minimumFractionDigits: price < 1 ? 6 : 2,
          maximumFractionDigits: price < 1 ? 8 : 2,
        })
      : "0.00";
  const fundingRate = "-0.0028%/hr";
  const marketSkew = "96.46K";

  const handleTrade = async () => {
    if (!isConnected) {
      alert("Please connect your wallet first");
      return;
    }
    if (!symbol) {
      alert("No symbol selected");
      return;
    }

    const marginAmount = parseFloat(amount);
    if (isNaN(marginAmount) || marginAmount <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    setIsTrading(true);
    try {
      // Simulate a small delay for UX
      await new Promise((r) => setTimeout(r, 500));

      const newPosition: Position = {
        id: Date.now(),
        symbol: symbol.toUpperCase(),
        size: marginAmount * leverage * (orderType === "SELL" ? -1 : 1),
        entryPrice: price,
        margin: marginAmount,
        leverage,
        isLong: orderType === "BUY",
        timestamp: Date.now(),
      };

      setPositions((prev) => [...prev, newPosition]);
      setAmount("100");
    } finally {
      setIsTrading(false);
    }
  };

  const handleClosePosition = (positionId: number) => {
    setPositions((prev) => prev.filter((p) => p.id !== positionId));
  };

  const totalUnrealizedPnL = positions.reduce(
    (sum, pos) => sum + Math.abs(pos.size) * 0.01,
    0,
  );
  const marginUsed = positions.reduce((sum, pos) => sum + pos.margin, 0);

  const iconMap: { [key: string]: string } = {
    ETH: "/eth.png",
    BTC: "/btc.png",
    SOL: "/sol.png",
    ALGO: "/algorand.png",
  };

  return (
    <motion.div
      className="min-h-screen mt-16 bg-surface"
      initial="hidden"
      animate="show"
      variants={container}
    >
      {/* Header */}
      <motion.div
        className="px-6 pt-6 pb-4 border-b border-accent/[0.04]"
        variants={item}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 max-w-[1600px] mx-auto">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-accent/[0.04] flex items-center justify-center">
                {iconMap[currentSymbol] ? (
                  <img
                    src={iconMap[currentSymbol]}
                    alt={currentSymbol}
                    className="w-5 h-5"
                  />
                ) : (
                  <span className="font-bold text-sm text-accent-dark">
                    {currentSymbol}
                  </span>
                )}
              </div>
              <h1 className="text-lg font-semibold text-accent-dark">
                {currentSymbol} / USD
              </h1>
            </div>

            <motion.div
              className="text-2xl font-bold font-mono"
              style={{ color: priceChange >= 0 ? "#10b981" : "#ef4444" }}
              key={price}
              initial={{ scale: 1.03, opacity: 0.8 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              {price > 0 ? (
                <>
                  $
                  {price.toLocaleString(undefined, {
                    minimumFractionDigits: price < 1 ? 6 : 2,
                    maximumFractionDigits: price < 1 ? 8 : 2,
                  })}
                  <span
                    className={`text-sm ml-2 px-2 py-0.5 rounded-lg ${
                      priceChange >= 0
                        ? "bg-success/10 text-success"
                        : "bg-danger/10 text-danger"
                    }`}
                  >
                    {priceChange >= 0 ? "+" : ""}
                    {priceChange.toFixed(2)}%
                  </span>
                </>
              ) : (
                <span className="text-accent-dark/30">Loading...</span>
              )}
            </motion.div>

            {/* Market stats */}
            <div className="flex flex-wrap gap-6 text-sm">
              {[
                { label: "Index Price", value: indexPrice },
                { label: "Funding Rate", value: fundingRate },
                { label: "Market Skew", value: marketSkew },
              ].map((stat) => (
                <div key={stat.label}>
                  <div className="text-[10px] text-accent-dark/25 uppercase tracking-wider">
                    {stat.label}
                  </div>
                  <div className="font-medium text-accent-dark/70 font-mono text-sm">
                    {stat.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {isConnected && activeAddress && (
              <div className="flex items-center space-x-2 px-3 py-2 rounded-xl bg-accent/[0.03] border border-accent/[0.06]">
                <div className="w-2 h-2 bg-success rounded-full animate-glow" />
                <span className="text-xs font-mono text-accent-dark/60">
                  {formatAddress(activeAddress)}
                </span>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Main content */}
      <motion.div className="px-6 pt-4 max-w-[1600px] mx-auto" variants={item}>
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Chart */}
          <motion.div className="flex-1 order-2 lg:order-1" variants={item}>
            <div className="h-[400px] lg:h-[600px] rounded-2xl overflow-hidden border border-accent/[0.04] bg-surface-50">
              <TradingViewWidget symbol={`${currentSymbol}USD`} />
            </div>
          </motion.div>

          {/* Trading Panel */}
          <motion.div
            className="w-full lg:w-80 lg:flex-shrink-0 order-1 lg:order-2"
            variants={slideIn}
          >
            <div className="rounded-2xl p-5 h-fit border border-accent/[0.06] bg-surface-50/80 backdrop-blur-xl">
              {/* Market/Limit tabs */}
              <div className="flex mb-5 bg-accent/[0.03] rounded-xl p-1">
                {["MARKET", "LIMIT"].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab as "MARKET" | "LIMIT")}
                    className={`flex-1 py-2 px-4 rounded-lg text-xs font-semibold transition-all duration-200 ${
                      activeTab === tab
                        ? "bg-accent/[0.08] text-accent-dark"
                        : "text-accent-dark/30 hover:text-accent-dark/50"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Buy/Sell toggle */}
              <div className="flex mb-5 bg-accent/[0.03] rounded-xl p-1">
                {["BUY", "SELL"].map((type) => (
                  <motion.button
                    key={type}
                    onClick={() => setOrderType(type as "BUY" | "SELL")}
                    className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-bold transition-all duration-200 ${
                      orderType === type
                        ? type === "BUY"
                          ? "bg-success text-white shadow-glow-success"
                          : "bg-danger text-white shadow-glow-danger"
                        : "text-accent-dark/30"
                    }`}
                    whileTap={{ scale: 0.97 }}
                  >
                    {type}
                  </motion.button>
                ))}
              </div>

              {/* Amount input */}
              <div className="mb-4">
                <label className="block text-[10px] mb-2 font-medium text-accent-dark/30 uppercase tracking-wider">
                  Amount
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-4 py-3 text-sm rounded-xl bg-accent/[0.03] border border-accent/[0.06] text-accent-dark placeholder-accent-dark/30 focus:border-accent/30 transition-colors"
                    placeholder="0.00"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <span className="text-accent-dark/40 font-medium text-xs bg-accent/[0.04] px-2 py-1 rounded-lg">
                      USDC
                    </span>
                  </div>
                </div>
              </div>

              {/* Leverage */}
              <div className="mb-5">
                <div className="flex justify-between items-center mb-3">
                  <label className="text-[10px] text-accent-dark/30 font-medium uppercase tracking-wider">
                    Leverage
                  </label>
                  <span className="text-accent-dark font-bold text-sm bg-accent/[0.04] px-2 py-0.5 rounded-lg">
                    {leverage}x
                  </span>
                </div>

                <div className="relative mb-2">
                  <input
                    type="range"
                    min="1"
                    max="100"
                    value={leverage}
                    onChange={(e) => setLeverage(Number(e.target.value))}
                    className="w-full h-1.5 rounded-lg appearance-none cursor-pointer leverage-slider"
                    style={{
                      background: `linear-gradient(90deg, #10b981 0%, #6366f1 50%, #8b5cf6 100%)`,
                    }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-accent-dark/20">
                  <span>1x</span>
                  <span>100x</span>
                </div>
              </div>

              {/* Trading Status */}
              {isConnected && (
                <div className="mb-4 p-3 rounded-xl bg-accent/[0.02] border border-accent/[0.04] space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-accent-dark/30">Position Size</span>
                    <span className="text-accent-dark/70 font-mono">
                      ${((parseFloat(amount) || 0) * leverage).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              {/* Trade button */}
              <motion.button
                onClick={handleTrade}
                disabled={!isConnected || isTrading}
                className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all duration-300 disabled:opacity-40 ${
                  !isConnected
                    ? "bg-accent/[0.06] text-accent-dark/40"
                    : orderType === "BUY"
                      ? "text-accent-dark shadow-glow-success"
                      : "text-accent-dark shadow-glow-danger"
                }`}
                style={{
                  background: !isConnected
                    ? undefined
                    : orderType === "BUY"
                      ? "linear-gradient(135deg, #059669 0%, #10b981 100%)"
                      : "linear-gradient(135deg, #dc2626 0%, #ef4444 100%)",
                }}
                whileHover={isConnected ? { scale: 1.01 } : {}}
                whileTap={isConnected ? { scale: 0.98 } : {}}
              >
                {!isConnected
                  ? "Connect Wallet"
                  : isTrading
                    ? "Processing..."
                    : `${orderType} / ${orderType === "BUY" ? "LONG" : "SHORT"}`}
              </motion.button>
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Bottom - Positions */}
      <motion.div
        className="px-6 mt-4 mb-8 max-w-[1600px] mx-auto"
        variants={item}
      >
        <div className="rounded-2xl border border-accent/[0.06] bg-accent/[0.01] overflow-hidden">
          {/* Tabs */}
          <div className="flex items-center space-x-6 px-6 border-b border-accent/[0.06]">
            {["Positions", "Orders", "History"].map((tab, idx) => (
              <button
                key={tab}
                className={`py-4 text-sm font-medium transition-colors relative ${
                  idx === 0
                    ? "text-accent-dark"
                    : "text-accent-dark/30 hover:text-accent-dark/50"
                }`}
              >
                {tab}
                {idx === 0 && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-accent rounded-full" />
                )}
              </button>
            ))}
            <div className="ml-auto flex items-center space-x-2 py-4">
              <input type="checkbox" className="accent-accent rounded" />
              <span className="text-xs text-accent-dark/25">Include Fees</span>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {!isConnected ? (
              <div className="text-center py-8 text-sm text-accent-dark/25">
                Connect wallet to view positions
              </div>
            ) : positions.length === 0 ? (
              <div className="text-center py-8 text-sm text-accent-dark/25">
                No open positions
              </div>
            ) : (
              <div className="space-y-3">
                {positions.map((position) => (
                  <motion.div
                    key={position.id}
                    className="p-4 rounded-xl border border-accent/[0.04] bg-accent/[0.02] hover:border-accent/[0.08] transition-all duration-200"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-accent-dark">
                          {position.symbol}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-lg text-xs font-bold ${
                            position.isLong
                              ? "bg-success/10 text-success"
                              : "bg-danger/10 text-danger"
                          }`}
                        >
                          {position.isLong ? "LONG" : "SHORT"}{" "}
                          {position.leverage}x
                        </span>
                      </div>
                      <button
                        onClick={() => handleClosePosition(position.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-danger/10 text-danger hover:bg-danger/20 transition-colors"
                      >
                        Close
                      </button>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                      {[
                        {
                          label: "Size",
                          value: `$${Math.abs(position.size).toFixed(2)}`,
                        },
                        {
                          label: "Entry Price",
                          value: `$${position.entryPrice.toLocaleString(undefined, {
                            minimumFractionDigits: position.entryPrice < 1 ? 6 : 2,
                            maximumFractionDigits: position.entryPrice < 1 ? 8 : 2,
                          })}`,
                        },
                        {
                          label: "Margin",
                          value: `$${position.margin.toFixed(2)}`,
                        },
                        {
                          label: "Unrealized PnL",
                          value: `$${(Math.abs(position.size) * 0.01).toFixed(2)}`,
                          isProfit: true,
                        },
                      ].map((col) => (
                        <div key={col.label}>
                          <div className="text-[10px] text-accent-dark/25 uppercase tracking-wider mb-0.5">
                            {col.label}
                          </div>
                          <div
                            className={
                              col.isProfit
                                ? "text-success font-medium"
                                : "text-accent-dark/70"
                            }
                          >
                            {col.value}
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                ))}

                {/* Portfolio Summary */}
                {positions.length > 0 && (
                  <div className="p-4 rounded-xl border border-accent/10 bg-accent/[0.03] mt-4">
                    <div className="text-xs font-medium text-accent-dark/40 mb-3 uppercase tracking-wider">
                      Portfolio Summary
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                      <div>
                        <div className="text-[10px] text-accent-dark/25 uppercase tracking-wider mb-0.5">
                          Total PnL
                        </div>
                        <div
                          className={
                            totalUnrealizedPnL >= 0
                              ? "text-success font-medium"
                              : "text-danger font-medium"
                          }
                        >
                          ${totalUnrealizedPnL.toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-accent-dark/25 uppercase tracking-wider mb-0.5">
                          Margin Used
                        </div>
                        <div className="text-accent-dark/70">
                          ${marginUsed.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Leverage slider styles */}
      <style>{`
        .leverage-slider::-webkit-slider-thumb {
          appearance: none;
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
          border: 2px solid #5b21b6;
          box-shadow: 0 0 8px rgba(99, 102, 241, 0.3);
          transition: all 0.2s ease;
        }
        .leverage-slider::-webkit-slider-thumb:hover {
          box-shadow: 0 0 12px rgba(99, 102, 241, 0.5);
          transform: scale(1.1);
        }
        .leverage-slider::-moz-range-thumb {
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
          border: 2px solid #5b21b6;
          box-shadow: 0 0 8px rgba(99, 102, 241, 0.3);
        }
        .leverage-slider::-webkit-slider-track {
          height: 6px;
          border-radius: 3px;
        }
        .leverage-slider::-moz-range-track {
          height: 6px;
          border-radius: 3px;
          border: none;
        }
      `}</style>
    </motion.div>
  );
}
