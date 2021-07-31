// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "../ProposalFactory.sol";
import "../../facades/LimboLike.sol";

contract UpdateSoulConfigProposal is Proposal {
    struct Parameters {
        address token;
        uint256 crossingThreshold;
        uint256 soulType;
        uint256 state;
        uint16 exitPenalty;
        uint256 index;
        uint256 fps;
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
        uint256 crossingThreshold,
        uint256 soulType,
        uint256 state,
        uint16 exitPenalty,
        uint256 index,
        uint256 fps
    ) public notCurrent {
        params.token = token;
        params.crossingThreshold = crossingThreshold;
        params.soulType = soulType;
        params.state = state;
        params.exitPenalty = exitPenalty;
        params.index = index;
        params.fps = fps;
    }

    function execute() internal override returns (bool) {
        limbo.configureSoul(
            params.token,
            params.crossingThreshold,
            params.soulType,
            params.exitPenalty,
            params.state,
            params.index,
            params.fps
        );

        return true;
    }
}
