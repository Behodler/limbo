// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;

abstract contract UniPairLike {
    function factory() public virtual view returns (address);
}
