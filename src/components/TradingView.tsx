import { memo, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

interface TradingViewWidgetProps {
  symbol: string;
  onIntervalChange?: (interval: string) => void;
}

function TradingViewWidget({
  symbol,
  onIntervalChange,
}: TradingViewWidgetProps) {
  const container = useRef<HTMLDivElement>(null);
  const scriptLoaded = useRef(false);
  const [selectedInterval, setSelectedInterval] = useState("30m");

  const timeframes = [
    { label: "1m", value: "1" },
    { label: "5m", value: "5" },
    { label: "15m", value: "15" },
    { label: "30m", value: "30" },
    { label: "1hr", value: "60" },
    { label: "4hr", value: "240" },
    { label: "D", value: "1D" },
  ];

  const handleIntervalChange = (interval: string, label: string) => {
    setSelectedInterval(label);
    onIntervalChange?.(interval);
    if (container.current) {
      container.current.innerHTML = "";
      scriptLoaded.current = false;
      loadWidget(interval);
    }
  };

  const loadWidget = (interval: string = "30") => {
    if (scriptLoaded.current || !container.current) return;

    const script = document.createElement("script");
    script.src =
      "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = `
      {
          "autosize": true,
          "width": "100%",
          "height": "100%",
          "symbol": "${symbol}",
          "interval": "${interval}",
          "timezone": "Etc/UTC",
          "theme": "light",
          "style": "1",
          "locale": "en",
          "borderColor": "#e9deff",
          "backgroundColor": "#faf7ff",
          "gridColor": "rgba(124, 58, 237, 0.08)",
          "hide_top_toolbar": true,
          "withdateranges": false,
          "hide_legend": true,
          "allow_symbol_change": false,
          "calendar": false,
          "studies": [],
          "hide_volume": true,
          "hide_side_toolbar": true,
          "details": false,
          "hotlist": false,
          "enable_publishing": false,
          "hide_idea_button": true,
          "hide_share_button": true,
          "save_image": false,
          "toolbar_bg": "#faf7ff",
          "container_id": "pricechart_tv",
          "show_popup_button": false,
          "popup_width": "1000",
          "popup_height": "650",
          "no_referral_id": true,
          "overrides": {
            "paneProperties.background": "#faf7ff",
            "paneProperties.backgroundType": "solid",
            "scalesProperties.backgroundColor": "#faf7ff",
            "scalesProperties.lineColor": "rgba(124, 58, 237, 0.16)",
            "scalesProperties.textColor": "rgba(91, 33, 182, 0.7)",
            "mainSeriesProperties.candleStyle.upColor": "#10b981",
            "mainSeriesProperties.candleStyle.downColor": "#ef4444",
            "mainSeriesProperties.candleStyle.borderUpColor": "#10b981",
            "mainSeriesProperties.candleStyle.borderDownColor": "#ef4444",
            "mainSeriesProperties.candleStyle.wickUpColor": "#10b981",
            "mainSeriesProperties.candleStyle.wickDownColor": "#ef4444"
          },
          "support_host": "https://www.tradingview.com"
        }`;
    container.current.appendChild(script);
    scriptLoaded.current = true;
  };

  useEffect(() => {
    if (container.current) {
      container.current.innerHTML = "";
    }
    scriptLoaded.current = false;

    const timer = setTimeout(() => {
      loadWidget();
    }, 100);

    return () => {
      clearTimeout(timer);
      if (container.current) {
        container.current.innerHTML = "";
      }
      scriptLoaded.current = false;
    };
  }, [symbol]);

  return (
    <div className="relative flex h-full w-full flex-col">
      {/* Timeframe Header */}
      <motion.div
        className="flex h-10 items-center justify-between px-4 border-b border-accent/[0.04]"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex gap-0.5">
          {timeframes.map((tf, index) => (
            <motion.button
              key={tf.label}
              onClick={() => handleIntervalChange(tf.value, tf.label)}
              className={`inline-flex select-none items-center justify-center whitespace-nowrap rounded-lg font-medium outline-none transition-all h-7 text-xs px-2.5 ${
                selectedInterval === tf.label
                  ? "text-accent-dark bg-accent/15"
                  : "text-accent-dark/25 hover:text-accent-dark/50 hover:bg-accent/[0.03]"
              }`}
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + index * 0.03 }}
            >
              {tf.label}
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* Chart Container */}
      <motion.div
        id="pricechart_tv"
        className="w-full flex-1"
        ref={container}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
      >
        <div className="tradingview-widget-container__widget rounded h-full"></div>
      </motion.div>
    </div>
  );
}

export default memo(TradingViewWidget);
