// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

library RedeemableMaths {
  uint256 public constant ONE = 1e18;

  function toProxy(uint256 baseAmount, uint256 _redeemRate) internal pure returns (uint256) {
    return (baseAmount * ONE) / _redeemRate;
  }

  function toBase(uint256 proxyAmount, uint256 _redeemRate) internal pure returns (uint256) {
    return (proxyAmount * _redeemRate) / ONE;
  }
}