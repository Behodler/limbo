// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

abstract contract LimboLike {
    function burnFlashGovernanceAsset(
        address user,
        address asset,
        uint256 amount
    ) public virtual;

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
}
