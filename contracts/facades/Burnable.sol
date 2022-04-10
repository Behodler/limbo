// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

abstract contract Burnable {
    function burn (uint amount) public virtual;
}
