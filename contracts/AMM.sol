// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./LPToken.sol";

/**
 * @title AMM
 * @dev Minimal constant-product automated market maker (similar to Uniswap V2)
 * @notice Implements add/remove liquidity and token swaps with 0.3% fee
 */
contract AMM {
    /// @dev Address of the first token in the pair
    address public immutable token0;
    /// @dev Address of the second token in the pair
    address public immutable token1;

    /// @dev Reserve of token0 in the pool
    uint112 private reserve0;
    /// @dev Reserve of token1 in the pool
    uint112 private reserve1;

    /// @dev LP token contract representing liquidity provider shares
    LPToken public immutable lpToken;

    /// @dev Constant for 0.3% fee (997/1000 = 99.7% of input goes to reserves)
    uint256 private constant FEE_DENOMINATOR = 1000;
    uint256 private constant FEE_NUMERATOR = 997;

    /**
     * @dev Emitted when liquidity is added to the pool
     * @param provider Address that provided liquidity
     * @param amount0 Amount of token0 added
     * @param amount1 Amount of token1 added
     * @param liquidityMinted Amount of LP tokens minted
     */
    event LiquidityAdded(
        address indexed provider,
        uint256 amount0,
        uint256 amount1,
        uint256 liquidityMinted
    );

    /**
     * @dev Emitted when liquidity is removed from the pool
     * @param provider Address that removed liquidity
     * @param amount0 Amount of token0 removed
     * @param amount1 Amount of token1 removed
     * @param liquidityBurned Amount of LP tokens burned
     */
    event LiquidityRemoved(
        address indexed provider,
        uint256 amount0,
        uint256 amount1,
        uint256 liquidityBurned
    );

    /**
     * @dev Emitted when a swap is executed
     * @param trader Address that executed the swap
     * @param tokenIn Address of the input token
     * @param amountIn Amount of input token
     * @param tokenOut Address of the output token
     * @param amountOut Amount of output token
     */
    event SwapExecuted(
        address indexed trader,
        address indexed tokenIn,
        uint256 amountIn,
        address indexed tokenOut,
        uint256 amountOut
    );

    /**
     * @dev Constructor that initializes the AMM with two tokens
     * @param _token0 Address of the first token
     * @param _token1 Address of the second token
     */
    constructor(address _token0, address _token1) {
        require(_token0 != address(0) && _token1 != address(0), "AMM: zero address");
        require(_token0 != _token1, "AMM: identical tokens");
        
        // Ensure token0 < token1 for consistency
        if (_token0 < _token1) {
            token0 = _token0;
            token1 = _token1;
        } else {
            token0 = _token1;
            token1 = _token0;
        }
        
        lpToken = new LPToken("Minimal AMM LP", "MALP", address(this));
    }

    /**
     * @dev Returns the current reserves of both tokens
     * @return _reserve0 Reserve of token0
     * @return _reserve1 Reserve of token1
     */
    function getReserves() external view returns (uint112 _reserve0, uint112 _reserve1) {
        return (reserve0, reserve1);
    }

    /**
     * @dev Adds liquidity to the pool and mints LP tokens
     * @param amount0 Amount of token0 to add
     * @param amount1 Amount of token1 to add
     * @return liquidity Amount of LP tokens minted
     */
    function addLiquidity(
        uint256 amount0,
        uint256 amount1
    ) external returns (uint256 liquidity) {
        require(amount0 > 0 && amount1 > 0, "AMM: invalid amounts");

        // Transfer tokens from sender to AMM
        IERC20(token0).transferFrom(msg.sender, address(this), amount0);
        IERC20(token1).transferFrom(msg.sender, address(this), amount1);

        uint112 _reserve0 = reserve0;
        uint112 _reserve1 = reserve1;

        if (_reserve0 == 0 && _reserve1 == 0) {
            // First liquidity provision: liquidity = sqrt(amount0 * amount1)
            liquidity = _sqrt(amount0 * amount1);
            require(liquidity > 0, "AMM: insufficient initial liquidity");
        } else {
            // Subsequent liquidity: mint proportional to existing reserves
            uint256 totalSupply = lpToken.totalSupply();
            uint256 liquidity0 = (amount0 * totalSupply) / _reserve0;
            uint256 liquidity1 = (amount1 * totalSupply) / _reserve1;
            liquidity = liquidity0 < liquidity1 ? liquidity0 : liquidity1;
            require(liquidity > 0, "AMM: insufficient liquidity minted");
        }

        lpToken.mint(msg.sender, liquidity);

        uint256 newReserve0 = uint256(_reserve0) + amount0;
        uint256 newReserve1 = uint256(_reserve1) + amount1;
        _updateReserves(newReserve0, newReserve1);

        emit LiquidityAdded(msg.sender, amount0, amount1, liquidity);
    }

    /**
     * @dev Removes liquidity from the pool and burns LP tokens
     * @param liquidity Amount of LP tokens to burn
     * @return amount0 Amount of token0 returned
     * @return amount1 Amount of token1 returned
     */
    function removeLiquidity(
        uint256 liquidity
    ) external returns (uint256 amount0, uint256 amount1) {
        require(liquidity > 0, "AMM: zero liquidity");

        uint256 _totalSupply = lpToken.totalSupply();
        require(_totalSupply > 0, "AMM: no liquidity");

        // Calculate proportional amounts to return
        amount0 = (liquidity * reserve0) / _totalSupply;
        amount1 = (liquidity * reserve1) / _totalSupply;
        require(amount0 > 0 && amount1 > 0, "AMM: zero amounts");

        lpToken.burn(msg.sender, liquidity);

        // Transfer tokens back to sender
        IERC20(token0).transfer(msg.sender, amount0);
        IERC20(token1).transfer(msg.sender, amount1);

        uint256 newReserve0 = uint256(reserve0) - amount0;
        uint256 newReserve1 = uint256(reserve1) - amount1;
        _updateReserves(newReserve0, newReserve1);

        emit LiquidityRemoved(msg.sender, amount0, amount1, liquidity);
    }

    /**
     * @dev Swaps tokens using constant-product formula with 0.3% fee
     * @param tokenIn Address of the input token (must be token0 or token1)
     * @param amountIn Amount of input token to swap
     * @return amountOut Amount of output token received
     */
    function swap(address tokenIn, uint256 amountIn) external returns (uint256 amountOut) {
        require(amountIn > 0, "AMM: invalid amount");
        require(tokenIn == token0 || tokenIn == token1, "AMM: unsupported token");

        uint112 _reserve0 = reserve0;
        uint112 _reserve1 = reserve1;
        require(_reserve0 > 0 && _reserve1 > 0, "AMM: insufficient liquidity");

        bool zeroForOne = tokenIn == token0;
        uint256 reserveIn = zeroForOne ? _reserve0 : _reserve1;
        uint256 reserveOut = zeroForOne ? _reserve1 : _reserve0;

        // Transfer input token from sender
        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);

        // Calculate output amount with 0.3% fee
        // amountOut = (amountIn * 997 / 1000 * reserveOut) / (reserveIn + amountIn * 997 / 1000)
        uint256 amountInWithFee = (amountIn * FEE_NUMERATOR) / FEE_DENOMINATOR;
        amountOut = (amountInWithFee * reserveOut) / (reserveIn + amountInWithFee);
        require(amountOut > 0 && amountOut < reserveOut, "AMM: insufficient output");

        address tokenOut = zeroForOne ? token1 : token0;
        IERC20(tokenOut).transfer(msg.sender, amountOut);

        // Update reserves and validate invariant
        uint256 newReserve0;
        uint256 newReserve1;
        if (zeroForOne) {
            newReserve0 = reserveIn + amountIn;
            newReserve1 = reserveOut - amountOut;
        } else {
            newReserve0 = reserveOut - amountOut;
            newReserve1 = reserveIn + amountIn;
        }

        // Validate constant-product invariant: k_new >= k_old
        require(
            newReserve0 * newReserve1 >= uint256(_reserve0) * uint256(_reserve1),
            "AMM: invariant violation"
        );

        _updateReserves(newReserve0, newReserve1);

        emit SwapExecuted(msg.sender, tokenIn, amountIn, tokenOut, amountOut);
    }

    /**
     * @dev Internal function to update reserves with overflow protection
     * @param newReserve0 New reserve0 value
     * @param newReserve1 New reserve1 value
     */
    function _updateReserves(uint256 newReserve0, uint256 newReserve1) internal {
        require(
            newReserve0 <= type(uint112).max && newReserve1 <= type(uint112).max,
            "AMM: reserve overflow"
        );
        reserve0 = uint112(newReserve0);
        reserve1 = uint112(newReserve1);
    }

    /**
     * @dev Internal function to calculate square root using Babylonian method
     * @param x Input value
     * @return y Square root of x
     */
    function _sqrt(uint256 x) internal pure returns (uint256 y) {
        if (x == 0) {
            return 0;
        }
        uint256 z = (x + 1) / 2;
        y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }
}
