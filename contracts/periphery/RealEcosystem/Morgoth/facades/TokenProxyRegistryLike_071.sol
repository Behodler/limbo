// SPDX-License-Identifier: MIT
pragma solidity 0.7.1;

abstract contract TokenProxyRegistryLike_071 {
  function setProxy(
    address baseToken,
    address limboProxy,
    address behodlerProxy
  ) public virtual returns (bool ownershipClaimed);

    struct TokenConfig {
    address limboProxy;
    address behodlerProxy;
  }

  function tokenProxy(address baseToken) public virtual returns (address, address);

  function TransferFromLimboTokenToBehodlerToken(address token) public virtual returns (bool);
}
