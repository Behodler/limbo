// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

abstract contract LimboLike {
  function latestIndex(address) public view virtual returns (uint256);

  function souls(address, uint256)
    public
    view
    virtual
    returns (
      uint256, //lastRewardTimeStamp
      uint256, //accumulatedFlanPerShare
      uint256, //crossingThreshold
      uint256, //soulType
      uint256, //state
      uint256 //flanPerSecond
    );

  function tokenCrossingParameters(address, uint256)
    public
    view
    virtual
    returns (
      uint256,
      uint256,
      int256,
      uint256,
      bool
    );

  function userInfo(
    address,
    address,
    uint256
  )
    public
    view
    virtual
    returns (
      uint256,
      uint256,
      bool
    );

  function configureSoul(
    address token,
    uint256 crossingThreshold,
    uint256 soulType,
    uint256 state,
    uint256 index,
    uint256 fps
  ) public virtual;

  function withdrawERC20(address token, address destination) public virtual;

  function userTokenBalance(address token) public virtual returns (uint256);

  function stake(address token, uint256 amount) public virtual;

  function stakeFor(
    address token,
    uint256 amount,
    address recipient
  ) public virtual;

  function unstake(address token, uint256 amount) public virtual;

  function unstakeFor(
    address token,
    uint256 amount,
    address holder
  ) public virtual;

  function claimSecondaryRewards(address token) public virtual;
}
