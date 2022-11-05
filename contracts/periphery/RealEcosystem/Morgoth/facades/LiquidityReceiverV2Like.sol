// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

abstract contract LiquidityReceiverV2Like {
  mapping(address => address) public baseTokenMapping;

  function setLachesis(address _lachesis) public virtual;

  function registerPyroToken(address baseToken) public virtual;

  function drain(address pyroToken) public virtual;
}
