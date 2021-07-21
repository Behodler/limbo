// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

abstract contract AMMHelper {
    function buyAndPoolFlan(
        uint256 divergenceTolerance,
        uint256 minQuoteWaitDuration,
        uint256 rectangleOfFairness
    ) public virtual returns (uint256 lpMinted);

    function generateFLNQuote() public virtual;
}
