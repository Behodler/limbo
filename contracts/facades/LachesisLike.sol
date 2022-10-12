// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

abstract contract LachesisLike {
  function cut(address token) public view virtual returns (bool, bool);

  function measure(
    address token,
    bool valid,
    bool burnable
  ) public virtual;

  function updateBehodler(address token) public virtual;

  function setBehodler(address b) public virtual;
}
