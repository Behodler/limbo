// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

abstract contract ProposalFactoryLike {
     function toggleWhitelistProposal(address proposal) public virtual;
}