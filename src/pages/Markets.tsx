import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { getSymbolPrice } from "../utils/GetSymbolPrice";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

const item = {
  hidden: { y: 16, opacity: 0 },
  show: { y: 0, opacity: 1, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const } },
};

interface MarketData {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  icon: string;
  sparklineData: number[];
  category: string;
}

const initialMarkets: Omit<MarketData, 'price'>[] = [
  {
    symbol: "ETH", name: "Ethereum", change24h: -3.83, icon: "/eth.png",
    sparklineData: [4200, 4150, 4100, 4050, 4000, 4020, 4071], category: "L1/L2"
  },
  {
    symbol: "BTC", name: "Bitcoin", change24h: -1.65, icon: "/btc.png",
    sparklineData: [115000, 114500, 114000, 113800, 113500, 113600, 113651], category: "L1/L2"
  },
  {
    symbol: "ALGO", name: "Algorand", change24h: 1.24, icon: "/algorand.png",
    sparklineData: [0.35, 0.34, 0.36, 0.37, 0.35, 0.36, 0.35], category: "L1/L2"
  }
];

const categories = ["All", "AI", "Meme", "L1/L2", "Forex", "Metals"];

const MiniChart = ({ data, isPositive }: { data: number[], isPositive: boolean }) => {
  const width = 100;
  const height = 40;
  const padding = 5;

  if (!data || data.length < 2) return <div className="w-[100px] h-[40px]" />;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((value, index) => {
    const x = padding + (index / (data.length - 1)) * (width - 2 * padding);
    const y = padding + ((max - value) / range) * (height - 2 * padding);
    return `${x},${y}`;
  }).join(' ');

  const gradientId = `chart-gradient-${isPositive ? 'up' : 'down'}`;

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={isPositive ? '#10b981' : '#ef4444'} stopOpacity="0.3" />
          <stop offset="100%" stopColor={isPositive ? '#10b981' : '#ef4444'} stopOpacity="1" />
        </linearGradient>
      </defs>
      <polyline
        points={points}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export default function Markets() {
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [markets, setMarkets] = useState<MarketData[]>([]);
  const [filteredMarkets, setFilteredMarkets] = useState<MarketData[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchPrices = async () => {
      setLoading(true);
      try {
        const marketsWithPrices = await Promise.all(
          initialMarkets.map(async (market) => {
            try {
              const price = await getSymbolPrice(`${market.symbol}USD`);
              return { ...market, price };
            } catch (error) {
              console.error(`Failed to fetch price for ${market.symbol}:`, error);
              return { ...market, price: 0 };
            }
          })
        );
        setMarkets(marketsWithPrices);
      } catch (error) {
        console.error("Error fetching market prices:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPrices();
    const interval = setInterval(fetchPrices, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedCategory === "All") {
      setFilteredMarkets(markets);
    } else {
      setFilteredMarkets(markets.filter(market => market.category === selectedCategory));
    }
  }, [selectedCategory, markets]);

  const handleMarketClick = (symbol: string) => {
    navigate(`/trade/${symbol}USD`);
  };

  return (
    <motion.div
      className="min-h-screen pt-20 bg-surface"
      initial="hidden"
      animate="show"
      variants={container}
    >
      <div className="max-w-[1400px] mx-auto px-6 py-8">
        {/* Header */}
        <motion.div className="mb-8" variants={item}>
          <h1 className="text-3xl font-bold text-accent-dark mb-1">Markets</h1>
          <p className="text-accent-dark/40">Discover and trade crypto perpetuals</p>
        </motion.div>

        {/* Category Filters */}
        <motion.div className="flex items-center space-x-1 mb-6 overflow-x-auto pb-2" variants={item}>
          {categories.map((category) => (
            <motion.button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                selectedCategory === category
                  ? 'text-accent-dark bg-accent/15 border border-accent/20'
                  : 'text-accent-dark/40 hover:text-accent-dark/60 hover:bg-accent/[0.03] border border-transparent'
              }`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {category}
            </motion.button>
          ))}
        </motion.div>

        {/* Market Table */}
        <motion.div
          className="rounded-2xl overflow-hidden border border-accent/[0.06] bg-accent/[0.01]"
          variants={item}
        >
          {/* Table Header */}
          <div className="grid grid-cols-4 px-6 py-4 border-b border-accent/[0.06]">
            <div className="text-xs font-medium text-accent-dark/30 uppercase tracking-wider">Market</div>
            <div className="text-xs font-medium text-accent-dark/30 text-right uppercase tracking-wider">Price</div>
            <div className="text-xs font-medium text-accent-dark/30 text-right uppercase tracking-wider">24h Change</div>
            <div className="text-xs font-medium text-accent-dark/30 text-right uppercase tracking-wider">Last 24h</div>
          </div>

          {/* Market Rows */}
          <div>
            {loading ? (
              <div className="flex justify-center items-center py-16">
                <div className="flex items-center space-x-3">
                  <div className="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                  <span className="text-sm text-accent-dark/40">Loading markets...</span>
                </div>
              </div>
            ) : filteredMarkets.map((market, index) => (
              <motion.div
                key={market.symbol}
                onClick={() => handleMarketClick(market.symbol)}
                className="grid grid-cols-4 px-6 py-4 cursor-pointer border-b border-accent/[0.03] hover:bg-accent/[0.02] transition-all duration-200"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                whileTap={{ scale: 0.995 }}
              >
                {/* Market Info */}
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-xl bg-accent/[0.04] flex items-center justify-center">
                    {market.icon.startsWith('/') ? (
                      <img src={market.icon} alt={market.name} className="w-5 h-5" />
                    ) : (
                      market.icon
                    )}
                  </div>
                  <div>
                    <div className="font-semibold text-accent-dark text-sm">{market.symbol}</div>
                    <div className="text-xs text-accent-dark/30">{market.name}</div>
                  </div>
                </div>

                {/* Price */}
                <div className="text-right font-mono font-medium text-accent-dark self-center text-sm">
                  ${market.price.toLocaleString(undefined, {
                    minimumFractionDigits: market.price < 1 ? 6 : 2,
                    maximumFractionDigits: market.price < 1 ? 8 : 2
                  })}
                </div>

                {/* 24h Change */}
                <div className={`text-right font-medium self-center text-sm ${
                  market.change24h >= 0 ? 'text-success' : 'text-danger'
                }`}>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs ${
                    market.change24h >= 0 ? 'bg-success/10' : 'bg-danger/10'
                  }`}>
                    {market.change24h >= 0 ? '+' : ''}{market.change24h.toFixed(2)}%
                  </span>
                </div>

                {/* Mini Chart */}
                <div className="flex justify-end self-center">
                  <MiniChart
                    data={market.sparklineData}
                    isPositive={market.change24h >= 0}
                  />
                </div>
              </motion.div>
            ))}
            {!loading && filteredMarkets.length === 0 && (
              <div className="flex justify-center items-center py-16">
                <div className="text-sm text-accent-dark/30">
                  No markets found for this category
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Footer Info */}
        <motion.div className="mt-6 text-center" variants={item}>
          <p className="text-xs text-accent-dark/20">
            Real-time market data &middot; Updated every 30 seconds
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
}
