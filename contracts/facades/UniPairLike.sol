// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;

abstract contract UniPairLike {
    function factory() public view virtual returns (address);

    function getReserves()
        public
        view
        virtual
        returns (
            uint112 _reserve0,
            uint112 _reserve1,
            uint32 _blockTimestampLast
        );

    function mint(address to) external virtual returns (uint256 liquidity);
}
