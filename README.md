# Orion Fi

Decentralized perpetual futures exchange on Algorand with an oracle-anchored AMM.

Traders open leveraged long/short positions on crypto assets using USDC as collateral. Instead of matching buyers with sellers through an order book, every trade executes against a shared liquidity vault at the oracle price -- zero slippage, instant fills, and deep liquidity from day one.

## The Problem

Perpetual futures are the most traded instrument in crypto, yet almost all volume sits on centralized exchanges. Existing on-chain perp DEXs suffer from thin order books, high slippage, and poor UX. Algorand's fast finality and low fees make it ideal for on-chain trading, but there's no native perp protocol.

## The Solution

Orion Fi removes the order book entirely. Liquidity providers deposit USDC into a **Vault** that acts as the counterparty to every trade. Prices come from **Pyth Network** via an on-chain oracle, so traders get fair market execution regardless of on-chain depth. LPs earn trading fees and profit when traders lose -- a sustainable yield source tied to real protocol revenue.

## Architecture

```
                          +------------------+
                          |   Pyth Network   |
                          |  (Price Feeds)   |
                          +--------+---------+
                                   |
                                   v
+-------------+          +------------------+          +---------------------+
|             |  update   |                  |  read    |                     |
|  Publisher  +---------->|  PriceOracle     |<---------+   PerpetualDEX      |
|             |  price    |                  |  price   |                     |
+-------------+          +------------------+          |  openPosition()     |
                                                       |  closePosition()    |
                         +------------------+          |  liquidatePosition()|
                         | FundingRate      |  funding |                     |
                         | Manager          +--------->|                     |
                         |                  |  rate    +---------+-----------+
                         +------------------+                    |
                                                      margin    |  payout
                                                      deposit   |  on close
                                                                 v
              +-----------+                  +---------------------+
              |           |   deposit USDC   |                     |
              |    LP     +----------------->|      Vault          |
              | Provider  |<-----------------+                     |
              |           |   shares + yield | deposit()           |
              +-----------+                  | withdraw()          |
                                             | payTrader()         |
              +-----------+   send USDC      | recordTraderLoss()  |
              |           +----------------->|                     |
              |  Trader   |<-----------------+                     |
              |           |   payout / PnL   +---------------------+
              +-----------+
```

## Features

**Trading**

- Long/short perpetual futures on ETH, BTC, and ALGO
- Up to 100x leverage with USDC collateral
- Oracle-priced execution -- no slippage, no front-running
- Automated liquidation with keeper incentives
- Funding rate mechanism to balance long/short interest

**Vault (LP Pool)**

- Deposit USDC, receive proportional shares
- Earn trading fees + net trader losses as yield
- Share price appreciates as the pool grows
- Withdrawal fee protects remaining LPs
- Utilization caps prevent over-exposure

**On-Chain Infrastructure**

- 4 Algorand TypeScript smart contracts compiled to TEAL
- BoxMap storage for positions, prices, and LP data -- no user opt-in required
- SignedValue pattern for PnL math (AVM has no signed integers)
- Fee pooling on all inner transactions

**Frontend**

- Real-time TradingView charts
- Live price feeds from Pyth Network
- Multi-wallet support (Pera, Defly, Exodus, Lute)
- Market overview with sparkline charts

## Smart Contracts

| Contract               | Purpose                                                                   |
| ---------------------- | ------------------------------------------------------------------------- |
| **PriceOracle**        | Publisher-authorized price feeds with staleness and confidence validation |
| **PerpetualDEX**       | Core trading engine -- open, close, and liquidate leveraged positions     |
| **Vault**              | LP pool and trade counterparty -- share-based deposits, trader payouts    |
| **FundingRateManager** | Calculates funding rates from long/short open interest imbalance          |

## Tech Stack

| Layer           | Technology                           |
| --------------- | ------------------------------------ |
| Smart Contracts | Algorand TypeScript (PuyaTs), ARC-56 |
| Frontend        | React 18, TypeScript, Vite           |
| Styling         | Tailwind CSS, Framer Motion          |
| Charts          | TradingView                          |
| Wallet          | @txnlab/use-wallet-react             |
| Blockchain SDK  | algosdk v3, AlgoKit Utils v6         |
| Price Feeds     | Pyth Network                         |
