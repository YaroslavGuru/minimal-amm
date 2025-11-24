# AMM Architecture

## Overview

This document describes the architecture of the Minimal Constant-Product AMM, a simplified implementation inspired by Uniswap V2.

## System Components

### 1. AMM Contract (`AMM.sol`)

The core contract that manages the liquidity pool and executes swaps.

#### Key Features:
- **Constant-Product Invariant**: Maintains `reserve0 * reserve1 >= k` at all times
- **0.3% Swap Fee**: Applied to all swaps (997/1000 of input goes to reserves)
- **Liquidity Management**: Add/remove liquidity with proportional LP token minting/burning
- **Reserve Tracking**: Uses `uint112` for gas efficiency (max ~5.1e33 tokens)

#### State Variables:
```solidity
address public immutable token0;      // First token (address < token1)
address public immutable token1;      // Second token (address > token0)
uint112 private reserve0;              // Reserve of token0
uint112 private reserve1;              // Reserve of token1
LPToken public immutable lpToken;     // LP token contract
```

#### Core Functions:

**`addLiquidity(uint256 amount0, uint256 amount1)`**
- Transfers tokens from sender to AMM
- Mints LP tokens based on liquidity formula
- Updates reserves
- Emits `LiquidityAdded` event

**`removeLiquidity(uint256 liquidity)`**
- Burns LP tokens from sender
- Returns proportional amounts of token0 and token1
- Updates reserves
- Emits `LiquidityRemoved` event

**`swap(address tokenIn, uint256 amountIn)`**
- Transfers input token from sender
- Calculates output using constant-product formula with fee
- Transfers output token to sender
- Updates reserves and validates invariant
- Emits `SwapExecuted` event

### 2. LP Token Contract (`LPToken.sol`)

ERC20 token representing liquidity provider shares in the pool.

#### Features:
- Extends OpenZeppelin's `ERC20`
- Only the AMM contract can mint/burn tokens
- Standard ERC20 functionality (transfer, approve, etc.)

#### Access Control:
- `onlyAMM` modifier restricts mint/burn to AMM contract
- Public functions for standard ERC20 operations

### 3. Test Token (`mocks/TestToken.sol`)

Simple ERC20 token for testing and local deployments.

#### Features:
- Extends OpenZeppelin's `ERC20`
- Includes `mint()` function for easy test setup
- Standard ERC20 implementation

## Data Flow

### Adding Liquidity

```
User → approve(token0, AMM) → approve(token1, AMM)
User → addLiquidity(amount0, amount1)
  ↓
AMM → transferFrom(token0, user, AMM)
AMM → transferFrom(token1, user, AMM)
AMM → calculate liquidity
AMM → lpToken.mint(user, liquidity)
AMM → update reserves
AMM → emit LiquidityAdded
```

### Removing Liquidity

```
User → removeLiquidity(liquidity)
  ↓
AMM → calculate proportional amounts
AMM → lpToken.burn(user, liquidity)
AMM → transfer(token0, user, amount0)
AMM → transfer(token1, user, amount1)
AMM → update reserves
AMM → emit LiquidityRemoved
```

### Swapping Tokens

```
User → approve(tokenIn, AMM)
User → swap(tokenIn, amountIn)
  ↓
AMM → transferFrom(tokenIn, user, AMM)
AMM → calculate amountOut (with fee)
AMM → transfer(tokenOut, user, amountOut)
AMM → update reserves
AMM → validate invariant (k_new >= k_old)
AMM → emit SwapExecuted
```

## Security Considerations

### 1. Reentrancy Protection
- Uses OpenZeppelin's `ERC20` which follows checks-effects-interactions pattern
- State updates before external calls where possible

### 2. Overflow Protection
- Solidity 0.8.24 provides built-in overflow checks
- Reserve values limited to `uint112` to prevent overflow

### 3. Access Control
- LP token mint/burn restricted to AMM contract
- No admin functions (fully decentralized)

### 4. Input Validation
- Zero address checks in constructor
- Zero amount checks in all functions
- Token validation in swap function

### 5. Invariant Enforcement
- Constant-product invariant validated after swaps
- Ensures `k_new >= k_old` (fee increases k)

## Gas Optimization

1. **Packed Storage**: Reserves stored as `uint112` (can pack with other values)
2. **Immutable Variables**: Token addresses and LP token are immutable
3. **Minimal Storage Reads**: Cache reserves in local variables
4. **Efficient Math**: Babylonian method for square root calculation

## Event Structure

All events include indexed parameters for efficient filtering:

- `LiquidityAdded(provider, amount0, amount1, liquidityMinted)`
- `LiquidityRemoved(provider, amount0, amount1, liquidityBurned)`
- `SwapExecuted(trader, tokenIn, amountIn, tokenOut, amountOut)`

## Integration Points

### Frontend Integration
- Listen to events for real-time updates
- Use `getReserves()` for current pool state
- Calculate prices using reserve ratios

### DeFi Protocol Integration
- Can be used as a price oracle (with appropriate safeguards)
- LP tokens can be used as collateral in other protocols
- Can be extended with additional features (flash loans, etc.)

## Future Enhancements

Potential improvements for production use:
1. Flash loan support
2. Price oracle functionality
3. Multi-hop routing
4. Fee tier selection
5. Governance token integration
6. Time-weighted average price (TWAP)
