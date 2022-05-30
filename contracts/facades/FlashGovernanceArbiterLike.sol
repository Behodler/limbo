// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

abstract contract FlashGovernanceArbiterLike {
    function assertGovernanceApproved(address sender, address target, bool emergency)
        public
        virtual;

    function enforceToleranceInt(int256 v1, int256 v2) public view virtual;

    function enforceTolerance(uint256 v1, uint256 v2) public view virtual;

    function burnFlashGovernanceAsset(
        address targetContract,
        address user,
        address asset,
        uint256 amount
    ) public virtual;

     function setEnforcement(bool enforce) public virtual;

     function setGoverned(address[] calldata governables, bool[] calldata isGoverned) external virtual;
}
