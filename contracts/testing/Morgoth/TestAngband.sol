// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;
import "./LimboAddTokenToBehodlerPower.sol";

contract TestAngband {
  function executePower(address invoker) public {
    LimboAddTokenToBehodlerTestNet(invoker).invoke("test", msg.sender);
  }
}
