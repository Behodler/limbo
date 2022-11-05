// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;
import "../openzeppelin/IERC20.sol";

abstract contract Burnable is IERC20{
  function burn(uint256 amount) public virtual;

  function symbol() public pure virtual returns (string memory);

  function burn(address holder, uint256 amount) public virtual;
}
