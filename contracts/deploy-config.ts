import { AlgorandClient } from '@algorandfoundation/algokit-utils'

// Import generated factory clients (produced by `npx puya-ts compile`)
// These paths will be valid after running the build step
// import { PriceOracleFactory } from './artifacts/PriceOracle/PriceOracleClient'
// import { FundingRateManagerFactory } from './artifacts/FundingRateManager/FundingRateManagerClient'
// import { VaultFactory } from './artifacts/Vault/VaultClient'
// import { PerpetualDEXFactory } from './artifacts/PerpetualDEX/PerpetualDEXClient'

export async function deploy() {
  const algorand = AlgorandClient.fromEnvironment()
  const deployer = await algorand.account.fromEnvironment('DEPLOYER')

  console.log(`Deploying with account: ${deployer.addr}`)

  // ──────────────────────────────────────────────
  // 1. Deploy PriceOracle
  // ──────────────────────────────────────────────
  // const oracleFactory = algorand.client.getTypedAppFactory(PriceOracleFactory, {
  //   defaultSender: deployer.addr,
  // })
  // const { appClient: oracleClient, result: oracleResult } = await oracleFactory.deploy({
  //   onUpdate: 'append',
  //   onSchemaBreak: 'append',
  //   createParams: {
  //     method: 'createApplication',
  //     args: {},
  //   },
  // })
  // if (['create', 'replace'].includes(oracleResult.operationPerformed)) {
  //   await algorand.send.payment({
  //     sender: deployer.addr,
  //     receiver: oracleClient.appAddress,
  //     amount: (2).algo(), // Fund for box MBR
  //   })
  // }
  // console.log(`PriceOracle deployed: App ID ${oracleClient.appId}`)

  // ──────────────────────────────────────────────
  // 2. Deploy FundingRateManager
  // ──────────────────────────────────────────────
  // const fundingFactory = algorand.client.getTypedAppFactory(FundingRateManagerFactory, {
  //   defaultSender: deployer.addr,
  // })
  // const { appClient: fundingClient, result: fundingResult } = await fundingFactory.deploy({
  //   onUpdate: 'append',
  //   onSchemaBreak: 'append',
  //   createParams: {
  //     method: 'createApplication',
  //     args: {},
  //   },
  // })
  // if (['create', 'replace'].includes(fundingResult.operationPerformed)) {
  //   await algorand.send.payment({
  //     sender: deployer.addr,
  //     receiver: fundingClient.appAddress,
  //     amount: (2).algo(),
  //   })
  // }
  // console.log(`FundingRateManager deployed: App ID ${fundingClient.appId}`)

  // ──────────────────────────────────────────────
  // 3. Deploy Vault (LP pool for oracle-anchored AMM)
  // ──────────────────────────────────────────────
  // const vaultFactory = algorand.client.getTypedAppFactory(VaultFactory, {
  //   defaultSender: deployer.addr,
  // })
  // const { appClient: vaultClient, result: vaultResult } = await vaultFactory.deploy({
  //   onUpdate: 'append',
  //   onSchemaBreak: 'append',
  //   createParams: {
  //     method: 'createApplication',
  //     args: {},
  //   },
  // })
  // if (['create', 'replace'].includes(vaultResult.operationPerformed)) {
  //   await algorand.send.payment({
  //     sender: deployer.addr,
  //     receiver: vaultClient.appAddress,
  //     amount: (3).algo(), // Fund for LP box MBR
  //   })
  // }
  // console.log(`Vault deployed: App ID ${vaultClient.appId}`)

  // ──────────────────────────────────────────────
  // 4. Deploy PerpetualDEX
  // ──────────────────────────────────────────────
  // const dexFactory = algorand.client.getTypedAppFactory(PerpetualDEXFactory, {
  //   defaultSender: deployer.addr,
  // })
  // const { appClient: dexClient, result: dexResult } = await dexFactory.deploy({
  //   onUpdate: 'append',
  //   onSchemaBreak: 'append',
  //   createParams: {
  //     method: 'createApplication',
  //     args: {},
  //   },
  // })
  // if (['create', 'replace'].includes(dexResult.operationPerformed)) {
  //   await algorand.send.payment({
  //     sender: deployer.addr,
  //     receiver: dexClient.appAddress,
  //     amount: (5).algo(), // More MBR for position boxes
  //   })
  // }
  // console.log(`PerpetualDEX deployed: App ID ${dexClient.appId}`)

  // ──────────────────────────────────────────────
  // 5. Configure contracts
  // ──────────────────────────────────────────────
  // const USDC_ASSET_ID = 10458941n // Testnet USDC
  //
  // // Setup Vault with USDC and DEX reference
  // await vaultClient.send.setupVault({
  //   args: {
  //     usdcAssetId: USDC_ASSET_ID,
  //     perpDexAppId: dexClient.appId,
  //   },
  // })
  //
  // // Opt Vault into USDC
  // await vaultClient.send.optInUsdc({
  //   coverAppCallInnerTransactionFees: true,
  //   maxFee: (0.01).algo(),
  // })
  //
  // // Setup PerpetualDEX with oracle, Vault, USDC, and fees
  // await dexClient.send.setupProtocol({
  //   args: {
  //     feeCollector: deployer.addr.toString(),
  //     usdcAssetId: USDC_ASSET_ID,
  //     oracleAppId: oracleClient.appId,
  //     vaultAppId: vaultClient.appId,
  //     tradingFee: 50n,
  //     maxLeverage: 100n,
  //   },
  // })
  //
  // // Opt DEX into USDC
  // await dexClient.send.optInUsdc({
  //   coverAppCallInnerTransactionFees: true,
  //   maxFee: (0.01).algo(),
  // })
  //
  // // Link FundingRateManager to DEX
  // await fundingClient.send.setPerpDexAppId({
  //   args: { appId: dexClient.appId },
  // })
  //
  // // Initialize markets
  // const markets = ['BTCUSD', 'ETHUSD', 'ALGOUSD']
  // for (const market of markets) {
  //   await fundingClient.send.initializeMarket({
  //     args: {
  //       symbol: market,
  //       baseFundingRate: 10n,
  //       maxFundingRate: 1000n,
  //       fundingInterval: 3600n,
  //     },
  //     populateAppCallResources: true,
  //   })
  // }

  console.log('\nDeployment complete!')
  console.log('Uncomment the deploy steps above after running: npx puya-ts compile smart_contracts/*.algo.ts')
}

deploy().catch(console.error)
