// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

abstract contract SwapFactoryLike {
    mapping(address => mapping(address => address)) public getPair;
}
