// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

abstract contract BehodlerLike {
  function withdrawLiquidityFindSCX(
    address outputToken,
    uint256 tokensToRelease,
    uint256 scx,
    uint256 passes
  ) external view virtual returns (uint256);

  function burn(uint256 value) public virtual returns (bool);

  function config()
    public
    view
    virtual
    returns (
      uint256,
      uint256,
      address
    );

  function transfer(address dest, uint256 amount) external virtual returns (bool);

  function totalSupply() external virtual returns (uint256);

  function swap(
    address inputToken,
    address outputToken,
    uint256 inputAmount,
    uint256 outputAmount
  ) external payable virtual returns (bool success);

  function addLiquidity(address inputToken, uint256 amount) external payable virtual returns (uint256 deltaSCX);

  function withdrawLiquidity(address outputToken, uint256 tokensToRelease)
    external
    payable
    virtual
    returns (uint256 deltaSCX);
}
