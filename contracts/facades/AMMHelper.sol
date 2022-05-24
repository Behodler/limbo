// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

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

    function buyFlanAndBurn(
        address inputToken,
        uint256 amount,
        address recipient
    ) public virtual;
}
