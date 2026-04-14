import {
  arc4,
  Contract,
  GlobalState,
  BoxMap,
  Account,
  Asset,
  Application,
  Global,
  Txn,
  uint64,
  Uint64,
  assert,
  assertMatch,
  emit,
  clone,
  itxn,
  gtxn,
  abimethod,
} from '@algorandfoundation/algorand-typescript'
import { Vault } from './Vault.algo'

type PerpPosition = {
  trader: Account
  symbol: string
  size: uint64
  entryPrice: uint64
  margin: uint64
  leverage: uint64
  isLong: boolean
  timestamp: uint64
  fundingIndex: uint64
  liquidationPrice: uint64
}

// SignedValue pattern for PnL (AVM has no signed integers)
type SignedValue = {
  magnitude: uint64
  isNegative: boolean
}

type PositionOpenedEvent = {
  positionId: uint64
  trader: Account
  symbol: string
  size: uint64
  entryPrice: uint64
  leverage: uint64
  isLong: boolean
}

type PositionClosedEvent = {
  positionId: uint64
  trader: Account
  pnlMagnitude: uint64
  pnlIsNegative: boolean
  payout: uint64
}

type PositionLiquidatedEvent = {
  positionId: uint64
  liquidator: Account
  reward: uint64
}

// Module-level constants
const BASIS_POINTS: uint64 = Uint64(10000)
const DEFAULT_TRADING_FEE: uint64 = Uint64(50) // 0.5%
const DEFAULT_FUNDING_FEE: uint64 = Uint64(10) // 0.1%
const DEFAULT_MAX_LEVERAGE: uint64 = Uint64(100)
const DEFAULT_MAINTENANCE_MARGIN: uint64 = Uint64(500) // 5%
const DEFAULT_LIQUIDATION_FEE: uint64 = Uint64(500) // 5%

/**
 * Compute signed subtraction: returns |a - b| and whether result is negative
 */
function signedSubtract(a: uint64, b: uint64): SignedValue {
  if (a >= b) {
    return { magnitude: a - b, isNegative: false }
  }
  return { magnitude: b - a, isNegative: true }
}

/**
 * Apply a signed value to a base uint64:
 * If positive, base + magnitude; if negative, base - magnitude (floored at 0).
 */
function applySignedToUint(base: uint64, signed: SignedValue): uint64 {
  if (signed.isNegative) {
    if (signed.magnitude >= base) {
      return Uint64(0)
    }
    return base - signed.magnitude
  }
  return base + signed.magnitude
}

export class PerpetualDEX extends Contract {
  // Global state
  admin = GlobalState<Account>({ key: 'admin' })
  feeCollector = GlobalState<Account>({ key: 'feeColl' })
  tradingFee = GlobalState<uint64>({ key: 'tradeFee' })
  fundingFee = GlobalState<uint64>({ key: 'fundFee' })
  maxLeverage = GlobalState<uint64>({ key: 'maxLev' })
  maintenanceMarginRatio = GlobalState<uint64>({ key: 'maintMarg' })
  liquidationFeeRatio = GlobalState<uint64>({ key: 'liqFee' })
  usdcAssetId = GlobalState<uint64>({ key: 'usdcId' })
  oracleAppId = GlobalState<uint64>({ key: 'oracleId' })
  vaultAppId = GlobalState<uint64>({ key: 'vaultId' })
  // Monotonic counter for position IDs. Deterministic so that
  // `populateAppCallResources` sees the same box key during simulation and
  // actual execution.
  nextPositionId = GlobalState<uint64>({ key: 'nxtPosId' })

  // Box storage for positions and funding data
  positions = BoxMap<uint64, PerpPosition>({ keyPrefix: 'pos_' })
  fundingRates = BoxMap<string, uint64>({ keyPrefix: 'fund_' })
  totalLongs = BoxMap<string, uint64>({ keyPrefix: 'tl_' })
  totalShorts = BoxMap<string, uint64>({ keyPrefix: 'ts_' })

  public createApplication(): void {
    this.admin.value = Txn.sender
    this.feeCollector.value = Txn.sender
    this.tradingFee.value = DEFAULT_TRADING_FEE
    this.fundingFee.value = DEFAULT_FUNDING_FEE
    this.maxLeverage.value = DEFAULT_MAX_LEVERAGE
    this.maintenanceMarginRatio.value = DEFAULT_MAINTENANCE_MARGIN
    this.liquidationFeeRatio.value = DEFAULT_LIQUIDATION_FEE
    this.usdcAssetId.value = Uint64(0)
    this.oracleAppId.value = Uint64(0)
    this.vaultAppId.value = Uint64(0)
    this.nextPositionId.value = Uint64(1)
  }

  public setupProtocol(
    feeCollector: Account,
    usdcAssetId: uint64,
    oracleAppId: uint64,
    vaultAppId: uint64,
    tradingFee: uint64,
    maxLeverage: uint64,
  ): void {
    assert(Txn.sender === this.admin.value, 'Only admin can setup protocol')
    this.feeCollector.value = feeCollector
    this.usdcAssetId.value = usdcAssetId
    this.oracleAppId.value = oracleAppId
    this.vaultAppId.value = vaultAppId
    this.tradingFee.value = tradingFee
    this.maxLeverage.value = maxLeverage
  }

  public optInUsdc(): void {
    assert(Txn.sender === this.admin.value, 'Only admin can opt in to assets')
    assert(this.usdcAssetId.value !== Uint64(0), 'USDC asset ID not set')

    itxn.assetTransfer({
      xferAsset: Asset(this.usdcAssetId.value),
      assetReceiver: Global.currentApplicationAddress,
      assetAmount: Uint64(0),
      fee: Uint64(0),
    }).submit()
  }

  /**
   * Open a new perpetual position.
   *
   * Flow (oracle-anchored AMM):
   *   1. Trader sends USDC margin to this DEX contract (gtxn asset transfer)
   *   2. DEX records the position and forwards margin to the Vault via inner txn
   *   3. Trading fee is sent to feeCollector via inner txn
   *
   * The Vault acts as the counterparty — when the trader profits, Vault pays;
   * when the trader loses, Vault keeps the margin.
   */
  public openPosition(
    symbol: string,
    leverage: uint64,
    isLong: boolean,
    price: uint64,
    marginPayment: gtxn.AssetTransferTxn,
  ): uint64 {
    const trader = Txn.sender

    // Verify leverage
    assert(leverage > Uint64(0), 'Leverage must be positive')
    assert(leverage <= this.maxLeverage.value, 'Leverage too high')
    assert(price > Uint64(0), 'Price must be positive')

    // Verify margin payment sent to this contract
    assertMatch(marginPayment, {
      assetReceiver: Global.currentApplicationAddress,
      xferAsset: Asset(this.usdcAssetId.value),
    })

    const marginAmount: uint64 = marginPayment.assetAmount
    assert(marginAmount > Uint64(0), 'Margin must be positive')

    // Collect trading fee first
    const tradingFeeAmount: uint64 = (marginAmount * this.tradingFee.value) / BASIS_POINTS
    const netMargin: uint64 = marginAmount - tradingFeeAmount

    const positionSize: uint64 = netMargin * leverage

    // Calculate liquidation price
    const liquidationPrice: uint64 = this.calculateLiquidationPrice(
      price,
      leverage,
      isLong,
    )

    // Get current funding index
    let fundingIndex: uint64 = Uint64(0)
    if (this.fundingRates(symbol).exists) {
      fundingIndex = this.fundingRates(symbol).value
    }

    // Use a monotonic counter for position IDs. Deterministic across
    // simulate/submit so `populateAppCallResources` resolves the correct box.
    const positionId: uint64 = this.nextPositionId.value
    this.nextPositionId.value = positionId + Uint64(1)

    const position: PerpPosition = {
      trader: trader,
      symbol: symbol,
      size: positionSize,
      entryPrice: price,
      margin: netMargin,
      leverage: leverage,
      isLong: isLong,
      timestamp: Global.latestTimestamp,
      fundingIndex: fundingIndex,
      liquidationPrice: liquidationPrice,
    }

    this.positions(positionId).value = clone(position)

    // Update total open interest
    if (isLong) {
      let currentLong: uint64 = Uint64(0)
      if (this.totalLongs(symbol).exists) {
        currentLong = this.totalLongs(symbol).value
      }
      this.totalLongs(symbol).value = currentLong + positionSize
    } else {
      let currentShort: uint64 = Uint64(0)
      if (this.totalShorts(symbol).exists) {
        currentShort = this.totalShorts(symbol).value
      }
      this.totalShorts(symbol).value = currentShort + positionSize
    }

    // Send trading fee to fee collector
    if (tradingFeeAmount > Uint64(0)) {
      itxn.assetTransfer({
        xferAsset: Asset(this.usdcAssetId.value),
        assetReceiver: this.feeCollector.value,
        assetAmount: tradingFeeAmount,
        fee: Uint64(0),
      }).submit()
    }

    // Move net margin into the Vault and update its accounting.
    itxn.assetTransfer({
      xferAsset: Asset(this.usdcAssetId.value),
      assetReceiver: Application(this.vaultAppId.value).address,
      assetAmount: netMargin,
      fee: Uint64(0),
    }).submit()

    arc4.abiCall<typeof Vault.prototype.recordMarginDeposit>({
      appId: Application(this.vaultAppId.value),
      method: Vault.prototype.recordMarginDeposit,
      args: [netMargin],
      fee: Uint64(0),
    })

    emit<PositionOpenedEvent>({
      positionId: positionId,
      trader: trader,
      symbol: symbol,
      size: positionSize,
      entryPrice: price,
      leverage: leverage,
      isLong: isLong,
    })

    return positionId
  }

  public closePosition(positionId: uint64, price: uint64): uint64 {
    const trader = Txn.sender

    assert(this.positions(positionId).exists, 'Position not found')
    const position = clone(this.positions(positionId).value)
    assert(position.trader === trader, 'Not position owner')
    assert(price > Uint64(0), 'Price must be positive')

    // Calculate PnL using SignedValue pattern
    const pnl = this.calculatePnl(position, price)

    // Calculate funding fee
    let fundingFeeAmount: uint64 = Uint64(0)
    if (this.fundingRates(position.symbol).exists) {
      const currentFundingIndex: uint64 = this.fundingRates(position.symbol).value
      if (currentFundingIndex > position.fundingIndex) {
        const fundingDiff: uint64 = currentFundingIndex - position.fundingIndex
        fundingFeeAmount = (position.size * fundingDiff) / BASIS_POINTS
      }
    }

    // Calculate payout: margin +/- PnL - funding fee
    let payout: uint64 = applySignedToUint(position.margin, pnl)
    if (payout > fundingFeeAmount) {
      payout = payout - fundingFeeAmount
    } else {
      payout = Uint64(0)
    }

    // Deduct trading fee
    const tradingFeeAmount: uint64 = (pnl.magnitude * this.tradingFee.value) / BASIS_POINTS
    if (payout > tradingFeeAmount) {
      payout = payout - tradingFeeAmount
    } else {
      payout = Uint64(0)
    }

    // Settle the close against the Vault, which holds trader margin and LP liquidity.
    if (payout < position.margin) {
      arc4.abiCall<typeof Vault.prototype.recordTraderLoss>({
        appId: Application(this.vaultAppId.value),
        method: Vault.prototype.recordTraderLoss,
        args: [position.margin - payout],
        fee: Uint64(0),
      })
    }

    if (payout > Uint64(0)) {
      arc4.abiCall<typeof Vault.prototype.payTrader>({
        appId: Application(this.vaultAppId.value),
        method: Vault.prototype.payTrader,
        args: [trader, payout],
        fee: Uint64(0),
      })
    }

    // Update total open interest
    if (position.isLong) {
      if (this.totalLongs(position.symbol).exists) {
        const currentLong: uint64 = this.totalLongs(position.symbol).value
        if (currentLong >= position.size) {
          this.totalLongs(position.symbol).value = currentLong - position.size
        } else {
          this.totalLongs(position.symbol).value = Uint64(0)
        }
      }
    } else {
      if (this.totalShorts(position.symbol).exists) {
        const currentShort: uint64 = this.totalShorts(position.symbol).value
        if (currentShort >= position.size) {
          this.totalShorts(position.symbol).value = currentShort - position.size
        } else {
          this.totalShorts(position.symbol).value = Uint64(0)
        }
      }
    }

    // Delete position
    this.positions(positionId).delete()

    emit<PositionClosedEvent>({
      positionId: positionId,
      trader: trader,
      pnlMagnitude: pnl.magnitude,
      pnlIsNegative: pnl.isNegative,
      payout: payout,
    })

    return payout
  }

  public liquidatePosition(positionId: uint64, price: uint64): boolean {
    const liquidator = Txn.sender

    assert(this.positions(positionId).exists, 'Position not found')
    const position = clone(this.positions(positionId).value)
    assert(price > Uint64(0), 'Price must be positive')

    // Check liquidation condition
    assert(this.shouldLiquidate(position, price), 'Position is healthy')

    // Calculate liquidation reward
    const liquidationReward: uint64 =
      (position.margin * this.liquidationFeeRatio.value) / BASIS_POINTS

    // Transfer reward to liquidator
    if (liquidationReward > Uint64(0)) {
      itxn.assetTransfer({
        xferAsset: Asset(this.usdcAssetId.value),
        assetReceiver: liquidator,
        assetAmount: liquidationReward,
        fee: Uint64(0),
      }).submit()
    }

    // Update total open interest
    if (position.isLong) {
      if (this.totalLongs(position.symbol).exists) {
        const currentLong: uint64 = this.totalLongs(position.symbol).value
        if (currentLong >= position.size) {
          this.totalLongs(position.symbol).value = currentLong - position.size
        } else {
          this.totalLongs(position.symbol).value = Uint64(0)
        }
      }
    } else {
      if (this.totalShorts(position.symbol).exists) {
        const currentShort: uint64 = this.totalShorts(position.symbol).value
        if (currentShort >= position.size) {
          this.totalShorts(position.symbol).value = currentShort - position.size
        } else {
          this.totalShorts(position.symbol).value = Uint64(0)
        }
      }
    }

    // Delete position
    this.positions(positionId).delete()

    emit<PositionLiquidatedEvent>({
      positionId: positionId,
      liquidator: liquidator,
      reward: liquidationReward,
    })

    return true
  }

  public updateFundingRate(symbol: string, newCumulativeIndex: uint64): void {
    assert(Txn.sender === this.admin.value, 'Only admin can update funding rate')
    this.fundingRates(symbol).value = newCumulativeIndex
  }

  @abimethod({ readonly: true })
  public getPosition(positionId: uint64): PerpPosition {
    assert(this.positions(positionId).exists, 'Position not found')
    return clone(this.positions(positionId).value)
  }

  @abimethod({ readonly: true })
  public getFundingRate(symbol: string): uint64 {
    if (!this.fundingRates(symbol).exists) {
      return Uint64(0)
    }
    return this.fundingRates(symbol).value
  }

  @abimethod({ readonly: true })
  public getVaultAppId(): uint64 {
    return this.vaultAppId.value
  }

  // --- Private subroutines ---

  private calculateLiquidationPrice(
    entryPrice: uint64,
    leverage: uint64,
    isLong: boolean,
  ): uint64 {
    const maintenanceRatio: uint64 = this.maintenanceMarginRatio.value

    if (isLong) {
      // liquidation_price = entry * (10000 - 10000/leverage + maintenance) / 10000
      const leverageFactor: uint64 = BASIS_POINTS / leverage
      const multiplier: uint64 = BASIS_POINTS - leverageFactor + maintenanceRatio
      return (entryPrice * multiplier) / BASIS_POINTS
    }

    // Short: liquidation_price = entry * (10000 + 10000/leverage - maintenance) / 10000
    const leverageFactor: uint64 = BASIS_POINTS / leverage
    const multiplier: uint64 = BASIS_POINTS + leverageFactor - maintenanceRatio
    return (entryPrice * multiplier) / BASIS_POINTS
  }

  private calculatePnl(position: PerpPosition, currentPrice: uint64): SignedValue {
    const priceDiff = signedSubtract(currentPrice, position.entryPrice)

    // PnL magnitude = |priceDiff| * size / entryPrice
    const pnlMagnitude: uint64 =
      (priceDiff.magnitude * position.size) / position.entryPrice

    if (position.isLong) {
      // Long: profit when price goes up
      return { magnitude: pnlMagnitude, isNegative: priceDiff.isNegative }
    }

    // Short: profit when price goes down (invert sign)
    return { magnitude: pnlMagnitude, isNegative: !priceDiff.isNegative }
  }

  private shouldLiquidate(position: PerpPosition, currentPrice: uint64): boolean {
    if (position.isLong) {
      return currentPrice <= position.liquidationPrice
    }
    return currentPrice >= position.liquidationPrice
  }
}
