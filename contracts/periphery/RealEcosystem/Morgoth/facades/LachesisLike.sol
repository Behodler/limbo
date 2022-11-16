// SPDX-License-Identifier: MIT
pragma solidity ^0.7.1;

abstract contract Lachesis_071Like {
    function measure(
        address token,
        bool valid,
        bool burnable
    ) public virtual;

    function updateBehodler(address token) public virtual;

    function setBehodler(address b) public virtual;
}
