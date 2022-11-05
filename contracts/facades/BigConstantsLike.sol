// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

abstract contract BigConstantsLike {
    function deployRebaseWrapper(address pyroTokenAddress)
        external
        virtual
        returns (address);

    function PYROTOKEN_BYTECODE() public virtual view returns (bytes memory);
}
