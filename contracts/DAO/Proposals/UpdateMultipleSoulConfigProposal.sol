// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "../ProposalFactory.sol";
import "../../facades/LimboLike.sol";
import "../../facades/AMMHelper.sol";

contract UpdateMultipleSoulConfigProposal is Proposal {
    struct Parameters {
        address token;
        uint256 crossingThreshold;
        uint256 soulType;
        uint256 state;
        uint16 exitPenalty;
        uint256 index;
        uint256 targetAPY;
        uint256 daiThreshold;
    }

    Parameters[] params;
    LimboLike limbo;
    AMMHelper ammHelper;

    constructor(
        address dao,
        string memory _description,
        address _limbo,
        address _ammHelper
    ) Proposal(dao, _description) {
        limbo = LimboLike(_limbo);
        ammHelper = AMMHelper(_ammHelper);
    }

    function parameterize(
        address token,
        uint256 crossingThreshold,
        uint256 soulType,
        uint256 state,
        uint16 exitPenalty,
        uint256 index,
        uint256 targetAPY,
        uint256 daiThreshold
    ) public notCurrent {
        params.push(
            Parameters({
                token: token,
                crossingThreshold: crossingThreshold,
                soulType: soulType,
                state: state,
                exitPenalty: exitPenalty,
                index: index,
                targetAPY: targetAPY,
                daiThreshold: daiThreshold
            })
        );
    }

    function execute() internal override returns (bool) {
        for (uint256 i = 0; i < params.length; i++) {
            uint256 fps = ammHelper.minAPY_to_FPS(
                params[i].targetAPY,
                params[i].daiThreshold
            );
            limbo.configureSoul(
                params[i].token,
                params[i].crossingThreshold,
                params[i].soulType,
                params[i].exitPenalty,
                params[i].state,
                params[i].index,
                fps
            );
        }

        return true;
    }
}
