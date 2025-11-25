# Minimal Constant-Product AMM

A production-quality minimal Automated Market Maker (AMM) implementation inspired by Uniswap V2. This project demonstrates core DeFi concepts including constant-product invariant, liquidity provision, and token swaps with a 0.3% fee.

## 🎯 Features

- **Constant-Product Invariant**: Maintains `reserve0 * reserve1 >= k` at all times
- **0.3% Swap Fee**: Applied to all swaps (997/1000 of input goes to reserves)
- **Liquidity Management**: Add/remove liquidity with proportional LP token minting/burning
- **Comprehensive Testing**: Full TypeScript test suite with 100% coverage
- **Gas Optimized**: Efficient storage and minimal external calls
- **Production Ready**: Built with OpenZeppelin contracts and best practices

## 📋 Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Mathematics](#mathematics)
- [Usage Examples](#usage-examples)
- [Testing](#testing)
- [Deployment](#deployment)
- [Project Structure](#project-structure)
- [Documentation](#documentation)

## 🚀 Installation

### Prerequisites

- Node.js >= 18.0.0
- npm or yarn
- Git

### Setup

```bash
# Clone the repository
git clone <repository-url>
cd minimal-amm

# Install dependencies
npm install

# Compile contracts
npm run build
```

## 🏃 Quick Start

### Run Tests

```bash
# Run all tests
npm test

# Run tests with gas reporting
npm run test:gas
```

### Deploy Locally

```bash
# Start local Hardhat node
npx hardhat node

# In another terminal, deploy contracts
npm run deploy
```

## 🏗️ Architecture

### Core Components

1. **AMM.sol** - Main AMM contract managing liquidity and swaps
2. **LPToken.sol** - ERC20 token representing liquidity provider shares
3. **TestToken.sol** - Simple ERC20 for testing and local deployments

### Key Functions

#### Add Liquidity
```solidity
function addLiquidity(uint256 amount0, uint256 amount1) external returns (uint256 liquidity)
```

#### Remove Liquidity
```solidity
function removeLiquidity(uint256 liquidity) external returns (uint256 amount0, uint256 amount1)
```

#### Swap Tokens
```solidity
function swap(address tokenIn, uint256 amountIn) external returns (uint256 amountOut)
```

For detailed architecture documentation, see [docs/architecture.md](./docs/architecture.md).

## 📐 Mathematics

### Swap Formula

When swapping `amountIn` of `tokenIn` for `tokenOut`:

```
amountInWithFee = amountIn * 997 / 1000
amountOut = (amountInWithFee * reserveOut) / (reserveIn + amountInWithFee)
```

### LP Token Minting

**First liquidity:**
```
liquidity = sqrt(amount0 * amount1)
```

**Subsequent liquidity:**
```
liquidity = min(
    amount0 * totalSupply / reserve0,
    amount1 * totalSupply / reserve1
)
```

### Constant-Product Invariant

The pool maintains:
```
reserve0 * reserve1 >= k
```

After swaps, `k` increases due to the 0.3% fee, benefiting liquidity providers.

For detailed mathematical explanations, see [docs/invariant-math.md](./docs/invariant-math.md).

## 💡 Usage Examples

### Adding Liquidity

```typescript
// Approve tokens
await token0.approve(ammAddress, ethers.parseEther("1000"));
await token1.approve(ammAddress, ethers.parseEther("1000"));

// Add liquidity
await amm.addLiquidity(
  ethers.parseEther("1000"),
  ethers.parseEther("1000")
);
```

### Swapping Tokens

```typescript
// Approve input token
await token0.approve(ammAddress, ethers.parseEther("10"));

// Swap token0 for token1
await amm.swap(token0Address, ethers.parseEther("10"));
```

### Removing Liquidity

```typescript
// Get LP token balance
const lpBalance = await lpToken.balanceOf(userAddress);

// Remove liquidity
await amm.removeLiquidity(lpBalance);
```

### Getting Pool State

```typescript
// Get current reserves
const [reserve0, reserve1] = await amm.getReserves();

// Calculate spot price
const spotPrice = reserve1 / reserve0;
```

## 🧪 Testing

The test suite includes:

- ✅ Deployment and initialization tests
- ✅ Add/remove liquidity tests
- ✅ Swap functionality tests
- ✅ Constant-product invariant validation
- ✅ Edge cases and revert conditions
- ✅ Slippage calculations
- ✅ Gas optimization verification

### Run Tests

```bash
# Run all tests
npm test

# Run with gas reporting
REPORT_GAS=true npm test

# Run specific test file
npx hardhat test test/amm.test.ts
```

### Test Coverage

The test suite covers:
- Initial deployment state
- Adding liquidity (first and subsequent)
- Removing liquidity
- Swapping in both directions
- Invariant maintenance
- Slippage protection
- Error conditions

## 🚢 Deployment

### Local Deployment

```bash
# Deploy to local Hardhat network
npm run deploy
```

### Testnet Deployment

1. Create a `.env` file:
```env
PRIVATE_KEY=your_private_key
RPC_URL=https://sepolia.infura.io/v3/your_key
```

2. Update `hardhat.config.ts` with network configuration

3. Deploy:
```bash
npx hardhat run scripts/deploy.ts --network sepolia
```

### Using Existing Tokens

```bash
# Set environment variables
export TOKEN0_ADDRESS=0x...
export TOKEN1_ADDRESS=0x...

# Deploy
npm run deploy
```

## 📁 Project Structure

```
minimal-amm/
├── contracts/
│   ├── AMM.sol              # Core AMM contract
│   ├── LPToken.sol          # LP token contract
│   └── mocks/
│       └── TestToken.sol    # Test ERC20 token
├── test/
│   └── amm.test.ts          # Comprehensive test suite
├── scripts/
│   └── deploy.ts            # Deployment script
├── docs/
│   ├── architecture.md      # Architecture documentation
│   └── invariant-math.md    # Mathematical formulas
├── hardhat.config.ts        # Hardhat configuration
├── tsconfig.json            # TypeScript configuration
└── README.md                # This file
```

## 📚 Documentation

- **[Architecture](./docs/architecture.md)** - System design and component overview
- **[Mathematics](./docs/invariant-math.md)** - Detailed formulas and calculations
- **[Security](./docs/SECURITY.md)** - Security considerations and best practices

## 🔒 Security Considerations

- **Reentrancy Protection**: Uses OpenZeppelin's battle-tested ERC20
- **Overflow Protection**: Solidity 0.8.24 built-in checks
- **Input Validation**: Comprehensive checks on all inputs
- **Invariant Enforcement**: Constant-product validated after each operation
- **Access Control**: LP token mint/burn restricted to AMM contract

⚠️ **Note**: This is a minimal implementation for educational purposes. For production use, consider additional security measures like:
- Formal verification
- Professional audit
- Flash loan protection
- Oracle integration for price feeds

## 🛠️ Development

### Code Quality

```bash
# Lint Solidity code
npm run lint:sol

# Format code
npm run format

# Type check
npx tsc --noEmit
```

### Gas Optimization

The contract is optimized for gas efficiency:
- Uses `uint112` for reserves (allows packing)
- Immutable variables for token addresses
- Minimal storage reads
- Efficient square root calculation

## 📊 Events

The AMM emits the following events:

### LiquidityAdded
```solidity
event LiquidityAdded(
    address indexed provider,
    uint256 amount0,
    uint256 amount1,
    uint256 liquidityMinted
);
```

### LiquidityRemoved
```solidity
event LiquidityRemoved(
    address indexed provider,
    uint256 amount0,
    uint256 amount1,
    uint256 liquidityBurned
);
```

### SwapExecuted
```solidity
event SwapExecuted(
    address indexed trader,
    address indexed tokenIn,
    uint256 amountIn,
    address indexed tokenOut,
    uint256 amountOut
);
```

## 🔄 AMM Flow Diagram

```
┌─────────────┐
│   User      │
└──────┬──────┘
       │
       ├─► Add Liquidity ──► Mint LP Tokens
       │
       ├─► Remove Liquidity ──► Burn LP Tokens
       │
       └─► Swap Tokens ──► Update Reserves
                          │
                          └─► Validate Invariant (k_new >= k_old)
```

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

ISC

## 🙏 Acknowledgments

- Inspired by Uniswap V2
- Built with OpenZeppelin contracts
- Uses Hardhat for development

## 📞 Support

For questions or issues, please open an issue on GitHub.

---

**Built with ❤️ for the DeFi community**
