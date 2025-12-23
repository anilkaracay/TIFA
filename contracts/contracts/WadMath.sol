// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title WadMath
 * @notice Fixed-point arithmetic using WAD (1e18) precision
 */
library WadMath {
    uint256 public constant WAD = 1e18;
    uint256 public constant SECONDS_PER_YEAR = 365 days; // 31,536,000 seconds

    /**
     * @notice Multiply two WAD values
     * @param a First value (WAD)
     * @param b Second value (WAD)
     * @return result (a * b) / WAD
     */
    function wadMul(uint256 a, uint256 b) internal pure returns (uint256) {
        return (a * b) / WAD;
    }

    /**
     * @notice Divide two WAD values
     * @param a Numerator (WAD)
     * @param b Denominator (WAD)
     * @return result (a * WAD) / b
     */
    function wadDiv(uint256 a, uint256 b) internal pure returns (uint256) {
        return (a * WAD) / b;
    }

    /**
     * @notice Multiply by basis points
     * @param amount Amount to multiply
     * @param bps Basis points (e.g., 1000 = 10%)
     * @return result (amount * bps) / 10000
     */
    function bpsMul(uint256 amount, uint256 bps) internal pure returns (uint256) {
        return (amount * bps) / 10000;
    }

    /**
     * @notice Convert WAD to normal units
     * @param wadValue Value in WAD
     * @return Normal units
     */
    function fromWad(uint256 wadValue) internal pure returns (uint256) {
        return wadValue / WAD;
    }

    /**
     * @notice Convert normal units to WAD
     * @param value Normal units
     * @return WAD value
     */
    function toWad(uint256 value) internal pure returns (uint256) {
        return value * WAD;
    }
}

