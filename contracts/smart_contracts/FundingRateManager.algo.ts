import {
  Account,
  Contract,
  GlobalState,
  BoxMap,
  Global,
  Txn,
  uint64,
  Uint64,
  assert,
  clone,
  abimethod,
} from '@algorandfoundation/algorand-typescript'

type MarketData = {
  totalLongOi: uint64
  totalShortOi: uint64
  baseFundingRate: uint64
  maxFundingRate: uint64
  fundingInterval: uint64
}

// SignedValue pattern for funding rates (AVM has no signed integers)
type SignedValue = {
  magnitude: uint64
  isNegative: boolean
}

// Module-level constants
const DEFAULT_BASE_RATE: uint64 = Uint64(10) // 0.01% per hour
const DEFAULT_MAX_RATE: uint64 = Uint64(1000) // 1% per hour
const DEFAULT_INTERVAL: uint64 = Uint64(3600) // 1 hour
const SCALE_FACTOR: uint64 = Uint64(10000)
const MIDPOINT: uint64 = Uint64(5000) // 50% scaled by 10000
const IMBALANCE_DIVISOR: uint64 = Uint64(50)
const RATE_DIVISOR: uint64 = Uint64(100)

/**
 * Compute signed subtraction: returns |a - b| and whether result is negative
 */
function signedSubtract(a: uint64, b: uint64): SignedValue {
  if (a >= b) {
    return { magnitude: a - b, isNegative: false }
  }
  return { magnitude: b - a, isNegative: true }
}

export class FundingRateManager extends Contract {
  // Global state
  admin = GlobalState<Account>({ key: 'admin' })
  perpDexAppId = GlobalState<uint64>({ key: 'perpDexAppId' })
  defaultBaseRate = GlobalState<uint64>({ key: 'defBaseRate' })
  defaultMaxRate = GlobalState<uint64>({ key: 'defMaxRate' })
  defaultInterval = GlobalState<uint64>({ key: 'defInterval' })

  // Box storage for market data
  markets = BoxMap<string, MarketData>({ keyPrefix: 'mkt_' })

  public createApplication(): void {
    this.admin.value = Txn.sender
    this.perpDexAppId.value = Uint64(0)
    this.defaultBaseRate.value = DEFAULT_BASE_RATE
    this.defaultMaxRate.value = DEFAULT_MAX_RATE
    this.defaultInterval.value = DEFAULT_INTERVAL
  }

  public setPerpDexAppId(appId: uint64): void {
    assert(Txn.sender === this.admin.value, 'Only admin can set DEX app ID')
    this.perpDexAppId.value = appId
  }

  public initializeMarket(
    symbol: string,
    baseFundingRate: uint64,
    maxFundingRate: uint64,
    fundingInterval: uint64,
  ): void {
    assert(Txn.sender === this.admin.value, 'Only admin can initialize markets')

    const marketData: MarketData = {
      totalLongOi: Uint64(0),
      totalShortOi: Uint64(0),
      baseFundingRate: baseFundingRate,
      maxFundingRate: maxFundingRate,
      fundingInterval: fundingInterval,
    }

    this.markets(symbol).value = clone(marketData)
  }

  public updateOpenInterest(symbol: string, longOi: uint64, shortOi: uint64): void {
    assert(
      Txn.sender === this.admin.value,
      'Unauthorized caller',
    )

    if (!this.markets(symbol).exists) {
      const marketData: MarketData = {
        totalLongOi: longOi,
        totalShortOi: shortOi,
        baseFundingRate: this.defaultBaseRate.value,
        maxFundingRate: this.defaultMaxRate.value,
        fundingInterval: this.defaultInterval.value,
      }
      this.markets(symbol).value = clone(marketData)
    } else {
      const market = clone(this.markets(symbol).value)
      market.totalLongOi = longOi
      market.totalShortOi = shortOi
      this.markets(symbol).value = clone(market)
    }
  }

  @abimethod({ readonly: true })
  public calculateFundingRate(symbol: string): SignedValue {
    assert(this.markets(symbol).exists, 'Market not initialized')

    const market = clone(this.markets(symbol).value)
    const totalOi: uint64 = market.totalLongOi + market.totalShortOi

    if (totalOi === Uint64(0)) {
      return { magnitude: Uint64(0), isNegative: false }
    }

    // Calculate long ratio scaled to 10000
    const longRatioScaled: uint64 = (market.totalLongOi * SCALE_FACTOR) / totalOi

    // Calculate imbalance as signed value: (longRatio - 5000) / 50
    const imbalance = signedSubtract(longRatioScaled, MIDPOINT)
    const imbalanceMagnitude: uint64 = imbalance.magnitude / IMBALANCE_DIVISOR

    // Calculate funding rate magnitude: baseRate * imbalance / 100
    const rateMagnitude: uint64 = (market.baseFundingRate * imbalanceMagnitude) / RATE_DIVISOR

    // Cap at max funding rate
    let cappedMagnitude: uint64 = rateMagnitude
    if (rateMagnitude > market.maxFundingRate) {
      cappedMagnitude = market.maxFundingRate
    }

    return { magnitude: cappedMagnitude, isNegative: imbalance.isNegative }
  }

  @abimethod({ readonly: true })
  public getMarketData(symbol: string): MarketData {
    assert(this.markets(symbol).exists, 'Market not found')
    return clone(this.markets(symbol).value)
  }

  @abimethod({ readonly: true })
  public shouldUpdateFunding(symbol: string, lastUpdate: uint64): boolean {
    if (!this.markets(symbol).exists) {
      return false
    }

    const market = clone(this.markets(symbol).value)
    const timeSinceUpdate: uint64 = Global.latestTimestamp - lastUpdate
    return timeSinceUpdate >= market.fundingInterval
  }

  public updateMarketParams(
    symbol: string,
    baseRate: uint64,
    maxRate: uint64,
    interval: uint64,
  ): void {
    assert(Txn.sender === this.admin.value, 'Only admin can update market params')
    assert(this.markets(symbol).exists, 'Market not found')

    const market = clone(this.markets(symbol).value)
    market.baseFundingRate = baseRate
    market.maxFundingRate = maxRate
    market.fundingInterval = interval
    this.markets(symbol).value = clone(market)
  }

  public setDefaultParams(baseRate: uint64, maxRate: uint64, interval: uint64): void {
    assert(Txn.sender === this.admin.value, 'Only admin can set default params')
    this.defaultBaseRate.value = baseRate
    this.defaultMaxRate.value = maxRate
    this.defaultInterval.value = interval
  }
}
