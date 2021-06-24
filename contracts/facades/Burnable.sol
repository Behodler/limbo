// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;


abstract contract Burnable {
    function burn (uint amount) public virtual;
}
