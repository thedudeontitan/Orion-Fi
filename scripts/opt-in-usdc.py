#!/usr/bin/env python3
"""
Script to opt deployed contracts into USDC asset
This fixes the "must optin" error for USDC transfers
"""

import os
import json
import base64
from pathlib import Path
from algosdk import account, mnemonic, transaction
from algosdk.v2client.algod import AlgodClient

# Configuration
NETWORK = "testnet"
ALGOD_SERVER = "https://testnet-api.algonode.cloud"
USDC_ASSET_ID = 10458941  # Testnet USDC

def get_deployer_account():
    """Get deployer account from environment"""
    deployer_mnemonic = os.getenv("DEPLOYER_MNEMONIC")

    if not deployer_mnemonic:
        print("❌ DEPLOYER_MNEMONIC environment variable not set")
        print("💡 Run: export DEPLOYER_MNEMONIC=\"your mnemonic here\"")
        return None

    private_key = mnemonic.to_private_key(deployer_mnemonic)
    address = account.address_from_private_key(private_key)
    return private_key, address

def get_application_address(app_id):
    """Get the application address for a given app ID"""
    import algosdk
    return algosdk.logic.get_application_address(app_id)

def opt_in_contract_to_usdc(algod_client, private_key, deployer_address, app_id, contract_name):
    """Opt a contract into USDC asset"""
    print(f"🔗 Opting {contract_name} (App ID: {app_id}) into USDC...")

    try:
        # Get transaction parameters
        params = algod_client.suggested_params()

        # Get the contract address
        contract_address = get_application_address(app_id)
        print(f"   Contract address: {contract_address}")

        # Create asset opt-in transaction (0 amount transfer to self)
        optin_txn = transaction.AssetTransferTxn(
            sender=deployer_address,
            sp=params,
            receiver=contract_address,
            amt=0,  # 0 amount for opt-in
            index=USDC_ASSET_ID,
            note=f"USDC opt-in for {contract_name}".encode()
        )

        # Sign transaction
        signed_txn = optin_txn.sign(private_key)

        # Send transaction
        tx_id = algod_client.send_transaction(signed_txn)
        print(f"📤 Opt-in transaction sent: {tx_id}")

        # Wait for confirmation
        confirmed_txn = transaction.wait_for_confirmation(algod_client, tx_id, 4)
        print(f"✅ {contract_name} successfully opted into USDC!")
        print(f"   Transaction: https://testnet.algoexplorer.io/tx/{tx_id}")

        return True

    except Exception as e:
        if "has already opted in" in str(e) or "already holding asset" in str(e):
            print(f"ℹ️  {contract_name} already opted into USDC")
            return True
        else:
            print(f"❌ Error opting {contract_name} into USDC: {e}")
            return False

def main():
    """Main opt-in function"""
    print("🔧 Starting USDC opt-in for deployed contracts...")

    # Load deployment info
    deployment_file = Path(__file__).parent.parent / "deployment-testnet.json"
    if not deployment_file.exists():
        print("❌ No deployment file found. Deploy contracts first.")
        return False

    with open(deployment_file, 'r') as f:
        deployment_info = json.load(f)

    contracts = deployment_info.get("contracts", {})
    if not contracts:
        print("❌ No contracts found in deployment file.")
        return False

    print(f"📋 Found {len(contracts)} deployed contracts:")
    for name, app_id in contracts.items():
        print(f"   {name.capitalize()}: {app_id}")

    # Get deployer account
    account_info = get_deployer_account()
    if not account_info:
        return False

    private_key, deployer_address = account_info
    print(f"🔑 Using deployer: {deployer_address}")

    # Initialize algod client
    algod_client = AlgodClient("", ALGOD_SERVER)

    # Opt each contract into USDC
    success_count = 0
    for contract_name, app_id in contracts.items():
        if opt_in_contract_to_usdc(algod_client, private_key, deployer_address, app_id, contract_name):
            success_count += 1
        print()  # Empty line for readability

    print(f"🎉 Opt-in completed! {success_count}/{len(contracts)} contracts successfully opted into USDC")

    if success_count == len(contracts):
        print("✅ All contracts can now receive USDC transfers!")
        print("🚀 Try your transaction again - the 'must optin' error should be resolved")
        return True
    else:
        print("⚠️  Some contracts failed to opt-in. Check the errors above.")
        return False

if __name__ == "__main__":
    main()