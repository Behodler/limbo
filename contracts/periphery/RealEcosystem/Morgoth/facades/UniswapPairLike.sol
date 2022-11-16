// SPDX-License-Identifier: MIT
pragma solidity ^0.7.1;

abstract contract UniswapPairLike {
function mint(address to) external virtual returns (uint256 liquidity);
} 