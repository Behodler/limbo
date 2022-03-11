// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;
import "./LimboAddTokenToBehodlerPower.sol";
import "hardhat/console.sol";

contract Angband {
  function executePower(address invoker) public {
    console.log("about to execute power");
    LimboAddTokenToBehodlerTestNet(invoker).invoke("test", msg.sender);
  }
}
