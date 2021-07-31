// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

abstract contract AMMHelper {
    function priceTiltFlan(
        uint256 rectangleOfFairness
    ) public virtual returns (uint256 lpMinted);

    function generateFLNQuote() public virtual;

    function minAPY_to_FPS(uint minAPY, uint daiThreshold) public virtual view returns (uint fps);
}
