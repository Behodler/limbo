// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;
import "../facades/FlanLike.sol";

contract FlanMinter {
  FlanLike flan;

  constructor(address _flan) {
    flan = FlanLike(_flan);
  }

  function mintAlot(uint256 etherUnits) public {
    flan.mint(msg.sender, etherUnits * 10**18);
  }
}
