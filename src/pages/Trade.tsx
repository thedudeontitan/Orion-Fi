import { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { useWallet } from "@txnlab/use-wallet-react";
import TradingViewWidget from "../components/TradingView";
import { Symbols } from "../types";
import { getSymbolPrice } from "../utils/GetSymbolPrice";
import { formatAddress } from "../services/algorand/modern-wallet";
import { UsdcOptInGate } from "../components/usdc/UsdcOptInGate";
import { useOpenPosition } from "../hooks/algorand/useOpenPosition";
import { useClosePosition } from "../hooks/algorand/useClosePosition";
import { usePositions } from "../hooks/algorand/usePositions";
import { useTradeHistory } from "../hooks/algorand/useTradeHistory";
import {
  useFundingRate,
  formatFundingRate,
} from "../hooks/algorand/useFundingRate";
import { useNotification, parseAlgoError } from "../hooks/useNotification";
import { parseUsdcAmount, formatUsdc } from "../services/algorand/usdc";
import { PRICE_SCALE } from "../services/algorand/config";
import type {
  TradeHistoryEntry,
  UiPosition,
} from "../services/algorand/types";

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

/**
 * Live PnL for a UI position given the current spot (Pyth) price in dollars.
 * Entry price is the on-chain entry stored at open time (1e6 scale); size is
 * notional microUSDC. Returns PnL in microUSDC (signed).
 */
function computePnlMicroUsdc(position: UiPosition, currentPriceUsd: number): bigint {
  if (currentPriceUsd <= 0) return 0n;
  const entryScaled = Number(position.entryPriceScaled);
  if (entryScaled <= 0) return 0n;
  const entryUsd = entryScaled / Number(PRICE_SCALE);
  const deltaPct = (currentPriceUsd - entryUsd) / entryUsd;
  const signed = position.isLong ? deltaPct : -deltaPct;
  const notionalMicro = Number(position.sizeMicroUsdc);
  return BigInt(Math.round(notionalMicro * signed));
}

function formatSignedUsdc(micro: bigint): string {
  const n = Number(micro) / 1_000_000;
  const sign = n >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

export default function Trade() {
  const { symbol } = useParams();
  const { activeWallet, activeAddress } = useWallet();
  const isConnected = Boolean(activeWallet && activeAddress);

  const [price, setPrice] = useState<number>(0);
  const [previousPrice, setPreviousPrice] = useState<number>(0);
  const [priceChange, setPriceChange] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<"MARKET" | "LIMIT">("MARKET");
  const [positionsTab, setPositionsTab] =
    useState<"positions" | "orders" | "history">("positions");
  const [orderType, setOrderType] = useState<"BUY" | "SELL">("BUY");
  const [amount, setAmount] = useState<string>("100");
  const [leverage, setLeverage] = useState<number>(10);

  const {
    transactionSubmitNotification,
    successNotification,
    errorNotification,
  } = useNotification();

  const openPositionMutation = useOpenPosition();
  const closePositionMutation = useClosePosition();
  const { data: positions = [] } = usePositions();
  const { data: tradeHistory = [] } = useTradeHistory();
  const { data: fundingRateRaw } = useFundingRate(symbol);

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
  const fundingRateLabel = formatFundingRate(fundingRateRaw);
  const marketSkew = "96.46K";

  const viewedSymbol = (symbol ?? "").toUpperCase();

  // Live PnL per position (microUSDC) using the current Pyth price.
  const pnlByPosition = useMemo(() => {
    const map = new Map<string, bigint>();
    for (const p of positions) {
      map.set(p.id.toString(), computePnlMicroUsdc(p, price));
    }
    return map;
  }, [positions, price]);

  const totalUnrealizedPnlMicro = useMemo(() => {
    let total = 0n;
    for (const v of pnlByPosition.values()) total += v;
    return total;
  }, [pnlByPosition]);

  const marginUsedMicro = useMemo(
    () => positions.reduce((sum, p) => sum + p.marginMicroUsdc, 0n),
    [positions],
  );

  const handleTrade = async () => {
    if (!isConnected) {
      errorNotification("Connect your wallet first");
      return;
    }
    if (!symbol) {
      errorNotification("No market selected");
      return;
    }
    const marginMicroUsdc = parseUsdcAmount(amount);
    if (marginMicroUsdc === null) {
      errorNotification("Enter a valid USDC amount");
      return;
    }
    if (price <= 0) {
      errorNotification("Price unavailable, try again in a moment");
      return;
    }

    const priceScaled = BigInt(Math.round(price * Number(PRICE_SCALE)));

    try {
      const result = await openPositionMutation.mutateAsync({
        symbol: symbol.toUpperCase(),
        marginMicroUsdc,
        leverage,
        isLong: orderType === "BUY",
        priceScaled,
      });
      transactionSubmitNotification(result.txId);
      successNotification(
        <span>
          Opened {orderType === "BUY" ? "LONG" : "SHORT"} #
          {result.positionId.toString()} ({leverage}x)
        </span>,
      );
      setAmount("100");
    } catch (err) {
      errorNotification(parseAlgoError(err));
    }
  };

  const handleClosePosition = async (position: UiPosition) => {
    const { id: positionId, symbol: posSymbol } = position;
    try {
      // Close must price the position against its own market, which may
      // differ from the currently-viewed symbol on this page.
      const livePrice = await getSymbolPrice(
        posSymbol.toUpperCase() as keyof typeof Symbols,
      );
      if (!livePrice || livePrice <= 0) {
        errorNotification("Price unavailable, try again in a moment");
        return;
      }
      const priceScaled = BigInt(Math.round(livePrice * Number(PRICE_SCALE)));

      const result = await closePositionMutation.mutateAsync({
        positionId,
        priceScaled,
      });
      transactionSubmitNotification(result.txId);
      successNotification(
        <span>
          Closed position #{positionId.toString()} — payout $
          {formatUsdc(result.payoutMicroUsdc)}
        </span>,
      );
    } catch (err) {
      errorNotification(parseAlgoError(err));
    }
  };

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
                { label: "Funding Rate", value: fundingRateLabel },
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
            <div className="rounded-2xl p-5 h-fit border border-accent/[0.06] bg-surface-50/80 backdrop-blur-xl space-y-4">
              <UsdcOptInGate>
                {/* Market/Limit tabs */}
                <div className="flex bg-accent/[0.03] rounded-xl p-1">
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
                <div className="flex bg-accent/[0.03] rounded-xl p-1 mt-4">
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
                <div className="mt-4">
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
                <div className="mt-4">
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

                {/* Position size preview */}
                <div className="p-3 rounded-xl bg-accent/[0.02] border border-accent/[0.04] space-y-2 mt-4">
                  <div className="flex justify-between text-xs">
                    <span className="text-accent-dark/30">Position Size</span>
                    <span className="text-accent-dark/70 font-mono">
                      ${((parseFloat(amount) || 0) * leverage).toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Trade button */}
                <motion.button
                  onClick={handleTrade}
                  disabled={openPositionMutation.isPending}
                  className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all duration-300 disabled:opacity-40 mt-4 ${
                    orderType === "BUY"
                      ? "text-accent-dark shadow-glow-success"
                      : "text-accent-dark shadow-glow-danger"
                  }`}
                  style={{
                    background:
                      orderType === "BUY"
                        ? "linear-gradient(135deg, #059669 0%, #10b981 100%)"
                        : "linear-gradient(135deg, #dc2626 0%, #ef4444 100%)",
                  }}
                  whileHover={
                    !openPositionMutation.isPending ? { scale: 1.01 } : {}
                  }
                  whileTap={
                    !openPositionMutation.isPending ? { scale: 0.98 } : {}
                  }
                >
                  {openPositionMutation.isPending
                    ? "Processing..."
                    : `${orderType} / ${orderType === "BUY" ? "LONG" : "SHORT"}`}
                </motion.button>
              </UsdcOptInGate>
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
            {(
              [
                { id: "positions", label: "Positions" },
                { id: "orders", label: "Orders" },
                { id: "history", label: "History" },
              ] as const
            ).map((tab) => {
              const active = positionsTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setPositionsTab(tab.id)}
                  className={`py-4 text-sm font-medium transition-colors relative ${
                    active
                      ? "text-accent-dark"
                      : "text-accent-dark/30 hover:text-accent-dark/50"
                  }`}
                >
                  {tab.label}
                  {active && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-accent rounded-full" />
                  )}
                </button>
              );
            })}
            <div className="ml-auto flex items-center space-x-2 py-4">
              <input type="checkbox" className="accent-accent rounded" />
              <span className="text-xs text-accent-dark/25">Include Fees</span>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {!isConnected ? (
              <div className="text-center py-8 text-sm text-accent-dark/25">
                Connect wallet to view {positionsTab}
              </div>
            ) : positionsTab === "positions" ? (
              positions.length === 0 ? (
                <div className="text-center py-8 text-sm text-accent-dark/25">
                  No open positions
                </div>
              ) : (
                <div className="space-y-3">
                  {positions.map((position) => {
                    const pnlMicro =
                      pnlByPosition.get(position.id.toString()) ?? 0n;
                    const isProfit = pnlMicro >= 0n;
                    const entryUsd =
                      Number(position.entryPriceScaled) / Number(PRICE_SCALE);
                    const isClosing =
                      closePositionMutation.isPending &&
                      closePositionMutation.variables?.positionId ===
                        position.id;
                    const isOtherMarket =
                      position.symbol.toUpperCase() !== viewedSymbol;
                    return (
                      <motion.div
                        key={position.id.toString()}
                        className={`p-4 rounded-xl border border-accent/[0.04] bg-accent/[0.02] hover:border-accent/[0.08] transition-all duration-200 ${
                          isOtherMarket ? "opacity-70" : ""
                        }`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: isOtherMarket ? 0.7 : 1, y: 0 }}
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
                              {position.leverage.toString()}x
                            </span>
                            <span className="text-[10px] font-mono text-accent-dark/30">
                              #{position.id.toString()}
                            </span>
                            {isOtherMarket && (
                              <span className="text-[10px] font-medium text-accent-dark/40 bg-accent/[0.06] px-1.5 py-0.5 rounded">
                                Other market
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => handleClosePosition(position)}
                            disabled={closePositionMutation.isPending}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-danger/10 text-danger hover:bg-danger/20 transition-colors disabled:opacity-50"
                          >
                            {isClosing ? "Closing…" : "Close"}
                          </button>
                        </div>

                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                          <div>
                            <div className="text-[10px] text-accent-dark/25 uppercase tracking-wider mb-0.5">
                              Size
                            </div>
                            <div className="text-accent-dark/70 font-mono">
                              ${formatUsdc(position.sizeMicroUsdc)}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] text-accent-dark/25 uppercase tracking-wider mb-0.5">
                              Entry Price
                            </div>
                            <div className="text-accent-dark/70 font-mono">
                              $
                              {entryUsd.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] text-accent-dark/25 uppercase tracking-wider mb-0.5">
                              Margin
                            </div>
                            <div className="text-accent-dark/70 font-mono">
                              ${formatUsdc(position.marginMicroUsdc)}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] text-accent-dark/25 uppercase tracking-wider mb-0.5">
                              Unrealized PnL
                            </div>
                            <div
                              className={`font-mono ${
                                isProfit ? "text-success" : "text-danger"
                              }`}
                            >
                              {formatSignedUsdc(pnlMicro)}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}

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
                            className={`font-mono ${
                              totalUnrealizedPnlMicro >= 0n
                                ? "text-success"
                                : "text-danger"
                            }`}
                          >
                            {formatSignedUsdc(totalUnrealizedPnlMicro)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-accent-dark/25 uppercase tracking-wider mb-0.5">
                            Margin Used
                          </div>
                          <div className="text-accent-dark/70 font-mono">
                            ${formatUsdc(marginUsedMicro)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-accent-dark/25 uppercase tracking-wider mb-0.5">
                            Open Positions
                          </div>
                          <div className="text-accent-dark/70 font-mono">
                            {positions.length}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            ) : positionsTab === "history" ? (
              tradeHistory.length === 0 ? (
                <div className="text-center py-8 text-sm text-accent-dark/25">
                  No closed trades yet
                </div>
              ) : (
                <TradeHistoryTable entries={tradeHistory} />
              )
            ) : (
              <div className="text-center py-8 text-sm text-accent-dark/25">
                Order book integration coming soon
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

function TradeHistoryTable({ entries }: { entries: TradeHistoryEntry[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[10px] text-accent-dark/30 uppercase tracking-wider">
            <th className="py-2 pr-4 font-medium">Market</th>
            <th className="py-2 pr-4 font-medium">Side</th>
            <th className="py-2 pr-4 font-medium">Size</th>
            <th className="py-2 pr-4 font-medium">Entry</th>
            <th className="py-2 pr-4 font-medium">Result</th>
            <th className="py-2 pr-4 font-medium">PnL</th>
            <th className="py-2 pr-4 font-medium">Closed</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => {
            const entryUsd = Number(e.entryPriceScaled) / Number(PRICE_SCALE);
            const pnlPositive = e.pnlMicroUsdc >= 0n;
            const closedDate = new Date(Number(e.closedAt) * 1000);
            return (
              <tr
                key={e.id.toString()}
                className="border-t border-accent/[0.04] hover:bg-accent/[0.02] transition-colors"
              >
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-accent-dark">
                      {e.symbol}
                    </span>
                    <span className="text-[10px] font-mono text-accent-dark/30">
                      #{e.id.toString()}
                    </span>
                  </div>
                </td>
                <td className="py-3 pr-4">
                  <span
                    className={`px-2 py-0.5 rounded-lg text-xs font-bold ${
                      e.isLong
                        ? "bg-success/10 text-success"
                        : "bg-danger/10 text-danger"
                    }`}
                  >
                    {e.isLong ? "LONG" : "SHORT"} {e.leverage.toString()}x
                  </span>
                </td>
                <td className="py-3 pr-4 font-mono text-accent-dark/70">
                  ${formatUsdc(e.sizeMicroUsdc)}
                </td>
                <td className="py-3 pr-4 font-mono text-accent-dark/70">
                  $
                  {entryUsd.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
                <td className="py-3 pr-4">
                  <span
                    className={`text-xs font-semibold ${
                      e.kind === "LIQUIDATED"
                        ? "text-danger"
                        : "text-accent-dark/60"
                    }`}
                  >
                    {e.kind === "LIQUIDATED" ? "Liquidated" : "Closed"}
                  </span>
                </td>
                <td
                  className={`py-3 pr-4 font-mono ${
                    pnlPositive ? "text-success" : "text-danger"
                  }`}
                >
                  {formatSignedUsdc(e.pnlMicroUsdc)}
                </td>
                <td className="py-3 pr-4 text-xs text-accent-dark/50 font-mono">
                  {closedDate.toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
