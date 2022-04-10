// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

abstract contract MigratorLike {
    function execute(
        address token,
        bool burnable,
        uint256 flanQuoteDivergenceTolerance,
        uint256 minQuoteWaitDuration
    ) public virtual;
}