// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

abstract contract AMMHelper {
    function stabilizeFlan(uint mintedSCX)
        public
        virtual
        returns (uint256 lpMinted);
}
