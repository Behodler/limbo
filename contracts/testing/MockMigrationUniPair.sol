// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "../facades/UniPairLike.sol";
import "../ERC677/ERC20Burnable.sol";

contract MockMigrationUniPair is UniPairLike, ERC20Burnable {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}

    function factory() public view override returns (address) {
        return address(this);
    }

    uint112 reserve0;
    uint112 reserve1;

    function setReserves(uint112 r0, uint112 r1) public {
        reserve0 = r0;
        reserve1 = r1;
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
        return (reserve0, reserve1, uint32(block.timestamp));
    }

    function mint(address to) external override returns (uint256 liquidity) {
        uint256 val = (reserve0 * reserve1) / (reserve0 + reserve1);
        _mint(to, val);
        return val;
    }

    function swap(uint amount0Out, uint amount1Out, address to, bytes calldata data) external override {

    }
}
