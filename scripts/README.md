# Orion Fi - Contract Deployment

This directory contains deployment scripts and tools for the Orion Fi smart contracts.

## Prerequisites

1. **Python Environment**

   ```bash
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

2. **AlgoKit Setup**

   ```bash
   # Install AlgoKit CLI
   npm install -g @algorandfoundation/algokit

   # Or using pipx
   pipx install algokit
   ```

3. **Account Funding**
   - For testnet: Get free ALGO from [Testnet Dispenser](https://testnet.algoexplorer.io/dispenser)
   - For mainnet: Ensure your deployer account has sufficient ALGO for deployment fees

## Contract Architecture

The Orion Fi DEX consists of three main smart contracts:

### 1. OrionOracle (`OrionOracle.py`)

- **Purpose**: Secure price feed management for trading pairs
- **Features**:
  - Owner-controlled price updates with authorization
  - Multi-asset price support with confidence scoring
  - Price validation and freshness checks
  - Publisher authorization system

### 2. OrionDEX (`OrionDEX.py`)

- **Purpose**: Core perpetual futures trading functionality
- **Features**:
  - Long and short position management
  - Leveraged trading (1x-100x) with margin requirements
  - Oracle integration for real-time pricing
  - Liquidation mechanisms and PnL calculations
  - Multi-asset perpetual futures support

### 3. OrionOrderBook (`OrionOrderBook.py`)

- **Purpose**: Asset pair and liquidity pool management
- **Features**:
  - Asset pair registration and validation
  - Exchange contract authorization
  - Trading fee management
  - Pool liquidity tracking

## Deployment

### Quick Start (Testnet)

```bash
# Deploy all contracts to testnet
python scripts/deploy-contracts.py

# Deploy specific contract
python scripts/deploy-contracts.py --contract oracle
```

### Production Deployment (Mainnet)

```bash
# Set deployer account (IMPORTANT: Keep this secure!)
export DEPLOYER_MNEMONIC="your twenty five word mnemonic phrase here..."

# Deploy to mainnet (requires confirmation)
python scripts/deploy-contracts.py --network mainnet
```

### Deployment Options

```bash
# Deploy all contracts (default)
python scripts/deploy-contracts.py --network testnet

# Deploy individual contracts
python scripts/deploy-contracts.py --contract oracle --network testnet
python scripts/deploy-contracts.py --contract dex --network testnet
python scripts/deploy-contracts.py --contract orderbook --network testnet
```

## Configuration

### Environment Variables

After deployment, the script generates environment files:

- `.env.testnet` - Testnet configuration
- `.env.mainnet` - Mainnet configuration

Copy the appropriate file to `.env` in your project root:

```bash
# For testnet development
cp .env.testnet .env

# For mainnet production
cp .env.mainnet .env
```

### Deployment Output

The deployment script creates:

1. **Contract App IDs**: Saved to `deployment-{network}.json`
2. **Environment Variables**: Saved to `.env.{network}`
3. **Transaction IDs**: For verification on AlgoExplorer

Example `deployment-testnet.json`:

```json
{
  "network": "testnet",
  "deployer_address": "ABCD...",
  "deployment_timestamp": 1699123456,
  "contracts": {
    "oracle": 123456789,
    "dex": 123456790,
    "orderbook": 123456791
  },
  "asset_ids": {
    "USDC": 31566704
  }
}
```

## Contract Interaction

After deployment, update your frontend configuration:

```typescript
// src/services/algorand/modern-wallet.ts
export const CONTRACT_IDS = {
  PRICE_ORACLE: 123456789, // From deployment output
  PERPETUAL_DEX: 123456790, // From deployment output
  ORDERBOOK: 123456791, // From deployment output
};
```

## Security Considerations

### Testnet

- Use separate test accounts
- Never use real funds
- Contracts can be redeployed freely

### Mainnet

- **CRITICAL**: Secure your deployer mnemonic
- Test thoroughly on testnet first
- Consider multi-sig for contract administration
- Audit contracts before mainnet deployment

### Best Practices

1. **Key Management**

   ```bash
   # Use environment variables, never commit keys
   export DEPLOYER_MNEMONIC="..."

   # Or use a secure key management service
   ```

2. **Verification**

   ```bash
   # Verify deployment on AlgoExplorer
   # Check contract bytecode matches expectations
   # Test basic functionality before announcing
   ```

3. **Monitoring**
   ```bash
   # Monitor contract health
   # Set up alerts for critical functions
   # Track transaction volume and errors
   ```

## Troubleshooting

### Common Issues

1. **Insufficient Balance**

   ```
   Error: Account does not have enough balance
   Solution: Fund deployer account with ALGO
   ```

2. **Compilation Errors**

   ```
   Error: Contract compilation failed
   Solution: Check AlgoPy syntax and dependencies
   ```

3. **Network Issues**
   ```
   Error: Connection timeout
   Solution: Check network connectivity and node status
   ```

### Getting Help

- Check [AlgoKit Documentation](https://developer.algorand.org/docs/get-started/algokit/)
- Review [Algorand Developer Portal](https://developer.algorand.org/)
- Join [Algorand Discord](https://discord.gg/algorand)

## Development Workflow

1. **Local Development**

   ```bash
   # Start local network (optional)
   algokit localnet start

   # Deploy to localnet for testing
   python scripts/deploy-contracts.py --network localnet
   ```

2. **Testing**

   ```bash
   # Test contract functionality
   python scripts/test-contracts.py

   # Run integration tests
   npm run test:contracts
   ```

3. **Staging (Testnet)**

   ```bash
   # Deploy to testnet for staging
   python scripts/deploy-contracts.py --network testnet

   # Test with frontend
   npm run dev
   ```

4. **Production (Mainnet)**
   ```bash
   # Final deployment to mainnet
   python scripts/deploy-contracts.py --network mainnet
   ```

## Contract Upgrades

Smart contracts on Algorand are immutable by default. For upgrades:

1. **Deploy new version** with updated logic
2. **Migrate state** if necessary (manual process)
3. **Update frontend** to use new contract IDs
4. **Deprecate old contracts** gracefully

Consider implementing upgrade mechanisms in your contracts if needed.

---

## License

This project is licensed under the MIT License. See the LICENSE file for details.
