// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

abstract contract UniPairLike {
    function factory() public virtual view returns (address);
}
