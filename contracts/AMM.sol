// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./Interfaces.sol";
import "./LPToken.sol";

contract AMM {
    address public immutable token0;
    address public immutable token1;

    uint112 public reserve0;
    uint112 public reserve1;

    LPToken public immutable lpToken;

    event LiquidityAdded(
        address indexed provider,
        uint256 amount0,
        uint256 amount1,
        uint256 liquidityMinted
    );

    event LiquidityRemoved(
        address indexed provider,
        uint256 amount0,
        uint256 amount1,
        uint256 liquidityBurned
    );

    event Swap(
        address indexed trader,
        address indexed tokenIn,
        uint256 amountIn,
        address indexed tokenOut,
        uint256 amountOut
    );

    constructor(address _token0, address _token1) {
        require(_token0 != address(0) && _token1 != address(0), "Zero address token");
        require(_token0 != _token1, "Identical tokens");
        token0 = _token0;
        token1 = _token1;
        lpToken = new LPToken("Minimal AMM LP", "MALP", address(this));
    }

    function getReserves() external view returns (uint112, uint112) {
        return (reserve0, reserve1);
    }

    function addLiquidity(uint256 amount0, uint256 amount1) external returns (uint256 liquidity) {
        require(amount0 > 0 && amount1 > 0, "Invalid amounts");

        IERC20(token0).transferFrom(msg.sender, address(this), amount0);
        IERC20(token1).transferFrom(msg.sender, address(this), amount1);

        uint112 _reserve0 = reserve0;
        uint112 _reserve1 = reserve1;

        if (_reserve0 == 0 && _reserve1 == 0) {
            liquidity = _sqrt(amount0 * amount1);
            require(liquidity > 0, "Insufficient initial liquidity");
        } else {
            uint256 totalSupply = lpToken.totalSupply();
            uint256 liquidity0 = (amount0 * totalSupply) / _reserve0;
            uint256 liquidity1 = (amount1 * totalSupply) / _reserve1;
            liquidity = liquidity0 < liquidity1 ? liquidity0 : liquidity1;
            require(liquidity > 0, "Insufficient liquidity minted");
        }

        lpToken.mint(msg.sender, liquidity);

        uint256 newReserve0 = uint256(_reserve0) + amount0;
        uint256 newReserve1 = uint256(_reserve1) + amount1;
        _updateAndValidate(newReserve0, newReserve1, _reserve0, _reserve1, true);

        emit LiquidityAdded(msg.sender, amount0, amount1, liquidity);
    }

    function removeLiquidity(uint256 liquidity)
        external
        returns (uint256 amount0, uint256 amount1)
    {
        require(liquidity > 0, "Zero liquidity");

        uint256 _totalSupply = lpToken.totalSupply();
        require(_totalSupply > 0, "No liquidity");

        amount0 = (liquidity * reserve0) / _totalSupply;
        amount1 = (liquidity * reserve1) / _totalSupply;
        require(amount0 > 0 && amount1 > 0, "Zero amounts");

        lpToken.burn(msg.sender, liquidity);
        IERC20(token0).transfer(msg.sender, amount0);
        IERC20(token1).transfer(msg.sender, amount1);

        uint256 newReserve0 = uint256(reserve0) - amount0;
        uint256 newReserve1 = uint256(reserve1) - amount1;
        _updateAndValidate(newReserve0, newReserve1, reserve0, reserve1, false);

        emit LiquidityRemoved(msg.sender, amount0, amount1, liquidity);
    }

    function swap(address tokenIn, uint256 amountIn) external returns (uint256 amountOut) {
        require(amountIn > 0, "Invalid amount");

        bool zeroForOne;
        if (tokenIn == token0) {
            zeroForOne = true;
        } else if (tokenIn == token1) {
            zeroForOne = false;
        } else {
            revert("Unsupported token");
        }

        uint112 _reserve0 = reserve0;
        uint112 _reserve1 = reserve1;
        require(_reserve0 > 0 && _reserve1 > 0, "Insufficient liquidity");

        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);

        uint256 reserveIn = zeroForOne ? _reserve0 : _reserve1;
        uint256 reserveOut = zeroForOne ? _reserve1 : _reserve0;

        amountOut = (amountIn * reserveOut) / (reserveIn + amountIn);
        require(amountOut > 0 && amountOut < reserveOut, "Insufficient output");

        address tokenOut = zeroForOne ? token1 : token0;
        IERC20(tokenOut).transfer(msg.sender, amountOut);

        uint256 newReserveIn = reserveIn + amountIn;
        uint256 newReserveOut = reserveOut - amountOut;
        uint256 newReserve0 = zeroForOne ? newReserveIn : newReserveOut;
        uint256 newReserve1 = zeroForOne ? newReserveOut : newReserveIn;

        _updateAndValidate(newReserve0, newReserve1, _reserve0, _reserve1, true);

        emit Swap(msg.sender, tokenIn, amountIn, tokenOut, amountOut);
    }

    function _updateAndValidate(
        uint256 newReserve0,
        uint256 newReserve1,
        uint112 oldReserve0,
        uint112 oldReserve1,
        bool enforceInvariant
    ) internal {
        require(newReserve0 <= type(uint112).max && newReserve1 <= type(uint112).max, "Overflow");
        if (enforceInvariant) {
            require(
                newReserve0 * newReserve1 >= uint256(oldReserve0) * uint256(oldReserve1),
                "Invariant violation"
            );
        }
        _updateReserves(uint112(newReserve0), uint112(newReserve1));
    }

    function _updateReserves(uint112 newReserve0, uint112 newReserve1) internal {
        reserve0 = newReserve0;
        reserve1 = newReserve1;
    }

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

