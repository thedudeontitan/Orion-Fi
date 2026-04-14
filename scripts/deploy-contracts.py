#!/usr/bin/env python3
"""
Deployment script for Orion Fi Algorand smart contracts
"""

import os
import json
import time
import subprocess
from pathlib import Path
from algosdk import account, mnemonic
from algosdk.v2client import algod
from algosdk import transaction
from algosdk.atomic_transaction_composer import AtomicTransactionComposer, TransactionWithSigner
import algokit_utils

# Configuration
NETWORK = "testnet"  # Change to "mainnet" for production
ALGOD_TOKEN = ""
ALGOD_SERVER = "https://testnet-api.algonode.cloud" if NETWORK == "testnet" else "https://mainnet-api.algonode.cloud"

# Contract file paths
CONTRACTS_DIR = Path(__file__).parent.parent / "contracts"
ORACLE_CONTRACT = CONTRACTS_DIR / "OrionOracle.py"
DEX_CONTRACT = CONTRACTS_DIR / "OrionDEX.py"
ORDERBOOK_CONTRACT = CONTRACTS_DIR / "OrionOrderBook.py"

# Deployment configuration
DEPLOYMENT_CONFIG = {
    "oracle": {
        "file": ORACLE_CONTRACT,
        "name": "OrionOracle",
        "constructor_args": {}
    },
    "dex": {
        "file": DEX_CONTRACT,
        "name": "OrionDEX",
        "constructor_args": {}
    },
    "orderbook": {
        "file": ORDERBOOK_CONTRACT,
        "name": "OrionOrderBook",
        "constructor_args": {}
    }
}

class ContractDeployer:
    def __init__(self, network: str = "testnet"):
        self.network = network
        self.algod_client = algod.AlgodClient(
            algod_token=ALGOD_TOKEN,
            algod_address=ALGOD_SERVER
        )

        # Load deployer account from environment or generate
        self.deployer_account = self._load_or_create_account()

        print(f"🚀 Deploying to {network}")
        print(f"🔑 Deployer address: {self.deployer_account['address']}")

        # Check deployer balance
        self._check_account_balance()

    def _load_or_create_account(self):
        """Load deployer account from environment or create new one"""
        deployer_mnemonic = os.getenv("DEPLOYER_MNEMONIC")

        if deployer_mnemonic:
            print("📖 Loading deployer account from environment...")
            private_key = mnemonic.to_private_key(deployer_mnemonic)
            address = account.address_from_private_key(private_key)
            return {
                "private_key": private_key,
                "address": address,
                "mnemonic": deployer_mnemonic
            }
        else:
            print("🔐 Generating new deployer account...")
            private_key, address = account.generate_account()
            account_mnemonic = mnemonic.from_private_key(private_key)

            print(f"⚠️  IMPORTANT: Save this mnemonic phrase:")
            print(f"📝 {account_mnemonic}")
            print(f"💡 Set DEPLOYER_MNEMONIC environment variable to reuse this account")

            return {
                "private_key": private_key,
                "address": address,
                "mnemonic": account_mnemonic
            }

    def _check_account_balance(self):
        """Check if deployer account has sufficient balance"""
        try:
            account_info = self.algod_client.account_information(self.deployer_account["address"]).do()
            balance = account_info["amount"] / 1_000_000  # Convert from microAlgos

            print(f"💰 Deployer balance: {balance:.6f} ALGO")

            if balance < 1.0:  # Minimum 1 ALGO required
                print("⚠️  WARNING: Low balance! You may need to fund your account.")
                if self.network == "testnet":
                    print(f"🚰 Get testnet ALGO at: https://testnet.algoexplorer.io/dispenser")
                    print(f"   Use address: {self.deployer_account['address']}")

        except Exception as e:
            print(f"❌ Error checking account balance: {e}")

    def compile_contract(self, contract_path: Path) -> dict:
        """Compile AlgoPy contract to TEAL"""
        print(f"🔨 Compiling {contract_path.name}...")

        try:
            # Use algokit to compile the contract
            result = subprocess.run([
                "python", "-m", "algokit_utils.compile",
                str(contract_path),
                "--output-dir", str(contract_path.parent)
            ], capture_output=True, text=True, check=True)

            # Load compiled artifacts
            artifacts_dir = contract_path.parent / "artifacts"
            approval_path = artifacts_dir / f"{contract_path.stem}.approval.teal"
            clear_path = artifacts_dir / f"{contract_path.stem}.clear.teal"
            abi_path = artifacts_dir / f"{contract_path.stem}.abi.json"

            if not approval_path.exists():
                raise FileNotFoundError(f"Approval program not found at {approval_path}")

            with open(approval_path, 'r') as f:
                approval_program = f.read()

            with open(clear_path, 'r') as f:
                clear_program = f.read()

            abi_spec = {}
            if abi_path.exists():
                with open(abi_path, 'r') as f:
                    abi_spec = json.load(f)

            return {
                "approval_program": approval_program,
                "clear_program": clear_program,
                "abi": abi_spec
            }

        except subprocess.CalledProcessError as e:
            print(f"❌ Compilation failed: {e.stderr}")
            raise
        except Exception as e:
            print(f"❌ Error compiling contract: {e}")
            raise

    def deploy_contract(self, contract_name: str, compiled_contract: dict, constructor_args: dict = None) -> int:
        """Deploy a smart contract"""
        print(f"🚀 Deploying {contract_name}...")

        try:
            # Get suggested parameters
            params = self.algod_client.suggested_params()

            # Create application creation transaction
            txn = transaction.ApplicationCreateTxn(
                sender=self.deployer_account["address"],
                sp=params,
                on_complete=transaction.OnComplete.NoOpOC,
                approval_program=compiled_contract["approval_program"].encode(),
                clear_program=compiled_contract["clear_program"].encode(),
                global_schema=transaction.StateSchema(num_uints=16, num_byte_slices=16),
                local_schema=transaction.StateSchema(num_uints=8, num_byte_slices=8),
                app_args=[]  # Add constructor args if needed
            )

            # Sign transaction
            signed_txn = txn.sign(self.deployer_account["private_key"])

            # Send transaction
            tx_id = self.algod_client.send_transaction(signed_txn)
            print(f"📤 Transaction sent: {tx_id}")

            # Wait for confirmation
            confirmed_txn = transaction.wait_for_confirmation(self.algod_client, tx_id, 4)
            app_id = confirmed_txn["application-index"]

            print(f"✅ {contract_name} deployed successfully!")
            print(f"   App ID: {app_id}")
            print(f"   Transaction: {tx_id}")

            return app_id

        except Exception as e:
            print(f"❌ Error deploying {contract_name}: {e}")
            raise

    def setup_contracts(self, deployed_apps: dict):
        """Setup contracts with initial configuration"""
        print("🔧 Setting up contract configurations...")

        try:
            # Setup DEX contract with oracle reference
            if "dex" in deployed_apps and "oracle" in deployed_apps:
                print("🔗 Configuring DEX contract...")

                params = self.algod_client.suggested_params()

                # Create setup transaction for DEX
                setup_txn = transaction.ApplicationCallTxn(
                    sender=self.deployer_account["address"],
                    sp=params,
                    index=deployed_apps["dex"],
                    on_complete=transaction.OnComplete.NoOpOC,
                    app_args=[
                        "setup_contract",
                        deployed_apps["oracle"].to_bytes(8, 'big'),  # oracle_app_id
                        (10458941).to_bytes(8, 'big'),  # USDC asset ID (testnet)
                        (int(time.time()) + 365*24*3600).to_bytes(8, 'big'),  # futures_expiration (1 year)
                        (100_000_000).to_bytes(8, 'big'),  # maintenance_margin (100 USDC)
                        (1000).to_bytes(8, 'big'),  # leverage_dividend
                        (4000_00000000).to_bytes(8, 'big'),  # initial_asset_price ($4000)
                    ]
                )

                signed_txn = setup_txn.sign(self.deployer_account["private_key"])
                tx_id = self.algod_client.send_transaction(signed_txn)
                transaction.wait_for_confirmation(self.algod_client, tx_id, 4)

                print(f"✅ DEX contract configured (TxID: {tx_id})")

                # Opt-in DEX contract to USDC
                print("🔗 Enabling USDC transfers for DEX contract...")

                params = self.algod_client.suggested_params()
                optin_txn = transaction.ApplicationCallTxn(
                    sender=self.deployer_account["address"],
                    sp=params,
                    index=deployed_apps["dex"],
                    on_complete=transaction.OnComplete.NoOpOC,
                    app_args=["opt_in_usdc"]
                )

                signed_optin = optin_txn.sign(self.deployer_account["private_key"])
                optin_tx_id = self.algod_client.send_transaction(signed_optin)
                transaction.wait_for_confirmation(self.algod_client, optin_tx_id, 4)

                print(f"✅ DEX contract opted into USDC (TxID: {optin_tx_id})")

            # Setup OrderBook contract
            if "orderbook" in deployed_apps:
                print("🔗 Configuring OrderBook contract...")

                params = self.algod_client.suggested_params()

                # Initialize orderbook with exchange bytecode hash
                init_txn = transaction.ApplicationCallTxn(
                    sender=self.deployer_account["address"],
                    sp=params,
                    index=deployed_apps["orderbook"],
                    on_complete=transaction.OnComplete.NoOpOC,
                    app_args=[
                        "initialize",
                        b"exchange_bytecode_placeholder"  # Placeholder bytecode hash
                    ]
                )

                signed_txn = init_txn.sign(self.deployer_account["private_key"])
                tx_id = self.algod_client.send_transaction(signed_txn)
                transaction.wait_for_confirmation(self.algod_client, tx_id, 4)

                print(f"✅ OrderBook contract initialized (TxID: {tx_id})")

        except Exception as e:
            print(f"❌ Error setting up contracts: {e}")
            raise

    def save_deployment_info(self, deployed_apps: dict):
        """Save deployment information to file"""
        deployment_info = {
            "network": self.network,
            "deployer_address": self.deployer_account["address"],
            "deployment_timestamp": int(time.time()),
            "contracts": deployed_apps,
            "asset_ids": {
                "USDC": 10458941 if self.network == "testnet" else 0  # Update for mainnet
            }
        }

        # Save to JSON file
        output_file = Path(__file__).parent.parent / f"deployment-{self.network}.json"
        with open(output_file, 'w') as f:
            json.dump(deployment_info, f, indent=2)

        print(f"💾 Deployment info saved to {output_file}")

        # Save environment variables template
        env_file = Path(__file__).parent.parent / f".env.{self.network}"
        with open(env_file, 'w') as f:
            f.write(f"# Orion Fi - {self.network.upper()} Environment\n")
            f.write(f"VITE_ALGORAND_NETWORK={self.network}\n")
            f.write(f"VITE_PRICE_ORACLE_APP_ID={deployed_apps.get('oracle', 0)}\n")
            f.write(f"VITE_PERPETUAL_DEX_APP_ID={deployed_apps.get('dex', 0)}\n")
            f.write(f"VITE_ORDERBOOK_APP_ID={deployed_apps.get('orderbook', 0)}\n")
            f.write(f"VITE_USDC_ASSET_ID={deployment_info['asset_ids']['USDC']}\n")

        print(f"📝 Environment template saved to {env_file}")

    def deploy_all(self):
        """Deploy all contracts in correct order"""
        print("🎯 Starting deployment of all contracts...")

        deployed_apps = {}

        try:
            # Deploy in dependency order: Oracle -> OrderBook -> DEX
            for contract_name in ["oracle", "orderbook", "dex"]:
                config = DEPLOYMENT_CONFIG[contract_name]

                # Compile contract
                compiled = self.compile_contract(config["file"])

                # Deploy contract
                app_id = self.deploy_contract(
                    config["name"],
                    compiled,
                    config.get("constructor_args", {})
                )

                deployed_apps[contract_name] = app_id

                # Small delay between deployments
                time.sleep(2)

            # Setup contracts with cross-references
            self.setup_contracts(deployed_apps)

            # Save deployment information
            self.save_deployment_info(deployed_apps)

            print("\n🎉 All contracts deployed successfully!")
            print("📋 Summary:")
            for name, app_id in deployed_apps.items():
                print(f"   {name.capitalize()}: {app_id}")

            print(f"\n🌐 View on AlgoExplorer:")
            base_url = "https://testnet.algoexplorer.io" if self.network == "testnet" else "https://algoexplorer.io"
            for name, app_id in deployed_apps.items():
                print(f"   {name.capitalize()}: {base_url}/application/{app_id}")

            return deployed_apps

        except Exception as e:
            print(f"❌ Deployment failed: {e}")
            raise

def main():
    """Main deployment function"""
    import argparse

    parser = argparse.ArgumentParser(description="Deploy Orion Fi contracts")
    parser.add_argument(
        "--network",
        choices=["testnet", "mainnet"],
        default="testnet",
        help="Network to deploy to (default: testnet)"
    )
    parser.add_argument(
        "--contract",
        choices=["oracle", "dex", "orderbook", "all"],
        default="all",
        help="Contract to deploy (default: all)"
    )

    args = parser.parse_args()

    if args.network == "mainnet":
        confirm = input("⚠️  You are about to deploy to MAINNET. Are you sure? (yes/no): ")
        if confirm.lower() != "yes":
            print("❌ Deployment cancelled.")
            return

    # Create deployer instance
    deployer = ContractDeployer(args.network)

    if args.contract == "all":
        # Deploy all contracts
        deployer.deploy_all()
    else:
        # Deploy single contract
        config = DEPLOYMENT_CONFIG[args.contract]
        compiled = deployer.compile_contract(config["file"])
        app_id = deployer.deploy_contract(
            config["name"],
            compiled,
            config.get("constructor_args", {})
        )

        print(f"\n✅ {args.contract.capitalize()} contract deployed: {app_id}")

if __name__ == "__main__":
    main()