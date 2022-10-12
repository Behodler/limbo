// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

abstract contract SwapFactoryLike {
    mapping(address => mapping(address => address)) public getPair;
}
