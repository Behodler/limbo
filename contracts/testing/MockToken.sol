// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;
import "../openzeppelin/ERC677.sol";

contract MockToken is ERC677 {
  constructor(
    string memory name,
    string memory symbol,
    address[] memory LPs,
    uint256[] memory mintVal
  ) ERC677(name, symbol) {
    _mint(msg.sender, 10000 ether);
    uint256 deceth = (1 ether) / 10;
    require(LPs.length == mintVal.length, "CONSTRUCTION MISMATCH");
    for (uint256 i = 0; i < LPs.length; i++) {
      _mint(LPs[i], mintVal[i] * deceth);
    }
  }

  function mint(uint256 amount) public {
    _mint(msg.sender, amount);
  }

  //open ended unsecure burning
  function burnFrom(address account, uint256 amount) public override {
    _burn(account, amount);
  }
}
