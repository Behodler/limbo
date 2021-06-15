// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;

abstract contract UniswapHelperLike {
    function buyAndPoolFlan(
        address behodler,
        uint256 divergenceTolerance,
            uint minQuoteWaitDuration, 
        uint256 triangleOfFairness
    ) public virtual returns (uint256 lpMinted);

    function generateFLNQuote() public virtual;
}
