// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "../ProposalFactory.sol";

contract SetAssetApprovalProposal is Proposal {
    struct Parameters {
        address asset;
        bool approved;
    }

    Parameters public params;

    constructor(address dao, string memory _description)
        Proposal(dao, description)
    {}

    function parameterize(address asset, bool approved) public notCurrent {
        params.asset = asset;
        params.approved = approved;
    }

    function execute() internal override returns (bool) {
        DAO.setApprovedAsset(params.asset, params.approved);
        return true;
    }
}
