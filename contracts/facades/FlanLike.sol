// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

abstract contract FlanLike is IERC20 {
    function mint(uint256 amount) public virtual;

    function mint(address recipient, uint256 amount) public virtual;
}
