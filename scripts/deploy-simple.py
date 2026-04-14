#!/usr/bin/env python3
"""
Simple deployment script for Orion Fi Algorand smart contracts
Uses basic algosdk without AlgoKit dependencies
"""

import os
import json
import time
from pathlib import Path
from algosdk import account, mnemonic
from algosdk.v2client.algod import AlgodClient
from algosdk import transaction

# Configuration
NETWORK = "testnet"
ALGOD_TOKEN = ""
ALGOD_SERVER = "https://testnet-api.algonode.cloud"

def get_deployer_account():
    """Get or create deployer account"""
    deployer_mnemonic = os.getenv("DEPLOYER_MNEMONIC")

    if deployer_mnemonic:
        print("📖 Loading deployer account from environment...")
        private_key = mnemonic.to_private_key(deployer_mnemonic)
        address = account.address_from_private_key(private_key)
        return private_key, address, deployer_mnemonic
    else:
        print("🔐 Generating new deployer account...")
        private_key, address = account.generate_account()
        account_mnemonic = mnemonic.from_private_key(private_key)

        print(f"⚠️  IMPORTANT: Save this mnemonic phrase:")
        print(f"📝 {account_mnemonic}")
        print(f"💡 Set DEPLOYER_MNEMONIC environment variable to reuse this account")

        return private_key, address, account_mnemonic

def check_balance(algod_client, address):
    """Check account balance"""
    try:
        account_info = algod_client.account_info(address)
        balance = account_info["amount"] / 1_000_000

        print(f"💰 Deployer balance: {balance:.6f} ALGO")

        if balance < 1.0:
            print("⚠️  WARNING: Low balance! You may need to fund your account.")
            print(f"🚰 Get testnet ALGO at: https://testnet.algoexplorer.io/dispenser")
            print(f"   Use address: {address}")
            return False
        return True
    except Exception as e:
        print(f"❌ Error checking account balance: {e}")
        return False

def create_simple_app():
    """Create a very simple approval program for testing"""
    # This is a minimal TEAL program that always approves
    approval_program = """
#pragma version 8
int 1
return
"""

    clear_program = """
#pragma version 8
int 1
return
"""

    return approval_program, clear_program

def deploy_contract(algod_client, private_key, address, name):
    """Deploy a simple contract for testing"""
    print(f"🚀 Deploying {name}...")

    try:
        # Get transaction parameters
        params = algod_client.suggested_params()

        # Get program bytes
        approval_program, clear_program = create_simple_app()
        approval_response = algod_client.compile(approval_program)
        clear_response = algod_client.compile(clear_program)

        # Decode the base64 encoded programs
        import base64
        approval_bytes = base64.b64decode(approval_response['result'])
        clear_bytes = base64.b64decode(clear_response['result'])

        # Create application transaction
        txn = transaction.ApplicationCreateTxn(
            sender=address,
            sp=params,
            on_complete=transaction.OnComplete.NoOpOC,
            approval_program=approval_bytes,
            clear_program=clear_bytes,
            global_schema=transaction.StateSchema(num_uints=16, num_byte_slices=16),
            local_schema=transaction.StateSchema(num_uints=8, num_byte_slices=8),
        )

        # Sign transaction
        signed_txn = txn.sign(private_key)

        # Send transaction
        tx_id = algod_client.send_transaction(signed_txn)
        print(f"📤 Transaction sent: {tx_id}")

        # Wait for confirmation
        confirmed_txn = transaction.wait_for_confirmation(algod_client, tx_id, 4)
        app_id = confirmed_txn["application-index"]

        print(f"✅ {name} deployed successfully!")
        print(f"   App ID: {app_id}")
        print(f"   Transaction: {tx_id}")

        return app_id

    except Exception as e:
        print(f"❌ Error deploying {name}: {e}")
        raise

def save_deployment_info(deployed_apps, deployer_address):
    """Save deployment information"""
    deployment_info = {
        "network": NETWORK,
        "deployer_address": deployer_address,
        "deployment_timestamp": int(time.time()),
        "contracts": deployed_apps,
        "asset_ids": {
            "USDC": 10458941  # Testnet USDC
        }
    }

    # Save to JSON file
    output_file = Path(__file__).parent.parent / f"deployment-{NETWORK}.json"
    with open(output_file, 'w') as f:
        json.dump(deployment_info, f, indent=2)

    print(f"💾 Deployment info saved to {output_file}")

    # Save environment variables
    env_file = Path(__file__).parent.parent / f".env.{NETWORK}"
    with open(env_file, 'w') as f:
        f.write(f"# Orion Fi - {NETWORK.upper()} Environment\n")
        f.write(f"VITE_ALGORAND_NETWORK={NETWORK}\n")
        f.write(f"VITE_PRICE_ORACLE_APP_ID={deployed_apps.get('oracle', 0)}\n")
        f.write(f"VITE_PERPETUAL_DEX_APP_ID={deployed_apps.get('dex', 0)}\n")
        f.write(f"VITE_ORDERBOOK_APP_ID={deployed_apps.get('orderbook', 0)}\n")
        f.write(f"VITE_USDC_ASSET_ID={deployment_info['asset_ids']['USDC']}\n")

    print(f"📝 Environment template saved to {env_file}")

    return deployment_info

def main():
    """Main deployment function"""
    print("🎯 Starting Orion Fi contract deployment...")

    # Initialize Algorand client
    algod_client = AlgodClient(ALGOD_TOKEN, ALGOD_SERVER)

    # Get deployer account
    private_key, deployer_address, mnemonic_phrase = get_deployer_account()
    print(f"🔑 Deployer address: {deployer_address}")

    # Check balance
    if not check_balance(algod_client, deployer_address):
        print("❌ Insufficient balance. Please fund your account and try again.")
        return

    deployed_apps = {}

    try:
        # Deploy contracts
        contracts = ["oracle", "dex", "orderbook"]

        for contract_name in contracts:
            app_id = deploy_contract(
                algod_client,
                private_key,
                deployer_address,
                f"Orion{contract_name.capitalize()}"
            )
            deployed_apps[contract_name] = app_id

            # Small delay between deployments
            time.sleep(2)

        # Save deployment information
        deployment_info = save_deployment_info(deployed_apps, deployer_address)

        print("\n🎉 All contracts deployed successfully!")
        print("📋 Summary:")
        for name, app_id in deployed_apps.items():
            print(f"   {name.capitalize()}: {app_id}")

        print(f"\n🌐 View on AlgoExplorer:")
        base_url = "https://testnet.algoexplorer.io"
        for name, app_id in deployed_apps.items():
            print(f"   {name.capitalize()}: {base_url}/application/{app_id}")

        print(f"\n📁 Next steps:")
        print(f"1. Copy .env.{NETWORK} to .env in your project root")
        print(f"2. Restart your development server")
        print(f"3. The frontend will now connect to deployed contracts")

        return deployed_apps

    except Exception as e:
        print(f"❌ Deployment failed: {e}")
        return None

if __name__ == "__main__":
    main()