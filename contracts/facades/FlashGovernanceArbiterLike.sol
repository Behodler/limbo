// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

abstract contract FlashGovernanceArbiterLike {
    function assertGovernanceApproved(address sender, address target)
        public
        virtual;

    function enforceToleranceInt(int256 v1, int256 v2) public view virtual;

    function enforceTolerance(uint256 v1, uint256 v2) public view virtual;
}
