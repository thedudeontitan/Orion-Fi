/**
 * One-time admin setup for Orion Fi on Algorand testnet.
 *
 * Idempotent: each step checks current state before acting. Safe to re-run.
 *
 * Usage:
 *   cd contracts
 *   DEPLOYER_MNEMONIC="word word word …" npx tsx scripts/setup-testnet.ts
 *
 * What it does:
 *   1. Funds each app with 1 ALGO for MBR if short.
 *   2. Opts DEX + Vault into USDC (asset 10458941).
 *   3. Calls Vault.setupVault(usdc, dex).
 *   4. Calls PerpetualDEX.setupProtocol(feeCollector, usdc, oracle, vault, 50, 100).
 *   5. Calls FundingRateManager.setPerpDexAppId(dex).
 *   6. Initializes BTCUSD, ETHUSD, ALGOUSD markets (skips if already present).
 *
 * Deployed testnet app IDs are read from the repo-root .env.testnet file.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { AlgorandClient, microAlgo } from '@algorandfoundation/algokit-utils'
import algosdk from 'algosdk'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const CONTRACTS_DIR = path.resolve(__dirname, '..')
const REPO_ROOT = path.resolve(CONTRACTS_DIR, '..')

// ─────────────────────────────── env ───────────────────────────────

function loadEnvTestnet(): Record<string, string> {
  const envPath = path.join(REPO_ROOT, '.env.testnet')
  if (!fs.existsSync(envPath)) {
    throw new Error(`Missing .env.testnet at ${envPath}`)
  }
  const out: Record<string, string> = {}
  const raw = fs.readFileSync(envPath, 'utf8')
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim()
  }
  return out
}

const env = loadEnvTestnet()

function requireBigInt(key: string): bigint {
  const v = env[key]
  if (!v) throw new Error(`Missing ${key} in .env.testnet`)
  return BigInt(v)
}

const USDC_ASSET_ID = requireBigInt('VITE_USDC_ASSET_ID')
const ORACLE_APP_ID = requireBigInt('VITE_PRICE_ORACLE_APP_ID')
const FUNDING_APP_ID = requireBigInt('VITE_FUNDING_RATE_MANAGER_APP_ID')
const VAULT_APP_ID = requireBigInt('VITE_VAULT_APP_ID')
const DEX_APP_ID = requireBigInt('VITE_PERPETUAL_DEX_APP_ID')

const DEPLOYER_MNEMONIC = process.env.DEPLOYER_MNEMONIC
if (!DEPLOYER_MNEMONIC) {
  throw new Error(
    'Set DEPLOYER_MNEMONIC to the 25-word deployer account mnemonic',
  )
}
const deployer = algosdk.mnemonicToSecretKey(DEPLOYER_MNEMONIC)

// ─────────────────────────── app specs ────────────────────────────

function loadArc56(name: string): unknown {
  const p = path.join(CONTRACTS_DIR, 'smart_contracts', 'out', `${name}.arc56.json`)
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

const DEX_SPEC = loadArc56('PerpetualDEX')
const VAULT_SPEC = loadArc56('Vault')
const FUNDING_SPEC = loadArc56('FundingRateManager')

// ───────────────────────── algorand client ────────────────────────

const algorand = AlgorandClient.testNet()
algorand.setDefaultSigner(algosdk.makeBasicAccountTransactionSigner(deployer))
algorand.setSigner(deployer.addr, algosdk.makeBasicAccountTransactionSigner(deployer))

const dex = algorand.client.getAppClientById({
  appId: DEX_APP_ID,
  appSpec: DEX_SPEC as never,
  defaultSender: deployer.addr,
})
const vault = algorand.client.getAppClientById({
  appId: VAULT_APP_ID,
  appSpec: VAULT_SPEC as never,
  defaultSender: deployer.addr,
})
const funding = algorand.client.getAppClientById({
  appId: FUNDING_APP_ID,
  appSpec: FUNDING_SPEC as never,
  defaultSender: deployer.addr,
})

// ─────────────────────────── helpers ──────────────────────────────

const ONE_ALGO = 1_000_000n

async function fundIfNeeded(appAddress: string, label: string, minMicroAlgo = ONE_ALGO) {
  const info = await algorand.account.getInformation(appAddress)
  const balance = info.balance.microAlgo
  if (balance >= minMicroAlgo) {
    console.log(`  ✓ ${label} funded (${Number(balance) / 1e6} ALGO)`)
    return
  }
  const topUp = minMicroAlgo - balance
  console.log(`  … topping up ${label} by ${Number(topUp) / 1e6} ALGO`)
  await algorand.send.payment({
    sender: deployer.addr.toString(),
    receiver: appAddress,
    amount: microAlgo(Number(topUp)),
    note: `Orion Fi setup: fund ${label}`,
  })
  console.log(`  ✓ ${label} funded`)
}

/** Call optInUsdc only if the app isn't already opted in. */
async function ensureAssetOptIn(
  client: typeof dex,
  label: string,
  methodName = 'optInUsdc',
) {
  const appAddr = client.appAddress.toString()
  try {
    await algorand.asset.getAccountInformation(appAddr, USDC_ASSET_ID)
    console.log(`  ✓ ${label} already opted into USDC`)
    return
  } catch {
    // Not opted in — continue.
  }
  console.log(`  … ${label} opting into USDC`)
  await client.send.call({
    method: methodName,
    args: [],
    populateAppCallResources: true,
    coverAppCallInnerTransactionFees: true,
    maxFee: microAlgo(10_000),
  })
  console.log(`  ✓ ${label} opted into USDC`)
}

/** True if the FundingRateManager has a market box for `symbol`. */
async function marketExists(symbol: string): Promise<boolean> {
  try {
    const res = await funding.send.call({
      method: 'getMarketData',
      args: [symbol],
      populateAppCallResources: true,
    })
    return res.return !== undefined
  } catch {
    return false
  }
}

// ───────────────────────────── steps ──────────────────────────────

async function main() {
  const dexAddr = dex.appAddress.toString()
  const vaultAddr = vault.appAddress.toString()
  const fundingAddr = funding.appAddress.toString()

  console.log('Orion Fi testnet setup')
  console.log(`  deployer:    ${deployer.addr.toString()}`)
  console.log(`  USDC asset:  ${USDC_ASSET_ID}`)
  console.log(`  Oracle app:  ${ORACLE_APP_ID}`)
  console.log(`  Funding app: ${FUNDING_APP_ID}  ${fundingAddr}`)
  console.log(`  Vault app:   ${VAULT_APP_ID}  ${vaultAddr}`)
  console.log(`  DEX app:     ${DEX_APP_ID}  ${dexAddr}`)
  console.log()

  console.log('1. Funding apps with 1 ALGO if short')
  await fundIfNeeded(dexAddr, 'PerpetualDEX')
  await fundIfNeeded(vaultAddr, 'Vault')
  await fundIfNeeded(fundingAddr, 'FundingRateManager')
  console.log()

  console.log('2. Vault.setupVault(usdc, dex)')
  await vault.send.call({
    method: 'setupVault',
    args: [USDC_ASSET_ID, DEX_APP_ID],
  })
  console.log('  ✓ Vault configured')
  console.log()

  console.log('3. PerpetualDEX.setupProtocol(feeCollector, usdc, oracle, vault, 50, 100)')
  await dex.send.call({
    method: 'setupProtocol',
    args: [
      deployer.addr.toString(), // feeCollector
      USDC_ASSET_ID,
      ORACLE_APP_ID,
      VAULT_APP_ID,
      50n, // tradingFee (bps)
      100n, // maxLeverage
    ],
  })
  console.log('  ✓ DEX configured')
  console.log()

  console.log('4. Opt Vault + DEX into USDC')
  await ensureAssetOptIn(vault, 'Vault')
  await ensureAssetOptIn(dex, 'PerpetualDEX')
  console.log()

  console.log('5. FundingRateManager.setPerpDexAppId(dex)')
  await funding.send.call({
    method: 'setPerpDexAppId',
    args: [DEX_APP_ID],
  })
  console.log('  ✓ Funding linked to DEX')
  console.log()

  console.log('6. Initialize markets')
  const markets = ['BTCUSD', 'ETHUSD', 'ALGOUSD']
  for (const symbol of markets) {
    if (await marketExists(symbol)) {
      console.log(`  ✓ ${symbol} already initialized`)
      continue
    }
    console.log(`  … initializing ${symbol}`)
    await funding.send.call({
      method: 'initializeMarket',
      args: [
        symbol,
        10n, // baseFundingRate (bps)
        1000n, // maxFundingRate (bps)
        3600n, // fundingInterval (seconds)
      ],
      populateAppCallResources: true,
    })
    console.log(`  ✓ ${symbol} initialized`)
  }
  console.log()

  console.log('Setup complete.')
}

main().catch((err) => {
  console.error('\nSetup failed:', err instanceof Error ? err.message : err)
  process.exitCode = 1
})
