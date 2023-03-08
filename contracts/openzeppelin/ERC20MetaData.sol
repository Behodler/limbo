// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

interface ERC20Meta {
  function name() external view returns (string memory);

  function symbol() external view returns (string memory);
}