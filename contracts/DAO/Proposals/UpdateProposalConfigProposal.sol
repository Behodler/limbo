// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "../ProposalFactory.sol";

contract UpdateProposalConfigProposal is Proposal {
    struct Parameters {
        uint256 votingDuration;
        uint256 requiredFateStake;
        address proposalFactory;
    }

    Parameters public params;

    constructor(address dao, string memory _description)
        Proposal(dao, _description)
    {}

    function parameterize(
        uint256 votingDuration,
        uint256 requiredFateStake,
        address proposalFactory
    ) public notCurrent {
        params.proposalFactory = proposalFactory;
        params.requiredFateStake = requiredFateStake;
        params.votingDuration = votingDuration;
    }

    function execute() internal override returns (bool) {
        DAO.setProposalConfig(
            params.votingDuration,
            params.requiredFateStake,
            params.proposalFactory
        );
        return true;
    }
}
