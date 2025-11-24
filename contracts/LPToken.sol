// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title LPToken
 * @dev ERC20 token representing liquidity provider shares in the AMM pool
 * @notice Only the AMM contract can mint and burn LP tokens
 */
contract LPToken is ERC20 {
    address public immutable amm;

    /**
     * @dev Constructor that sets the token name, symbol, and AMM address
     * @param _name Token name
     * @param _symbol Token symbol
     * @param _amm Address of the AMM contract that controls minting/burning
     */
    constructor(
        string memory _name,
        string memory _symbol,
        address _amm
    ) ERC20(_name, _symbol) {
        require(_amm != address(0), "LPToken: zero AMM address");
        amm = _amm;
    }

    /**
     * @dev Modifier to restrict functions to only the AMM contract
     */
    modifier onlyAMM() {
        require(msg.sender == amm, "LPToken: only AMM");
        _;
    }

    /**
     * @dev Mints LP tokens to a recipient (only callable by AMM)
     * @param to Address to receive the minted tokens
     * @param amount Amount of LP tokens to mint
     */
    function mint(address to, uint256 amount) external onlyAMM {
        require(amount > 0, "LPToken: zero mint amount");
        _mint(to, amount);
    }

    /**
     * @dev Burns LP tokens from a sender (only callable by AMM)
     * @param from Address to burn tokens from
     * @param amount Amount of LP tokens to burn
     */
    function burn(address from, uint256 amount) external onlyAMM {
        require(balanceOf(from) >= amount, "LPToken: burn amount exceeds balance");
        _burn(from, amount);
    }
}
