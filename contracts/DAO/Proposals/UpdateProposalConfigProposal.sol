// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "../ProposalFactory.sol";

contract UpdateProposalConfigProposal is Proposal {

    constructor(address dao, bytes32 _description) Proposal(dao,description) {
    }

    function parameterize (uint256 votingDuration,
        uint256 requiredFateStake,
        address proposalFactory) public {
        }

//TODO: worry about user invoking parameterize after proposal approved.
//Some way of sealing it

    function execute() internal override returns (bool) {

    }
}
/*
  function setProposalConfig(
      ci
        uint256 votingDuration,
        uint256 requiredFateStake,
        address proposalFactory
    ) public onlySuccessfulProposal {
        proposalConfig.votingDuration = votingDuration;
        proposalConfig.requiredFateStake = requiredFateStake;
        proposalConfig.proposalFactory = proposalFactory;
    }
*/