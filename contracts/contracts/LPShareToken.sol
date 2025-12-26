// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title LPShareToken
 * @notice ERC20 token representing LP shares in the TIFA Financing Pool
 * @dev LP shares represent proportional ownership of pool NAV
 *      Only the FinancingPool contract can mint/burn these tokens
 */
contract LPShareToken is ERC20, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");

    constructor() ERC20("TIFA Pool LP", "TIFA-LP") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(BURNER_ROLE, msg.sender);
    }

    /**
     * @notice Mint LP shares (only callable by FinancingPool)
     * @param to Address to receive LP shares
     * @param amount Amount of LP shares to mint
     */
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }

    /**
     * @notice Burn LP shares (only callable by FinancingPool)
     * @param from Address to burn LP shares from
     * @param amount Amount of LP shares to burn
     */
    function burn(address from, uint256 amount) external onlyRole(BURNER_ROLE) {
        _burn(from, amount);
    }

    /**
     * @notice Grant minter/burner role to FinancingPool contract
     * @param pool Address of FinancingPool contract
     */
    function grantPoolRoles(address pool) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(MINTER_ROLE, pool);
        _grantRole(BURNER_ROLE, pool);
    }
}




