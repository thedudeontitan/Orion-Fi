import {
  Contract,
  GlobalState,
  BoxMap,
  Account,
  Global,
  Txn,
  uint64,
  Uint64,
  assert,
  emit,
  clone,
  abimethod,
} from '@algorandfoundation/algorand-typescript'

type PriceData = {
  price: uint64
  confidence: uint64
  timestamp: uint64
}

type PriceUpdatedEvent = {
  symbol: string
  price: uint64
  confidence: uint64
  publisher: Account
}

type OwnershipTransferredEvent = {
  previousOwner: Account
  newOwner: Account
}

// Oracle configuration defaults
const DEFAULT_MAX_PRICE_AGE: uint64 = Uint64(300) // 5 minutes
const DEFAULT_MIN_CONFIDENCE: uint64 = Uint64(8000) // 80% in basis points

export class PriceOracle extends Contract {
  // Global state
  admin = GlobalState<Account>({ key: 'admin' })
  maxPriceAge = GlobalState<uint64>({ key: 'maxPriceAge' })
  minConfidence = GlobalState<uint64>({ key: 'minConfidence' })

  // Box storage
  prices = BoxMap<string, PriceData>({ keyPrefix: 'p_' })
  publishers = BoxMap<Account, uint64>({ keyPrefix: 'pub_' })

  public createApplication(): void {
    this.admin.value = Txn.sender
    this.maxPriceAge.value = DEFAULT_MAX_PRICE_AGE
    this.minConfidence.value = DEFAULT_MIN_CONFIDENCE
  }

  public addPublisher(publisher: Account): void {
    assert(Txn.sender === this.admin.value, 'Only admin can add publishers')
    this.publishers(publisher).value = Uint64(1)
  }

  public removePublisher(publisher: Account): void {
    assert(Txn.sender === this.admin.value, 'Only admin can remove publishers')
    this.publishers(publisher).delete()
  }

  public updatePrice(symbol: string, price: uint64, confidence: uint64): void {
    assert(this.publishers(Txn.sender).exists, 'Unauthorized publisher')
    assert(price > Uint64(0), 'Price must be positive')
    assert(confidence >= this.minConfidence.value, 'Confidence too low')
    assert(confidence <= Uint64(10000), 'Invalid confidence')

    const priceData: PriceData = {
      price: price,
      confidence: confidence,
      timestamp: Global.latestTimestamp,
    }

    this.prices(symbol).value = clone(priceData)

    emit<PriceUpdatedEvent>({
      symbol: symbol,
      price: price,
      confidence: confidence,
      publisher: Txn.sender,
    })
  }

  @abimethod({ readonly: true })
  public getPrice(symbol: string): PriceData {
    assert(this.prices(symbol).exists, 'Price not found')

    const priceData = clone(this.prices(symbol).value)
    const age: uint64 = Global.latestTimestamp - priceData.timestamp
    assert(age <= this.maxPriceAge.value, 'Price data too old')

    return priceData
  }

  @abimethod({ readonly: true })
  public getPriceUnsafe(symbol: string): PriceData {
    assert(this.prices(symbol).exists, 'Price not found')
    return clone(this.prices(symbol).value)
  }

  @abimethod({ readonly: true })
  public isPriceFresh(symbol: string): boolean {
    if (!this.prices(symbol).exists) {
      return false
    }

    const priceData = clone(this.prices(symbol).value)
    const age: uint64 = Global.latestTimestamp - priceData.timestamp
    return age <= this.maxPriceAge.value
  }

  public setOracleConfig(maxPriceAge: uint64, minConfidence: uint64): void {
    assert(Txn.sender === this.admin.value, 'Only admin can set config')
    assert(maxPriceAge > Uint64(0), 'Invalid max price age')
    assert(minConfidence <= Uint64(10000), 'Invalid confidence level')

    this.maxPriceAge.value = maxPriceAge
    this.minConfidence.value = minConfidence
  }

  public transferOwnership(newOwner: Account): void {
    assert(Txn.sender === this.admin.value, 'Only admin can transfer ownership')

    const previousOwner = this.admin.value
    this.admin.value = newOwner

    emit<OwnershipTransferredEvent>({
      previousOwner: previousOwner,
      newOwner: newOwner,
    })
  }
}
