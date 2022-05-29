// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;
import "../ERC677/ERC677.sol";

contract SimpleMockTokenToken is ERC677 {
    constructor(
        string memory name,
        string memory symbol
    ) ERC677(name, symbol) {
        _mint(msg.sender, 100000 ether);
     
    }

    function mint(uint amount) public {
        _mint(msg.sender, amount) ;
    }
}
