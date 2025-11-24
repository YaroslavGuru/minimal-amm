# Minimal AMM 

A production-ready, minimal constant-product AMM inspired by Uniswap v2. Includes Solidity contracts, LP token logic, tests, docs, and deployment workflow.

## Getting Started

```bash
npm install
npx hardhat compile
npx hardhat test
```

## Deploy

Local / testnet deployment:

```bash
# Optional: set existing token addresses
set TOKEN0_ADDRESS=0x...
set TOKEN1_ADDRESS=0x...

npm run deploy
```

If no token addresses are provided the script deploys two `TestToken` mocks for demonstration.

## Project Layout

- `contracts/AMM.sol` – constant-product pool with liquidity, swap, and invariant enforcement.
- `contracts/LPToken.sol` – minimal ERC20 share token bound to the AMM.
- `contracts/Interfaces.sol` – IERC20 interface used across contracts.
- `contracts/mocks/TestToken.sol` – mintable ERC20 for tests/local deployments.
- `test/amm.test.js` – Hardhat test suite covering liquidity, swaps, and invariants.
- `docs/*.md` – architecture, math, and security notes for developers.
- `scripts/deploy.js` – Hardhat deploy script with optional mock token deployment.

## Development Notes

- Solidity `^0.8.24`, no external math deps.
- Constant product invariant enforced on every state transition.
- Deterministic LP share minting aligned with reserve ratios.
- Event-rich API for downstream integrations.

