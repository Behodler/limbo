// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

abstract contract AngbandLike {
  function executePower(address powerInvoker) public virtual;

  function getAddress(bytes32 _key) public view virtual returns (address);

  bytes32 public constant POWERREGISTRY = "POWERREGISTRY";

  function setBehodler(address behodler, address lachesis) public virtual;
}
