// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;
import "../ProposalFactory.sol";
import "../../facades/LimboLike.sol";
import "../../facades/AMMHelper.sol";
import "../../facades/MorgothTokenApproverLike.sol";
import "../../periphery/Errors.sol";

/**
 * @author Justin Goro
 * @notice For adding a list of new souls to Limbo for staking
 */
contract UpdateMultipleSoulConfigProposal is Proposal {
  struct Parameters {
    address token;
    uint256 soulType;
    uint256 state;
    uint256 index;
    uint256 targetAPY;
    uint256 daiThreshold;
    uint256 crossingThreshold;
    uint256 initialCrossingBonus;
    int256 crossingBonusDelta;
    bool burnable;
  }

  Parameters[] params;
  LimboLike limbo;
  AMMHelper ammHelper;
  MorgothTokenApproverLike morgothApprover;

  constructor(
    address dao,
    string memory _description,
    address _limbo,
    address _ammHelper,
    address morgothTokenApprover
  ) Proposal(dao, _description) {
    limbo = LimboLike(_limbo);
    ammHelper = AMMHelper(_ammHelper);
    morgothApprover = MorgothTokenApproverLike(morgothTokenApprover);
  }

  function parameterize(
    address token,
    uint256 crossingThreshold,
    uint256 soulType,
    uint256 state,
    uint256 index,
    uint256 targetAPY,
    uint256 daiThreshold,
    uint256 initialCrossingBonus,
    int256 crossingBonusDelta,
    bool burnable
  ) public {
    if (soulType < 2 && !morgothApprover.approved(token)) {
      revert TokenNotApproved(token);
    }
    params.push(
      Parameters({
        token: token,
        crossingThreshold: crossingThreshold,
        soulType: soulType,
        state: state,
        index: index,
        targetAPY: targetAPY,
        daiThreshold: daiThreshold,
        initialCrossingBonus:initialCrossingBonus,
        crossingBonusDelta:crossingBonusDelta,
        burnable:burnable
      })
    );
  }

  //for safe lodging
  function lockDown() public lockUntilComplete {}

  function execute() internal override returns (bool) {
    Parameters[] memory localParams = params;
    for (uint256 i = 0; i < localParams.length; i++) {
      //second check to catch any blacklisted cliffFace tokens.
      if (localParams[i].soulType < 2 && !morgothApprover.approved(localParams[i].token)) {
        revert TokenNotApproved(localParams[i].token);
      }
      uint256 fps = ammHelper.minAPY_to_FPS(localParams[i].targetAPY, localParams[i].daiThreshold);
      limbo.configureSoul(
        localParams[i].token,
        localParams[i].crossingThreshold,
        localParams[i].soulType,
        localParams[i].state,
        localParams[i].index,
        fps
      );

      limbo.configureCrossingParameters(
        localParams[i].token,
        localParams[i].initialCrossingBonus,
        localParams[i].crossingBonusDelta,
        localParams[i].burnable,
        localParams[i].crossingThreshold
      );
    }
    return true;
  }
}
