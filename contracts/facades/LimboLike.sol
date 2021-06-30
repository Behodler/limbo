// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

abstract contract LimboLike {
    function latestIndex(address) public view virtual returns (uint256);

    function souls(address, uint256)
        public
        view
        virtual
        returns (
            uint256,
            uint256,
            uint256,
            uint256,
            uint256,
            uint256,
            uint16
        );

    function tokenCrossingParameters(address, uint256)
        public
        view
        virtual
        returns (
            uint256,
            uint256,
            int256,
            uint256,
            bool
        );
}
