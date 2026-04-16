import {
  Account,
  Asset,
  Application,
  Contract,
  GlobalState,
  BoxMap,
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
  op,
} from '@algorandfoundation/algorand-typescript'

// LP position tracked per depositor
type LpPosition = {
  shares: uint64
  depositTimestamp: uint64
}

// Events
type DepositEvent = {
  depositor: Account
  amount: uint64
  sharesIssued: uint64
}

type WithdrawEvent = {
  depositor: Account
  amount: uint64
  sharesBurned: uint64
}

type PayoutEvent = {
  trader: Account
  amount: uint64
}

// Module-level constants
const BASIS_POINTS: uint64 = Uint64(10000)
const DEFAULT_MAX_UTILIZATION: uint64 = Uint64(8000) // 80% max utilization
const DEFAULT_WITHDRAWAL_FEE: uint64 = Uint64(10) // 0.1% withdrawal fee
const SHARE_PRECISION: uint64 = Uint64(1_000_000) // 1:1 initial share price with 6 decimals

/**
 * Vault — Oracle-Anchored AMM Liquidity Pool
 *
 * LPs deposit USDC into the Vault and receive shares proportional to pool value.
 * Traders open positions against this pool via PerpetualDEX:
 *   - Margin deposits flow into the Vault
 *   - Profitable close-outs are paid from Vault USDC
 *   - Losing positions increase Vault value (LP profit)
 *
 * Share pricing:
 *   sharePrice = totalPoolValue / totalShares
 *   On deposit:  sharesIssued = depositAmount * totalShares / totalPoolValue
 *   On withdraw: amountOut     = sharesBurned * totalPoolValue / totalShares
 */
export class Vault extends Contract {
  // Global state — admin & config
  admin = GlobalState<Account>({ key: 'admin' })
  usdcAssetId = GlobalState<uint64>({ key: 'usdcId' })
  perpDexAppId = GlobalState<uint64>({ key: 'dexAppId' })

  // Pool accounting
  totalShares = GlobalState<uint64>({ key: 'totShares' })
  totalPoolValue = GlobalState<uint64>({ key: 'totPool' })
  totalDeposited = GlobalState<uint64>({ key: 'totDepo' })
  totalWithdrawn = GlobalState<uint64>({ key: 'totWith' })

  // Config
  maxUtilization = GlobalState<uint64>({ key: 'maxUtil' })
  withdrawalFee = GlobalState<uint64>({ key: 'withFee' })
  reservedForPayouts = GlobalState<uint64>({ key: 'reserved' })

  // Per-LP share tracking
  lpPositions = BoxMap<Account, LpPosition>({ keyPrefix: 'lp_' })

  // ────────────────────────────────────────────
  // Lifecycle
  // ────────────────────────────────────────────

  public createApplication(): void {
    this.admin.value = Txn.sender
    this.usdcAssetId.value = Uint64(0)
    this.perpDexAppId.value = Uint64(0)
    this.totalShares.value = Uint64(0)
    this.totalPoolValue.value = Uint64(0)
    this.totalDeposited.value = Uint64(0)
    this.totalWithdrawn.value = Uint64(0)
    this.maxUtilization.value = DEFAULT_MAX_UTILIZATION
    this.withdrawalFee.value = DEFAULT_WITHDRAWAL_FEE
    this.reservedForPayouts.value = Uint64(0)
  }

  public setupVault(usdcAssetId: uint64, perpDexAppId: uint64): void {
    assert(Txn.sender === this.admin.value, 'Only admin')
    this.usdcAssetId.value = usdcAssetId
    this.perpDexAppId.value = perpDexAppId
  }

  public optInUsdc(): void {
    assert(Txn.sender === this.admin.value, 'Only admin')
    assert(this.usdcAssetId.value !== Uint64(0), 'USDC not set')

    itxn.assetTransfer({
      xferAsset: Asset(this.usdcAssetId.value),
      assetReceiver: Global.currentApplicationAddress,
      assetAmount: Uint64(0),
      fee: Uint64(0),
    }).submit()
  }

  // ────────────────────────────────────────────
  // LP Operations
  // ────────────────────────────────────────────

  /**
   * Deposit USDC into the Vault. LP receives shares proportional to pool value.
   * First deposit: 1 USDC = 1 share (at SHARE_PRECISION).
   */
  public deposit(payment: gtxn.AssetTransferTxn): uint64 {
    assertMatch(payment, {
      assetReceiver: Global.currentApplicationAddress,
      xferAsset: Asset(this.usdcAssetId.value),
    })

    const depositAmount: uint64 = payment.assetAmount
    assert(depositAmount > Uint64(0), 'Deposit must be positive')

    // Calculate shares to issue
    let sharesIssued: uint64 = Uint64(0)

    if (this.totalShares.value === Uint64(0)) {
      // First deposit: 1:1 ratio at SHARE_PRECISION
      sharesIssued = depositAmount * SHARE_PRECISION
    } else {
      // sharesIssued = depositAmount * totalShares / totalPoolValue
      // Use wide (128-bit) multiply to avoid uint64 overflow
      const [hi, lo] = op.mulw(depositAmount, this.totalShares.value)
      sharesIssued = op.divw(hi, lo, this.totalPoolValue.value)
    }

    assert(sharesIssued > Uint64(0), 'Shares too small')

    // Update pool state
    this.totalShares.value = this.totalShares.value + sharesIssued
    this.totalPoolValue.value = this.totalPoolValue.value + depositAmount
    this.totalDeposited.value = this.totalDeposited.value + depositAmount

    // Update LP position
    if (this.lpPositions(Txn.sender).exists) {
      const existing = clone(this.lpPositions(Txn.sender).value)
      existing.shares = existing.shares + sharesIssued
      this.lpPositions(Txn.sender).value = clone(existing)
    } else {
      const newPosition: LpPosition = {
        shares: sharesIssued,
        depositTimestamp: Global.latestTimestamp,
      }
      this.lpPositions(Txn.sender).value = clone(newPosition)
    }

    emit<DepositEvent>({
      depositor: Txn.sender,
      amount: depositAmount,
      sharesIssued: sharesIssued,
    })

    return sharesIssued
  }

  /**
   * Withdraw USDC by burning shares. Amount received is proportional to pool value.
   * Withdrawal fee is deducted and stays in the pool (benefits remaining LPs).
   */
  public withdraw(sharesToBurn: uint64): uint64 {
    assert(this.lpPositions(Txn.sender).exists, 'No LP position')
    const lp = clone(this.lpPositions(Txn.sender).value)
    assert(lp.shares >= sharesToBurn, 'Insufficient shares')
    assert(sharesToBurn > Uint64(0), 'Must burn shares')

    // Calculate USDC amount: sharesToBurn * totalPoolValue / totalShares
    // Use wide (128-bit) multiply to avoid uint64 overflow
    const [hiGross, loGross] = op.mulw(sharesToBurn, this.totalPoolValue.value)
    const grossAmount: uint64 = op.divw(hiGross, loGross, this.totalShares.value)

    // Check available liquidity (pool value minus reserved for open positions)
    const availableLiquidity: uint64 = this.totalPoolValue.value - this.reservedForPayouts.value
    assert(grossAmount <= availableLiquidity, 'Insufficient liquidity')

    // Deduct withdrawal fee (stays in pool)
    const [hiFee, loFee] = op.mulw(grossAmount, this.withdrawalFee.value)
    const feeAmount: uint64 = op.divw(hiFee, loFee, BASIS_POINTS)
    const netAmount: uint64 = grossAmount - feeAmount

    // Update pool state — remove the gross amount but fee stays in pool
    this.totalShares.value = this.totalShares.value - sharesToBurn
    this.totalPoolValue.value = this.totalPoolValue.value - netAmount
    // Fee stays in pool (totalPoolValue reduced only by netAmount, not grossAmount)
    this.totalWithdrawn.value = this.totalWithdrawn.value + netAmount

    // Update LP position
    lp.shares = lp.shares - sharesToBurn
    if (lp.shares === Uint64(0)) {
      this.lpPositions(Txn.sender).delete()
    } else {
      this.lpPositions(Txn.sender).value = clone(lp)
    }

    // Transfer USDC to LP
    if (netAmount > Uint64(0)) {
      itxn.assetTransfer({
        xferAsset: Asset(this.usdcAssetId.value),
        assetReceiver: Txn.sender,
        assetAmount: netAmount,
        fee: Uint64(0),
      }).submit()
    }

    emit<WithdrawEvent>({
      depositor: Txn.sender,
      amount: netAmount,
      sharesBurned: sharesToBurn,
    })

    return netAmount
  }

  // ────────────────────────────────────────────
  // DEX Integration — called by PerpetualDEX
  // ────────────────────────────────────────────

  /**
   * Record margin received from a trader opening a position.
   * The USDC is already in the Vault (sent as gtxn).
   * Increases pool value and reserves.
   */
  public recordMarginDeposit(amount: uint64): void {
    assert(this.perpDexAppId.value !== Uint64(0), 'Perp DEX not set')
    assert(
      Txn.sender === Application(this.perpDexAppId.value).address,
      'Only PerpetualDEX',
    )
    this.totalPoolValue.value = this.totalPoolValue.value + amount
    this.reservedForPayouts.value = this.reservedForPayouts.value + amount
  }

  /**
   * Pay out a trader who closed a profitable position.
   * Decreases pool value by the payout amount.
   */
  public payTrader(trader: Account, amount: uint64): void {
    assert(this.perpDexAppId.value !== Uint64(0), 'Perp DEX not set')
    assert(
      Txn.sender === Application(this.perpDexAppId.value).address,
      'Only PerpetualDEX',
    )
    assert(amount <= this.totalPoolValue.value, 'Vault underfunded')

    // Release reservation and adjust pool value
    if (this.reservedForPayouts.value >= amount) {
      this.reservedForPayouts.value = this.reservedForPayouts.value - amount
    } else {
      this.reservedForPayouts.value = Uint64(0)
    }

    this.totalPoolValue.value = this.totalPoolValue.value - amount

    if (amount > Uint64(0)) {
      itxn.assetTransfer({
        xferAsset: Asset(this.usdcAssetId.value),
        assetReceiver: trader,
        assetAmount: amount,
        fee: Uint64(0),
      }).submit()
    }

    emit<PayoutEvent>({
      trader: trader,
      amount: amount,
    })
  }

  /**
   * Record a trader's loss. The margin stays in the Vault.
   * Releases the reservation — the funds become LP profit.
   */
  public recordTraderLoss(marginAmount: uint64): void {
    assert(this.perpDexAppId.value !== Uint64(0), 'Perp DEX not set')
    assert(
      Txn.sender === Application(this.perpDexAppId.value).address,
      'Only PerpetualDEX',
    )

    // Release reservation — margin stays as LP profit
    if (this.reservedForPayouts.value >= marginAmount) {
      this.reservedForPayouts.value = this.reservedForPayouts.value - marginAmount
    } else {
      this.reservedForPayouts.value = Uint64(0)
    }
    // totalPoolValue unchanged — the loss stays in the pool
  }

  // ────────────────────────────────────────────
  // Read-only Queries
  // ────────────────────────────────────────────

  @abimethod({ readonly: true })
  public getPoolState(): [uint64, uint64, uint64, uint64] {
    return [
      this.totalPoolValue.value,
      this.totalShares.value,
      this.reservedForPayouts.value,
      this.totalPoolValue.value - this.reservedForPayouts.value, // available liquidity
    ]
  }

  @abimethod({ readonly: true })
  public getSharePrice(): uint64 {
    if (this.totalShares.value === Uint64(0)) {
      return SHARE_PRECISION
    }
    // sharePrice = totalPoolValue * SHARE_PRECISION / totalShares
    const [hi, lo] = op.mulw(this.totalPoolValue.value, SHARE_PRECISION)
    return op.divw(hi, lo, this.totalShares.value)
  }

  @abimethod({ readonly: true })
  public getLpPosition(lp: Account): LpPosition {
    assert(this.lpPositions(lp).exists, 'No LP position')
    return clone(this.lpPositions(lp).value)
  }

  @abimethod({ readonly: true })
  public getLpValue(lp: Account): uint64 {
    if (!this.lpPositions(lp).exists) {
      return Uint64(0)
    }
    const position = clone(this.lpPositions(lp).value)
    if (this.totalShares.value === Uint64(0)) {
      return Uint64(0)
    }
    const [hi, lo] = op.mulw(position.shares, this.totalPoolValue.value)
    return op.divw(hi, lo, this.totalShares.value)
  }

  @abimethod({ readonly: true })
  public getUtilization(): uint64 {
    if (this.totalPoolValue.value === Uint64(0)) {
      return Uint64(0)
    }
    const [hi, lo] = op.mulw(this.reservedForPayouts.value, BASIS_POINTS)
    return op.divw(hi, lo, this.totalPoolValue.value)
  }

  // ────────────────────────────────────────────
  // Admin
  // ────────────────────────────────────────────

  public setMaxUtilization(maxUtil: uint64): void {
    assert(Txn.sender === this.admin.value, 'Only admin')
    assert(maxUtil <= BASIS_POINTS, 'Invalid utilization')
    this.maxUtilization.value = maxUtil
  }

  public setWithdrawalFee(fee: uint64): void {
    assert(Txn.sender === this.admin.value, 'Only admin')
    assert(fee <= Uint64(500), 'Fee too high') // Max 5%
    this.withdrawalFee.value = fee
  }

  public setPerpDexAppId(appId: uint64): void {
    assert(Txn.sender === this.admin.value, 'Only admin')
    this.perpDexAppId.value = appId
  }
}
