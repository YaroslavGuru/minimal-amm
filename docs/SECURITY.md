# Security Considerations

## Front-Running & MEV
- Pending transactions are public in the mempool, allowing adversaries to reorder trades for profit.
- Mitigation options include batching, private order flow, or off-chain execution commitments; this minimal AMM leaves ordering to the base chain.

## Price Manipulation
- Thin liquidity allows a single swap to move prices significantly.
- Downstream protocols must not treat instantaneous pool prices as ground truth without safeguards (e.g., volume filters, depth requirements).

## Sandwich Attacks
- Attackers can buy before and sell after a victim swap to extract value.
- Users can reduce exposure by specifying tight slippage bounds or using private relays.

## Flash-Loan Reserve Manipulation
- Because swaps deterministically follow `x * y = k`, flash loans can momentarily skew reserves and prices within one block.
- Consumers of on-chain prices must verify time-weighted data before using it for lending/liquidation decisions.

## Oracle Practices
- Uniswap v2 introduced TWAP oracles that integrate prices over time, making it expensive to manipulate references.
- This minimal AMM intentionally omits oracle logic for clarity; production deployments should pair pools with robust TWAP/median oracles.

