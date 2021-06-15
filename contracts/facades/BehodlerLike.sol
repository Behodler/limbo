// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;

abstract contract BehodlerLike {
    function withdrawLiquidityFindSCX(
        address outputToken,
        uint256 tokensToRelease,
        uint256 scx,
        uint256 passes
    ) external view virtual returns (uint256);

      function burn(uint256 value) external virtual returns (bool);
          function config() public virtual returns (uint, uint, address);

    function transfer(address dest, uint amount) external virtual returns (bool);
}
