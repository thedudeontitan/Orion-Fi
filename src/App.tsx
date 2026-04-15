import { BrowserRouter, Route, Routes } from "react-router-dom";
import { WalletProvider } from "@txnlab/use-wallet-react";
import Navbar from "./components/Navbar";
import LandingPage from "./pages/LandingPage";
import Markets from "./pages/Markets";
import Trade from "./pages/Trade";
import Home from "./pages/Home";
import Liquidity from "./pages/Liquidity";
import { walletManager } from "./services/algorand/modern-wallet";

export default function App() {
  return (
    <WalletProvider manager={walletManager}>
      <div data-rk className="min-h-screen bg-surface text-accent-dark font-sans">
        <BrowserRouter>
          <Navbar />
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/home" element={<Home />} />
            <Route path="/markets" element={<Markets />} />
            <Route path="/trade/:symbol" element={<Trade />} />
            <Route path="/earn/liquidity" element={<Liquidity />} />
          </Routes>
        </BrowserRouter>
      </div>
    </WalletProvider>
  );
}
