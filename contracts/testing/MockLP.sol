// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;
import "../facades/UniPairLike.sol";
import "../ERC677/ERC677.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockLP is UniPairLike, ERC677 {
    address t1;
    address t2;

    constructor(
        string memory name,
        string memory symbol,
        address token1,
        address token2
    ) ERC677(name, symbol) {
        t1 = token1;
        t2 = token2;
    }

    function getReserves()
        public
        view
        override
        returns (
            uint112 _reserve0,
            uint112 _reserve1,
            uint32 _blockTimestampLast
        )
    {
        uint256 balance1 = IERC20(t1).balanceOf(address(this));
        uint256 balance2 = IERC20(t2).balanceOf(address(this));
        return (uint112(balance1), uint112(balance2), 2000000);
    }

    function mint(address to) external override returns (uint256 liquidity) {
        _mint(msg.sender, 10000);
    }

        function factory() public view override returns (address){
            return address(0xE83CCCfABD4eD148903Bf36d4283eE7C8b3494D1);
        }

}
