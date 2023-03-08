// SPDX-License-Identifier: MIT
pragma solidity ^0.7.1;

abstract contract LiquidityReceiver_071Like {
    function baseTokenMapping(address baseToken)
        public
        view
        virtual
        returns (address);

    function registerPyroToken(address baseToken) public virtual;
}
