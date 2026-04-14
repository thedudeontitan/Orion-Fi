#!/usr/bin/env python3
"""
Fix USDC opt-in for existing deployed contracts
This script can be run to opt-in existing DEX contracts to USDC
"""

import os
import json
from pathlib import Path
from algosdk import account, mnemonic, transaction
from algosdk.v2client import algod

def main():
    """Fix USDC opt-in for deployed contract"""

    # Load deployment info
    deployment_file = Path(__file__).parent.parent / "deployment-testnet.json"
    if not deployment_file.exists():
        print("❌ No deployment file found. Deploy contracts first.")
        return

    with open(deployment_file, 'r') as f:
        deployment_info = json.load(f)

    dex_app_id = deployment_info.get("contracts", {}).get("dex")
    if not dex_app_id:
        print("❌ No DEX contract found in deployment file.")
        return

    print(f"🔧 Fixing USDC opt-in for DEX contract: {dex_app_id}")

    # Initialize algod client
    algod_client = algod.AlgodClient("", "https://testnet-api.algonode.cloud")

    # Load deployer account
    deployer_mnemonic = os.getenv("DEPLOYER_MNEMONIC")
    if not deployer_mnemonic:
        print("❌ DEPLOYER_MNEMONIC environment variable not set")
        return

    private_key = mnemonic.to_private_key(deployer_mnemonic)
    deployer_address = account.address_from_private_key(private_key)

    print(f"🔑 Using deployer: {deployer_address}")

    try:
        # Create opt-in transaction
        params = algod_client.suggested_params()
        optin_txn = transaction.ApplicationCallTxn(
            sender=deployer_address,
            sp=params,
            index=dex_app_id,
            on_complete=transaction.OnComplete.NoOpOC,
            app_args=["opt_in_usdc"]
        )

        # Sign and send
        signed_txn = optin_txn.sign(private_key)
        tx_id = algod_client.send_transaction(signed_txn)

        print(f"📤 Transaction sent: {tx_id}")

        # Wait for confirmation
        confirmation = transaction.wait_for_confirmation(algod_client, tx_id, 4)

        print(f"✅ DEX contract {dex_app_id} successfully opted into USDC!")
        print(f"   Transaction: https://testnet.algoexplorer.io/tx/{tx_id}")
        print(f"   Round: {confirmation['confirmed-round']}")

    except Exception as e:
        if "asset 10458941 missing" in str(e):
            print("❌ Contract still not opted into USDC. Contract may need redeployment with updated code.")
        else:
            print(f"❌ Error: {e}")

if __name__ == "__main__":
    main()