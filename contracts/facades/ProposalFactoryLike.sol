// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

abstract contract ProposalFactoryLike {
     function toggleWhitelistProposal(address proposal) public virtual;
     function soulUpdateProposal () public  virtual view returns (address); 
}