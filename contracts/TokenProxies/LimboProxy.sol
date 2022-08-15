// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;
import "./TokenProxyBase.sol";
//TODO: remove FOT logic from Limbo
///@author Justin Goro 
///@title Limbo Token Proxy
///@dev normalizes the behaviour of FOT and rebase tokens so that Limbo can focus on logic
contract LimboProxy is TokenProxyBase {
  constructor(
    address _baseToken,
    string memory name_,
    string memory symbol_,
    address registry
  ) TokenProxyBase(_baseToken,name_, symbol_,registry) {}

  function stake() public{
    
  }

  function unstake() public{

  }


}