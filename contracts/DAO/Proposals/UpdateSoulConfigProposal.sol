// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "../ProposalFactory.sol";
import "../../facades/LimboLike.sol";

contract UpdateSoulConfigProposal is Proposal {
    struct Parameters {
        address token;
        uint256 allocPoint;
        uint256 crossingThreshold;
        uint256 soulType;
        uint256 state;
        uint16 exitPenalty;
        uint256 index;
    }
    Parameters params;
    LimboLike limbo;

    constructor(
        address dao,
        string memory _description,
        address _limbo
    ) Proposal(dao, _description) {
        limbo = LimboLike(_limbo);
    }

    function parameterize(
        address token,
        uint256 allocPoint,
        uint256 crossingThreshold,
        uint256 soulType,
        uint256 state,
        uint16 exitPenalty,
        uint256 index
    ) public notCurrent {
        params.token = token;
        params.allocPoint = allocPoint;
        params.crossingThreshold = crossingThreshold;
        params.soulType = soulType;
        params.state = state;
        params.exitPenalty = exitPenalty;
        params.index = index;
    }

    function execute() internal override returns (bool) {
        limbo.configureSoul(
            params.token,
            params.allocPoint,
            params.crossingThreshold,
            params.soulType,
            params.exitPenalty,
            params.state,
            params.index
        );

        return true;
    }
}
