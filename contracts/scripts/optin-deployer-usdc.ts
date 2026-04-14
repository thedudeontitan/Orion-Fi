/**
 * Opt the deployer account into USDC on testnet.
 *
 * The deployer address is set as the PerpetualDEX feeCollector, so it must
 * be able to receive inner USDC axfers. Without this opt-in, opening a
 * position fails with "must optin, asset 10458941 missing".
 *
 * Usage:
 *   cd contracts
 *   DEPLOYER_MNEMONIC="word word word …" npx tsx scripts/optin-deployer-usdc.ts
 */
import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import algosdk from 'algosdk'

const USDC_ASSET_ID = 10458941n

const DEPLOYER_MNEMONIC = process.env.DEPLOYER_MNEMONIC
if (!DEPLOYER_MNEMONIC) {
  throw new Error('Set DEPLOYER_MNEMONIC to the 25-word deployer mnemonic')
}
const deployer = algosdk.mnemonicToSecretKey(DEPLOYER_MNEMONIC)

const algorand = AlgorandClient.testNet()
const signer = algosdk.makeBasicAccountTransactionSigner(deployer)
algorand.setDefaultSigner(signer)
algorand.setSigner(deployer.addr, signer)

async function main() {
  const address = deployer.addr.toString()
  console.log(`Deployer: ${address}`)

  try {
    const info = await algorand.asset.getAccountInformation(address, USDC_ASSET_ID)
    console.log(`  ✓ already opted into USDC (balance: ${info.balance})`)
    return
  } catch {
    // not opted in — continue
  }

  console.log(`  … opting into USDC (asset ${USDC_ASSET_ID})`)
  const result = await algorand.send.assetOptIn({
    sender: address,
    assetId: USDC_ASSET_ID,
  })
  console.log(`  ✓ opted in (txid: ${result.txIds[0]})`)
}

main().catch((err) => {
  console.error('\nOpt-in failed:', err instanceof Error ? err.message : err)
  process.exitCode = 1
})
