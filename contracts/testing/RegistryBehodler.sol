// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;
import "../openzeppelin/IERC20.sol";

contract RegistryBehodler {
  mapping(address => uint256) balances;

  function addLiquidity(address token, uint256 amount) public returns (uint256) {
    balances[msg.sender] = amount / 10;
    IERC20(token).transferFrom(msg.sender, address(this), amount);
    return amount / 10;
  }

  function transfer(address to, uint256 amount) public returns (bool) {
    balances[msg.sender] -= amount;
    balances[to] += (amount * 98) / 100;
    return true;
  }

  function balanceOf(address holder) public view returns (uint256) {
    return balances[holder];
  }
}
