// SPDX-License-Identifier: MIT
pragma solidity ^0.7.1;

abstract contract LiquidityReceiverNewLike {
    /**
     *@notice deploys a new pyroToken contract
     *@param baseToken is the BehodlerListed token
     *@param name extended ERC20 name
     *@param symbol extended ERC20 symbol.
     */
    function registerPyroToken(
        address baseToken,
        string memory name,
        string memory symbol,
        uint8 decimals
    ) public virtual;
}