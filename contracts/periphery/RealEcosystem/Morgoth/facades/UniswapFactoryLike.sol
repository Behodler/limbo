// SPDX-License-Identifier: MIT
pragma solidity ^0.7.1;

abstract contract UniswapFactoryLike {
    function createPair(address tokenA, address tokenB) external virtual;

    function getPair(address tokenA, address tokenB)
        external
        view
        virtual
        returns (address pair);
}
