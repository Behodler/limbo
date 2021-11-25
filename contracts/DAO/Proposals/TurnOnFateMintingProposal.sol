// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;
import "../ProposalFactory.sol";
import "../../facades/FlashGovernanceArbiterLike.sol";
import "../../facades/LimboDAOLike.sol";

contract TurnOnFateMintingProposal is Proposal {
    constructor(address dao, string memory _description)
        Proposal(dao, description)
    {}

    uint256 rate;

    function parameterize(uint256 _rate) public notCurrent {
        rate = _rate;
    }

    function execute() internal override returns (bool) {
        DAO.setFateToFlan(rate);
        return true;
    }
}
