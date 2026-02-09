# Minimal Constant-Product AMM | DeFi Liquidity Pool in Solidity

**A production-quality minimal Automated Market Maker (AMM)** for Ethereum and EVM chains. Implements the constant-product invariant (`x * y = k`), liquidity provision with LP tokens, and token swaps with a 0.3% fee—inspired by Uniswap V2. Built with Solidity, Hardhat, and OpenZeppelin for developers and learners in decentralized finance (DeFi).

---

## What is This Project?

This repository provides a **minimal, auditable AMM smart contract** that you can study, fork, or extend. It includes:

- **Constant-product invariant** — reserves always satisfy `reserve0 × reserve1 ≥ k`
- **0.3% swap fee** — 997/1000 of input goes to reserves; fee accrues to LPs
- **Liquidity add/remove** — proportional LP token minting and burning
- **Gas-optimized Solidity** — `uint112` reserves, immutables, minimal storage
- **Full test suite** — TypeScript tests with gas reporting and invariant checks

Ideal for: **learning DeFi/AMM mechanics**, **building a DEX or liquidity pool**, **smart contract education**, and **Uniswap-style constant-product implementation**.

---

## Table of Contents

- [Features](#-features)
- [Installation](#-installation)
- [Quick Start](#-quick-start)
- [Architecture](#-architecture)
- [Mathematics](#-mathematics)
- [Usage Examples](#-usage-examples)
- [Testing](#-testing)
- [Deployment](#-deployment)
- [Project Structure](#-project-structure)
- [Documentation](#-documentation)
- [Security](#-security-considerations)
- [Author & Contact](#-author--contact)
- [License](#-license)

---

## Features

- **Constant-Product Invariant** — Maintains `reserve0 × reserve1 ≥ k` at all times
- **0.3% Swap Fee** — Applied to all swaps (997/1000 of input goes to reserves)
- **Liquidity Management** — Add/remove liquidity with proportional LP token minting/burning
- **Comprehensive Testing** — Full TypeScript test suite with gas reporting
- **Gas Optimized** — Efficient storage and minimal external calls
- **Production-Oriented** — OpenZeppelin contracts and Solidity best practices

---

## Installation

### Prerequisites

- **Node.js** ≥ 18.0.0  
- **npm** or **yarn**  
- **Git**

### Setup

```bash
git clone https://github.com/KuchikiRenji/minimal-amm.git
cd minimal-amm
npm install
npm run build
```

---

## Quick Start

### Run Tests

```bash
npm test
npm run test:gas   # with gas reporting
```

### Deploy Locally

```bash
npx hardhat node
# In another terminal:
npm run deploy
```

---

## Architecture

### Core Components

| Contract       | Role |
|----------------|------|
| **AMM.sol**    | Main AMM: liquidity and swaps |
| **LPToken.sol**| ERC20 LP shares; only AMM can mint/burn |
| **TestToken.sol** | ERC20 mock for tests and local deploy |

### Main Functions

- **Add liquidity:** `addLiquidity(uint256 amount0, uint256 amount1) → uint256 liquidity`
- **Remove liquidity:** `removeLiquidity(uint256 liquidity) → (uint256 amount0, uint256 amount1)`
- **Swap:** `swap(address tokenIn, uint256 amountIn) → uint256 amountOut`

Details: [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).

---

## Mathematics

### Swap (with 0.3% fee)

```
amountInWithFee = amountIn × 997 / 1000
amountOut = (amountInWithFee × reserveOut) / (reserveIn + amountInWithFee)
```

### LP Token Minting

- **First liquidity:** `liquidity = sqrt(amount0 × amount1)`
- **Later liquidity:** `liquidity = min(amount0 × totalSupply / reserve0, amount1 × totalSupply / reserve1)`

### Invariant

Pool keeps `reserve0 × reserve1 ≥ k`; after swaps, `k` increases due to the fee.

More: [docs/invariant-math.md](./docs/invariant-math.md), [docs/MATH.md](./docs/MATH.md).

---

## Usage Examples

### Add Liquidity

```typescript
await token0.approve(ammAddress, ethers.parseEther("1000"));
await token1.approve(ammAddress, ethers.parseEther("1000"));
await amm.addLiquidity(ethers.parseEther("1000"), ethers.parseEther("1000"));
```

### Swap

```typescript
await token0.approve(ammAddress, ethers.parseEther("10"));
await amm.swap(token0Address, ethers.parseEther("10"));
```

### Remove Liquidity

```typescript
const lpBalance = await lpToken.balanceOf(userAddress);
await amm.removeLiquidity(lpBalance);
```

### Pool State

```typescript
const [reserve0, reserve1] = await amm.getReserves();
```

---

## Testing

- Deployment and initialization  
- Add/remove liquidity  
- Swaps both directions  
- Constant-product invariant  
- Edge cases and reverts  
- Slippage and gas checks  

```bash
npm test
REPORT_GAS=true npm test
npx hardhat test test/amm.test.ts
```

---

## Deployment

### Local

```bash
npm run deploy
```

### Testnet (e.g. Sepolia)

1. Create `.env`:

```env
PRIVATE_KEY=your_private_key
RPC_URL=https://sepolia.infura.io/v3/your_key
```

2. Deploy:

```bash
npx hardhat run scripts/deploy.ts --network sepolia
```

### With Existing Tokens

```bash
export TOKEN0_ADDRESS=0x...
export TOKEN1_ADDRESS=0x...
npm run deploy
```

---

## Project Structure

```
minimal-amm/
├── contracts/
│   ├── AMM.sol              # Core AMM
│   ├── LPToken.sol          # LP token
│   └── mocks/
│       └── TestToken.sol    # Test ERC20
├── test/
│   └── amm.test.ts
├── scripts/
│   └── deploy.ts
├── docs/
│   ├── ARCHITECTURE.md
│   ├── invariant-math.md
│   ├── MATH.md
│   └── SECURITY.md
├── hardhat.config.ts
├── tsconfig.json
└── README.md
```

---

## Documentation

- [Architecture](./docs/ARCHITECTURE.md) — Design and components  
- [Mathematics](./docs/invariant-math.md) — Formulas and invariant  
- [MATH.md](./docs/MATH.md) — Math primer  
- [Security](./docs/SECURITY.md) — Security and oracle notes  

---

## Security Considerations

- **Reentrancy** — OpenZeppelin ERC20 and careful state updates  
- **Overflow** — Solidity 0.8.24 checks; reserves in `uint112`  
- **Inputs** — Zero/address checks; invariant checked after swaps  
- **LP token** — Mint/burn restricted to AMM  

This is a minimal, educational implementation. For production: consider formal verification, audits, flash-loan/oracle safeguards, and TWAP oracles. See [docs/SECURITY.md](./docs/SECURITY.md).

---

## Events

- **LiquidityAdded** — `(provider, amount0, amount1, liquidityMinted)`  
- **LiquidityRemoved** — `(provider, amount0, amount1, liquidityBurned)`  
- **SwapExecuted** — `(trader, tokenIn, amountIn, tokenOut, amountOut)`  

---

## Development

```bash
npm run lint:sol    # Lint Solidity
npm run format      # Prettier
npx tsc --noEmit    # Type check
```

---

## Author & Contact

**KuchikiRenji**

| Channel   | Handle / Link |
|-----------|----------------|
| **GitHub**  | [github.com/KuchikiRenji](https://github.com/KuchikiRenji) |
| **Email**   | [KuchikiRenji@outlook.com](mailto:KuchikiRenji@outlook.com) |
| **Discord** | `kuchiki_renji` |

For questions, open an [issue](https://github.com/KuchikiRenji/minimal-amm/issues) or reach out via the channels above.

---

## License

ISC

---

## Acknowledgments

- Design inspired by **Uniswap V2**
- **OpenZeppelin** contracts
- **Hardhat** for development and testing
