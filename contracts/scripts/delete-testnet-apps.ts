import algosdk from 'algosdk'

const DEPLOYER_MNEMONIC = process.env.DEPLOYER_MNEMONIC
if (!DEPLOYER_MNEMONIC) {
  throw new Error('Set DEPLOYER_MNEMONIC to the 25-word deployer mnemonic')
}

const rawIds = process.argv.slice(2)
if (rawIds.length === 0) {
  throw new Error('Usage: npx tsx scripts/delete-testnet-apps.ts <appId> [appId...]')
}

const appIds = rawIds.map((value) => BigInt(value))
const deployer = algosdk.mnemonicToSecretKey(DEPLOYER_MNEMONIC)
const algod = new algosdk.Algodv2('', 'https://testnet-api.4160.nodely.dev', '')

async function deleteApp(appId: bigint) {
  const suggestedParams = await algod.getTransactionParams().do()
  const txn = algosdk.makeApplicationDeleteTxnFromObject({
    sender: deployer.addr,
    appIndex: Number(appId),
    suggestedParams,
  })

  const signed = txn.signTxn(deployer.sk)
  const { txid } = await algod.sendRawTransaction(signed).do()
  const confirmed = await algosdk.waitForConfirmation(algod, txid, 4)
  console.log(`  ✓ deleted app ${appId} in round ${confirmed.confirmedRound}`)
}

async function main() {
  console.log(`Deployer: ${deployer.addr.toString()}`)
  for (const appId of appIds) {
    console.log(`… deleting ${appId}`)
    await deleteApp(appId)
  }
}

main().catch((err) => {
  console.error('\nDelete failed:', err instanceof Error ? err.message : err)
  process.exitCode = 1
})
