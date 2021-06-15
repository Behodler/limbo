// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;

abstract contract LimboDAOLike {
    function approveFlanMintingPower(address minter, bool enabled)
        public
        virtual;

    function makeProposal(address proposal, address proposer) public virtual;

    function currentProposal() public view virtual returns (address);

    function setProposalConfig(
        uint256 votingDuration,
        uint256 requiredFateStake,
        address proposalFactory
    ) public virtual;

    function setApprovedAsset(address asset, bool approved) public virtual;

     function successfulProposal (address proposal) public virtual view returns (bool) ;

}
