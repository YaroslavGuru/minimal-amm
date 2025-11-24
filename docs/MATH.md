# AMM Math Primer

## Constant Product

The pool enforces `x * y = k`, where:
- `x` = reserve of `token0`
- `y` = reserve of `token1`
- `k` = invariant product

Every trade must satisfy `x_new * y_new >= k_old`, preventing liquidity providers from losing principal (ignoring slippage).

## Swap Output

Given input `Δx` of `token0`:

```
x_new = x + Δx
amountOut = Δy = (Δx * y) / (x + Δx)
y_new = y - Δy
```

Rounding favors the pool, so `k` weakly increases.

## LP Minting

- **Initial deposit**: `liquidity = sqrt(amount0 * amount1)`
- **Subsequent deposit**:

```
liquidity = min(
  amount0 * totalSupply / reserve0,
  amount1 * totalSupply / reserve1
)
```

This keeps new LPs from gaining more than their proportional share when depositing imbalanced amounts.

## LP Burning

For LP tokens burned `L`:

```
amount0 = L * reserve0 / totalSupply
amount1 = L * reserve1 / totalSupply
```

## Numerical Example

- Reserves: `x = 1,000`, `y = 1,000`
- Trader swaps `Δx = 100`
- `amountOut = 100 * 1000 / 1100 = 90.90...` → `90`
- New reserves: `1,100` and `910`, product = `1,001,000` (invariant increased).

