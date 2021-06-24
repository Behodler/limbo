// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

abstract contract LimboLike {
    function burnFlashGovernanceAsset(
        address user,
        address asset,
        uint256 amount
    ) public virtual;
}
