// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;
import "../openzeppelin/IERC20.sol";

contract LimboForProxyMock {
  function stakeFor(
    address token,
    uint256 amount,
    address staker
  ) public {
    IERC20(token).transferFrom(msg.sender, address(this), amount);
  }

  function migrate(address token) public {
    uint256 balance = IERC20(token).balanceOf(address(this));
    IERC20(token).transfer(msg.sender, balance);
  }
}
