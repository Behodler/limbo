// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;

interface IERC677Receiver {
  function onTokenTransfer(address _sender, uint _value, bytes memory  _data) external;
}