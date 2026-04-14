/**
 * Deploy Orion Fi contracts to Algorand testnet using a mnemonic-based signer.
 *
 * Usage:
 *   cd contracts
 *   DEPLOYER_MNEMONIC="word word word …" npx tsx scripts/deploy-testnet.ts
 *
 * Deploys: PriceOracle, FundingRateManager, Vault, PerpetualDEX.
 * Prints the 4 new app IDs. Does NOT modify .env.testnet.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import algosdk from 'algosdk'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const CONTRACTS_DIR = path.resolve(__dirname, '..')

const DEPLOYER_MNEMONIC = process.env.DEPLOYER_MNEMONIC
if (!DEPLOYER_MNEMONIC) {
  throw new Error('Set DEPLOYER_MNEMONIC to the 25-word deployer mnemonic')
}
const deployer = algosdk.mnemonicToSecretKey(DEPLOYER_MNEMONIC)

function loadArc56(name: string): unknown {
  const p = path.join(CONTRACTS_DIR, 'smart_contracts', 'out', `${name}.arc56.json`)
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

const algorand = AlgorandClient.testNet()
const signer = algosdk.makeBasicAccountTransactionSigner(deployer)
algorand.setDefaultSigner(signer)
algorand.setSigner(deployer.addr, signer)

async function deployOne(specName: string): Promise<bigint> {
  console.log(`… deploying ${specName}`)
  const factory = algorand.client.getAppFactory({
    appSpec: loadArc56(specName) as never,
    defaultSender: deployer.addr,
  })
  const { appClient, result } = await factory.deploy({
    createParams: {
      method: 'createApplication',
      args: [],
    },
    onUpdate: 'append',
    onSchemaBreak: 'append',
  })
  console.log(`  ✓ ${specName}: app ID ${appClient.appId} (${result.operationPerformed})`)
  return appClient.appId
}

async function main() {
  console.log(`Deployer: ${deployer.addr.toString()}`)
  const info = await algorand.account.getInformation(deployer.addr.toString())
  console.log(`Balance:  ${Number(info.balance.microAlgo) / 1e6} ALGO`)
  console.log()

  const oracleId = await deployOne('PriceOracle')
  const fundingId = await deployOne('FundingRateManager')
  const vaultId = await deployOne('Vault')
  const dexId = await deployOne('PerpetualDEX')

  console.log()
  console.log('Summary:')
  console.log(`  VITE_PRICE_ORACLE_APP_ID=${oracleId}`)
  console.log(`  VITE_FUNDING_RATE_MANAGER_APP_ID=${fundingId}`)
  console.log(`  VITE_VAULT_APP_ID=${vaultId}`)
  console.log(`  VITE_PERPETUAL_DEX_APP_ID=${dexId}`)
}

main().catch((err) => {
  console.error('\nDeploy failed:', err instanceof Error ? err.message : err)
  process.exitCode = 1
})
