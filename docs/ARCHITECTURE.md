# Minimal AMM Architecture

## Pool Overview

- The AMM holds two ERC20 assets – `token0` and `token1`.
- Liquidity providers deposit both assets into the pool and receive `LPToken` shares.
- Reserves are tracked on-chain (`reserve0`, `reserve1`) and updated after every state change.

## Token Roles

| Component | Responsibility |
|-----------|----------------|
| `token0` / `token1` | External ERC20 assets paired in the pool. |
| `LPToken` | ERC20 share token minted/burned by the AMM to represent proportional ownership of pooled assets. |

## Liquidity Lifecycle

1. **Add Liquidity**
   - Providers transfer equal-value amounts of both tokens.
   - Initial liquidity mints `sqrt(amount0 * amount1)` LP tokens.
   - Subsequent deposits mint shares proportionally to existing reserves to avoid dilution.
2. **Remove Liquidity**
   - Burning LP tokens releases the provider’s proportional share of each underlying reserve.
   - Reserves shrink in lockstep with LP supply to maintain proportion.

## LP Share Model

- LP supply tracks cumulative liquidity depth.
- Share of pool for address `x`:

```
share_x = balanceOf_x / totalSupply
```

- Withdrawals simply multiply this share by current reserves.

## Swap Process

1. Trader specifies `tokenIn` and `amountIn`.
2. AMM transfers `amountIn` into contract and computes `amountOut` via:

```
amountOut = (amountIn * reserveOut) / (reserveIn + amountIn)
```

3. Output tokens are sent to the trader, reserves are updated, and invariant enforced.

## Price Formation

- Spot price equals the ratio of reserves (`price = reserve1 / reserve0` for token0 priced in token1).
- Every swap nudges reserves and therefore the price, creating a continuous, permissionless market.
- No external pricing input is required; arbitrageurs align pool prices with the broader market.

