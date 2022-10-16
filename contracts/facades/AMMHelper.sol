// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

abstract contract AMMHelper {
    function stabilizeFlan(uint mintedSCX)
        public
        virtual
        returns (uint256 lpMinted);

    function minAPY_to_FPS(uint256 minAPY, uint256 daiThreshold)
        public
        pure
        virtual
        returns (uint256 fps);
}
