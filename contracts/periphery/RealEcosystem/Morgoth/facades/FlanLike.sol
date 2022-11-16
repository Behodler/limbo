// SPDX-License-Identifier: MIT
pragma solidity ^0.7.1;
import "../openzeppelin/IERC20.sol";

abstract contract Flan_071Like is IERC20_071 {
    function mint(address _to, uint256 _amount)
        public
        virtual
        returns (bool success);

    function burn(uint256 _amount) public virtual returns (bool success);
}
