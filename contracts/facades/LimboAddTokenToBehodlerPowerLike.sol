// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

abstract contract LimboAddTokenToBehodlerPowerLike {
    struct Parameters {
        address soul;
        bool burnable;
        address limbo;
        address tokenProxyRegistry;
    }

    Parameters public params;

    function parameterize(address soul, bool burnable) public virtual;
}