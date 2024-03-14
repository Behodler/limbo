// SPDX-License-Identifier: MIT
pragma solidity ^0.7.1;
abstract contract TokenProxyBaseLike_071 {
  bool public constant IS_PROXY = true;
  function baseToken() public view virtual returns (address);
}