// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;

abstract contract SwapFactoryLike {
    mapping(address => mapping(address => address)) public getPair;
}
