# Invariant Mathematics

This document explains the mathematical formulas used in the Minimal AMM.

## Constant-Product Invariant

The core invariant maintained by the AMM is:

```
k = reserve0 * reserve1
```

After any operation (add liquidity, remove liquidity, swap), the new constant `k'` must satisfy:

```
k' >= k
```

For swaps, `k' > k` due to the 0.3% fee, which increases the pool's value.

## Swap Formula

### Input/Output Calculation

When swapping `amountIn` of `tokenIn` for `tokenOut`:

1. **Calculate input after fee** (0.3% fee):
   ```
   amountInWithFee = amountIn * 997 / 1000
   ```

2. **Calculate output**:
   ```
   amountOut = (amountInWithFee * reserveOut) / (reserveIn + amountInWithFee)
   ```

### Complete Formula

```
amountOut = (amountIn * 997 * reserveOut) / (1000 * reserveIn + amountIn * 997)
```

### Example

Given:
- `reserve0 = 1000`
- `reserve1 = 1000`
- `amountIn = 10` (swapping token0 for token1)

Calculation:
```
amountInWithFee = 10 * 997 / 1000 = 9.97
amountOut = (9.97 * 1000) / (1000 + 9.97) = 9970 / 1009.97 ≈ 9.87
```

New reserves:
- `reserve0 = 1010`
- `reserve1 = 990.13`
- `k_new = 1010 * 990.13 = 1,000,031.3`
- `k_old = 1000 * 1000 = 1,000,000`
- `k_new > k_old` ✓ (fee increases k)

## Liquidity Token Minting

### First Liquidity Provision

When the pool is empty (`reserve0 = 0` and `reserve1 = 0`):

```
liquidity = sqrt(amount0 * amount1)
```

This ensures that the initial LP token supply represents the geometric mean of the provided amounts.

**Example:**
- `amount0 = 1000`
- `amount1 = 1000`
- `liquidity = sqrt(1000 * 1000) = 1000`

### Subsequent Liquidity Provision

When liquidity already exists, new LP tokens are minted proportionally:

```
liquidity0 = (amount0 * totalSupply) / reserve0
liquidity1 = (amount1 * totalSupply) / reserve1
liquidity = min(liquidity0, liquidity1)
```

This ensures that LP tokens are minted based on the limiting factor (the token with less proportional contribution).

**Example:**
- `reserve0 = 1000`, `reserve1 = 1000`
- `totalSupply = 1000`
- `amount0 = 500`, `amount1 = 500`

Calculation:
```
liquidity0 = (500 * 1000) / 1000 = 500
liquidity1 = (500 * 1000) / 1000 = 500
liquidity = min(500, 500) = 500
```

New state:
- `reserve0 = 1500`, `reserve1 = 1500`
- `totalSupply = 1500`

### Non-Proportional Liquidity

If amounts are not proportional, the smaller liquidity value is used:

**Example:**
- `reserve0 = 1000`, `reserve1 = 1000`
- `totalSupply = 1000`
- `amount0 = 500`, `amount1 = 300` (not proportional)

Calculation:
```
liquidity0 = (500 * 1000) / 1000 = 500
liquidity1 = (300 * 1000) / 1000 = 300
liquidity = min(500, 300) = 300
```

This means only 300 LP tokens are minted, and the excess tokens remain in the pool (effectively donated to existing LPs).

## Liquidity Removal

When removing liquidity, tokens are returned proportionally:

```
amount0 = (liquidity * reserve0) / totalSupply
amount1 = (liquidity * reserve1) / totalSupply
```

**Example:**
- `reserve0 = 1500`, `reserve1 = 1500`
- `totalSupply = 1500`
- `liquidity = 500` (removing 1/3 of LP tokens)

Calculation:
```
amount0 = (500 * 1500) / 1500 = 500
amount1 = (500 * 1500) / 1500 = 500
```

New state:
- `reserve0 = 1000`, `reserve1 = 1000`
- `totalSupply = 1000`

## Price Calculation

### Spot Price

The spot price of `token0` in terms of `token1`:

```
price = reserve1 / reserve0
```

**Example:**
- `reserve0 = 1000`
- `reserve1 = 2000`
- `price = 2000 / 1000 = 2` (1 token0 = 2 token1)

### Effective Exchange Rate

For a swap of `amountIn`, the effective exchange rate is:

```
effectiveRate = amountOut / amountIn
```

This will be less than the spot price due to:
1. **Slippage**: Price impact of the trade
2. **Fee**: 0.3% fee reduces output

## Square Root Calculation

The contract uses the Babylonian method (Heron's method) to calculate square roots:

```solidity
function _sqrt(uint256 x) internal pure returns (uint256 y) {
    if (x == 0) return 0;
    uint256 z = (x + 1) / 2;
    y = x;
    while (z < y) {
        y = z;
        z = (x / z + z) / 2;
    }
}
```

This iterative method converges to `sqrt(x)` efficiently.

## Invariant Validation

After each swap, the contract validates:

```
newReserve0 * newReserve1 >= oldReserve0 * oldReserve1
```

This ensures:
- The constant-product invariant is maintained
- Fees are properly collected (k increases)
- No rounding errors cause invariant violations

## Slippage

Slippage occurs when the effective exchange rate differs from the spot price. For large swaps:

```
slippage = (spotPrice - effectiveRate) / spotPrice
```

**Example:**
- `reserve0 = 1000`, `reserve1 = 1000`
- Spot price: `1 token0 = 1 token1`
- Swap: `amountIn = 100 token0`

Calculation:
```
amountInWithFee = 100 * 997 / 1000 = 99.7
amountOut = (99.7 * 1000) / (1000 + 99.7) ≈ 90.64
effectiveRate = 90.64 / 100 = 0.9064
slippage = (1 - 0.9064) / 1 = 9.36%
```

## Fee Collection

The 0.3% fee is collected by increasing the constant `k`:

```
fee_collected = k_new - k_old
```

This fee accrues to liquidity providers, increasing the value of LP tokens over time.

## Mathematical Properties

1. **Symmetry**: Swapping in either direction uses the same formula
2. **Monotonicity**: Larger input always produces larger output
3. **Convexity**: Price impact increases with trade size
4. **Fee Efficiency**: Fees are collected without separate accounting

## References

- Uniswap V2 Whitepaper: https://uniswap.org/whitepaper.pdf
- Constant Product Market Maker Formula
- Automated Market Maker (AMM) Mathematics

