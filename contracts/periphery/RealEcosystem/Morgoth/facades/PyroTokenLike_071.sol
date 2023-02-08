// SPDX-License-Identifier: MIT
pragma solidity ^0.7.1;
import "../openzeppelin/IERC20.sol";

abstract contract PyroTokenLike_071 is IERC20_071 {
    function mint(uint256 baseTokenAmount) external virtual returns (uint256);

    function baseToken() public virtual returns (address);
}
