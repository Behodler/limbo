// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;
import "../ProposalFactory.sol";
import "../../facades/LimboLike.sol";
import "../../facades/AMMHelper.sol";
import "../../facades/MorgothTokenApproverLike.sol";
import "../../periphery/Errors.sol";
import "../../facades/TokenProxyRegistryLike.sol";

/**
 * @author Justin Goro
 * @notice For adding a list of new souls to Limbo for staking
 */
contract UpdateMultipleSoulConfigProposal is Proposal {
  uint256 constant YEAR = 31536000; // seconds in 365 day year

  struct Parameters {
    address baseToken;
    address limboProxy;
    address behodlerProxy;
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

  struct Config {
    LimboLike limbo;
    MorgothTokenApproverLike morgothApprover;
    TokenProxyRegistryLike proxyRegistry;
  }

  Config public config;
  Parameters[] public params;

  constructor(
    address dao,
    string memory _description,
    address _limbo,
    address morgothTokenApprover,
    address tokenProxyRegistry
  ) Proposal(dao, _description) {
    config.limbo = LimboLike(_limbo);
    config.morgothApprover = MorgothTokenApproverLike(morgothTokenApprover);
    config.proxyRegistry = TokenProxyRegistryLike(tokenProxyRegistry);
  }

  function setProxy(address limboProxy, address behodlerProxy, uint256 paramIndex) public unlocked {
    params[paramIndex].limboProxy = limboProxy;
    params[paramIndex].behodlerProxy = behodlerProxy;
  }

  function parameterize(
    address baseToken,
    uint256 crossingThreshold,
    uint256 soulType,
    uint256 state,
    uint256 index,
    uint256 targetAPY,
    uint256 daiThreshold,
    uint256 initialCrossingBonus,
    int256 crossingBonusDelta,
    bool burnable
  ) public unlocked {
    if (soulType < 2 && !config.morgothApprover.approved(baseToken)) {
      revert TokenNotApproved(baseToken);
    }
    params.push(
      Parameters({
        baseToken: baseToken,
        limboProxy: baseToken,
        behodlerProxy: baseToken,
        crossingThreshold: crossingThreshold,
        soulType: soulType,
        state: state,
        index: index,
        targetAPY: targetAPY,
        daiThreshold: daiThreshold,
        initialCrossingBonus: initialCrossingBonus,
        crossingBonusDelta: crossingBonusDelta,
        burnable: burnable
      })
    );
  }

  //for safe lodging
  function lockDown() public lockUntilComplete(params.length > 0) {}

  function execute() internal override returns (bool) {
    Parameters[] memory localParams = params;
    delete params;

    for (uint256 i = 0; i < localParams.length; i++) {
      //second check to catch any blacklisted cliffFace tokens.
      if (localParams[i].soulType < 2 && !config.morgothApprover.approved(localParams[i].baseToken)) {
        revert TokenNotApproved(localParams[i].baseToken);
      }
      uint256 fps = minAPY_to_FPS(localParams[i].targetAPY, localParams[i].daiThreshold);
      //this is redundant if MorgothTokenApprover generated the proxies but that route isn't strictly required.
      config.proxyRegistry.setProxy(localParams[i].baseToken, localParams[i].limboProxy, localParams[i].behodlerProxy);

      address limboToken = localParams[i].limboProxy == address(0)
        ? localParams[i].baseToken
        : localParams[i].limboProxy;

      config.limbo.configureSoul(
        limboToken,
        localParams[i].crossingThreshold,
        localParams[i].soulType,
        localParams[i].state,
        localParams[i].index,
        fps
      );
      config.limbo.configureCrossingParameters(
        limboToken,
        localParams[i].initialCrossingBonus,
        localParams[i].crossingBonusDelta,
        localParams[i].burnable,
        localParams[i].crossingThreshold
      );
    }
    return true;
  }

  ///@notice helper function for converting a desired APY into a flan per second (FPS) statistic
  ///@param minAPY Here APY refers to the dollar value of flan relative to the dollar value of the threshold
  ///@param daiThreshold The DAI value of the target threshold to list on Behodler. Threshold is an approximation of the AVB on Behodler
  function minAPY_to_FPS(
    uint256 minAPY, //divide by 10000 to get percentage
    uint256 daiThreshold
  ) public pure returns (uint256 fps) {
    if (daiThreshold == 0) {
      revert DaiThresholdMustBePositive();
    }
    uint256 returnOnThreshold = (minAPY * daiThreshold) / 1e4;
    fps = returnOnThreshold / (YEAR);
  }
}
