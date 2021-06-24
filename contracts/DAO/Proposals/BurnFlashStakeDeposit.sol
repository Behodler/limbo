// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "../ProposalFactory.sol";
import "../../facades/LimboLike.sol";

contract BurnFlashStakeDeposit is Proposal {
    struct Parameters {
        address user;
        address asset;
        uint256 amount;
        address limbo;
    }

    Parameters public params;

    constructor(address dao, string memory _description)
        Proposal(dao, description)
    {}

    function parameterize(
        address user,
        address asset,
        uint256 amount,
        address limbo
    ) public notCurrent {
        params.user = user;
        params.asset = asset;
        params.amount = amount;
        params.limbo = limbo;
    }

    function execute() internal override returns (bool) {
        LimboLike(params.limbo).burnFlashGovernanceAsset(
            params.user,
            params.asset,
            params.amount
        );

        return true;
    }
}
