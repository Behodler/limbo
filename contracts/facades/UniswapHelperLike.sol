// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;

abstract contract UniswapHelperLike {
    function buyAndPoolFlan(
        uint256 divergenceTolerance,
        uint256 minQuoteWaitDuration,
        uint256 triangleOfFairness
    ) public virtual returns (uint256 lpMinted);

    function generateFLNQuote() public virtual;
}
