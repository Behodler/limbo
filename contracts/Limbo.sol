// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
// import "hardhat/console.sol";
import "./facades/LimboDAOLike.sol";
import "./facades/Burnable.sol";
import "./facades/BehodlerLike.sol";
import "./facades/FlanLike.sol";
import "./facades/UniPairLike.sol";
import "./facades/MigratorLike.sol";
import "./facades/AMMHelper.sol";
import "./facades/AngbandLike.sol";
import "./facades/LimboAddTokenToBehodlerPowerLike.sol";
import "./DAO/Governable.sol";
import "./facades/FlashGovernanceArbiterLike.sol";

/*
LIMBO is the main staking contract. It corresponds conceptually to Sushi's Masterchef and takes design inspiration from Masterchef.
To give a high level overview, each token listed on Limbo is hoping to be listed on Behodler. In order to be listed, it must meet a minimum threshold of liquidity.
This creates a sharp distinction between the lifecycle of a listed token on Limbo vs Onsen which is why we don't just fork and run Masterchef. In particular:
1. By definition, tokens listed on Limbo are temporary visitors to the dapp, as the name Limbo implies. An array of tokens is therefore not sustainable
2. The migrator does not swap like for like. Instead, when the listing period is over, stakers must be made whole with more flan

Nomenclature:
Since words like token are incredibly generic, we need to provide context through naming.
Sticking to the overall metaphor, to paraphrase makerdao documentation, reduces code smells.
1. A token listed on Limbo is a Soul
2. When a token lists on Behodler, we say the soul is crossing over. The event is a crossing.

Security note: the designers of the crossing event and the payment of locked stakers 
should be cognizant of potential flash loan vectors

Late stakers considerations:
Suppose you're the last person to stake. That is, your stake takes the soul over the crossing threshold and the soul is locked.
In this instance, you would have earned no Flan, creating a declining incentive for stakers to arrive and in the extreme leading
to a situation of never crossing the threshold for any soul. This is a tragedy of the commons situation that leads to an overly 
inflated and essentially worthless Flan. We need a strategy to ameliorate this. The strategy needs to:
1. provide sufficient incentive for later arrivals.
2. Not punish early stakers and ideally reward them for being early.
3. Not disproportionately inflate the supply of flan.

Incentives:
When a soul is staking, the crossover bonus begins growing: Flan per soul.
Governance sets the rate of bonus growth and the target. 

Phases:
1. calibration
No staking/unstaking.
2. Staking
Staking/unstaking. If type is threshold, take threshold into account
3. WaitingToCross
Can claim rewards. Can't unstake.
4. CrossedOver
Injected into Behodler

Flash governance:
Since there might be many souls staking, we don't want to have to go through long to confirm proposals.
Instead, we want to have the opportunity to flash a governance action quickly. What we can do is require
a stake of EYE. Then the staker can trigger some governance unilaterally but their EYE remains locked for a few days.
The community can then decide if their governance action was in accord with the wellbeing of Limbo.
If it isn't, they can slash the deposit by betwen 1 and 100%. Flash gov can only move a variable some percentage per day.
Eg. suppose we vote on snapshot to raise the mimimum soul for Sushi to 1200 Sushi from 1180, 1.69%.
We have s maximum of 4% per day. So some flash staker comes along and moves it 3%. They are now 
elligible to be slashed. If they try to move it 5%, the operations reverts.
*/
enum SoulState {
  calibration,
  staking,
  waitingToCross,
  crossedOver
}
enum SoulType {
  uninitialized,
  threshold, //the default soul type is staked and when reaching a threshold, migrates to Behodler
  perpetual //the type of staking pool most people are familiar with.
}

/*
Error string legend:
 token not recognized as valid soul.	        E1
 invalid state	                                E2
 unstaking locked	                            E3
 balance exceeded	                            E4
 bonus already claimed.	                        E5
 crossing bonus arithmetic invariant.	        E6
 token accounted for.	                        E7
 burning excess SCX failed.	                    E8
 Invocation reward failed.	                    E9
 only threshold souls can be migrated           EB
 not enough time between crossing and migration EC
 bonus must be positive                         ED
 Unauthorized call                              EE
 Protocol disabled                              EF
 Reserve divergence tolerance exceeded          EG
 not enough time between reserve stamps         EH
 Minimum APY only applicable to threshold souls EI
 Governance action failed.                      EJ
 Access Denied                                  EK
 ERC20 Transfer Failed                          EL
 Incorrect SCX transfer to AMMHelper            EM
*/

struct Soul {
  uint256 lastRewardTimestamp; //I know masterchef counts by block but this is less reliable than timestamp.
  uint256 accumulatedFlanPerShare;
  uint256 crossingThreshold; //the value at which this soul is elligible to cross over to Behodler
  SoulType soulType;
  SoulState state;
  uint256 flanPerSecond; // fps: we use a helper function to convert min APY into fps
}

struct CrossingParameters {
  uint256 stakingBeginsTimestamp; //to calculate bonus
  uint256 stakingEndsTimestamp;
  int256 crossingBonusDelta; //change in teraFlanPerToken per second
  uint256 initialCrossingBonus; //measured in teraflanPerToken
  bool burnable;
}

struct CrossingConfig {
  address behodler;
  uint256 SCX_fee;
  uint256 migrationInvocationReward; //calling migrate is expensive. The caller should be rewarded in flan.
  uint256 crossingMigrationDelay; // this ensures that if Flan is successfully attacked, governance will have time to lock Limbo and prevent bogus migrations
  address morgothPower;
  address angband;
  address ammHelper;
  uint16 rectangleOfFairnessInflationFactor; //0-100: if the community finds the requirement to be too strict, they can inflate how much SCX to hold back
}

library SoulLib {
  function set(
    Soul storage soul,
    uint256 crossingThreshold,
    uint256 soulType,
    uint256 state,
    uint256 fps
  ) external {
    soul.crossingThreshold = crossingThreshold;
    soul.flanPerSecond = fps;
    soul.state = SoulState(state);
    soul.soulType = SoulType(soulType);
  }
}

library CrossingLib {
  function set(
    CrossingParameters storage params,
    FlashGovernanceArbiterLike flashGoverner,
    Soul storage soul,
    uint256 initialCrossingBonus,
    int256 crossingBonusDelta,
    bool burnable,
    uint256 crossingThreshold
  ) external {
    flashGoverner.enforceTolerance(initialCrossingBonus, params.initialCrossingBonus);
    flashGoverner.enforceToleranceInt(crossingBonusDelta, params.crossingBonusDelta);

    params.initialCrossingBonus = initialCrossingBonus;
    params.crossingBonusDelta = crossingBonusDelta;
    params.burnable = burnable;

    flashGoverner.enforceTolerance(crossingThreshold, soul.crossingThreshold);
    soul.crossingThreshold = crossingThreshold;
  }
}

library MigrationLib {
  function migrate(
    address token,
    LimboAddTokenToBehodlerPowerLike power,
    CrossingParameters memory crossingParams,
    CrossingConfig memory crossingConfig,
    FlanLike flan,
    uint256 RectangleOfFairness,
    Soul storage soul
  ) external returns (uint256, uint256) {
    power.parameterize(token, crossingParams.burnable);

    //invoke Angband execute on power that migrates token type to Behodler
    uint256 tokenBalance = IERC20(token).balanceOf(address(this));
    IERC20(token).transfer(address(crossingConfig.morgothPower), tokenBalance);
    AngbandLike(crossingConfig.angband).executePower(address(crossingConfig.morgothPower));

    uint256 scxMinted = IERC20(address(crossingConfig.behodler)).balanceOf(address(this));

    uint256 adjustedRectangle = ((crossingConfig.rectangleOfFairnessInflationFactor) * RectangleOfFairness) / 100;

    //for top up or exotic high value migrations.
    if (scxMinted <= adjustedRectangle) {
      adjustedRectangle = scxMinted / 2;
    }

    //burn SCX - rectangle
    uint256 excessSCX = scxMinted - adjustedRectangle;
    require(BehodlerLike(crossingConfig.behodler).burn(excessSCX), "E8");

    //use remaining scx to buy flan and pool it on an external AMM
    IERC20(crossingConfig.behodler).transfer(crossingConfig.ammHelper, adjustedRectangle);
    uint256 lpMinted = AMMHelper(crossingConfig.ammHelper).stabilizeFlan(adjustedRectangle);

    //reward caller and update soul state
    require(flan.mint(msg.sender, crossingConfig.migrationInvocationReward), "E9");
    soul.state = SoulState.crossedOver;
    return (tokenBalance, lpMinted);
  }
}

contract Limbo is Governable {
  using SafeERC20 for IERC20;
  using SoulLib for Soul;
  using MigrationLib for address;
  using CrossingLib for CrossingParameters;
  event SoulUpdated(address soul, uint256 fps);
  event Staked(address staker, address soul, uint256 amount);
  event Unstaked(address staker, address soul, uint256 amount);
  event TokenListed(address token, uint256 amount, uint256 scxfln_LP_minted);

  event ClaimedReward(address staker, address soul, uint256 index, uint256 amount);

  event BonusPaid(address token, uint256 index, address recipient, uint256 bonus);

  struct User {
    uint256 stakedAmount;
    uint256 rewardDebt;
    bool bonusPaid;
  }

  uint256 constant TERA = 1E12;
  uint256 constant SCX_calc = TERA * 10000 * (1 ether); //112 bits added, still leaves plenty room to spare
  uint256 constant RectangleOfFairness = 30 ether; //MP = 1/t. Rect = tMP = t(1/t) = 1. 28 is the result of scaling factors on Behodler.
  bool protocolEnabled = true;
  CrossingConfig public crossingConfig;
  mapping(address => mapping(uint256 => Soul)) public souls;
  mapping(address => uint256) public latestIndex;
  mapping(address => mapping(address => mapping(uint256 => User))) public userInfo; //tokenAddress->userAddress->soulIndex->Userinfo
  mapping(address => mapping(uint256 => CrossingParameters)) public tokenCrossingParameters; //token->index->data
  mapping(address => mapping(address => mapping(address => uint256))) unstakeApproval; //soul->owner->unstaker->amount
  FlanLike Flan;

  modifier enabled() {
    require(protocolEnabled, "EF");
    _;
  }

  function attemptToTargetAPY(
    address token,
    uint256 desiredAPY,
    uint256 daiThreshold
  ) public governanceApproved(false) {
    Soul storage soul = currentSoul(token);
    require(soul.soulType == SoulType.threshold, "EI");
    uint256 fps = AMMHelper(crossingConfig.ammHelper).minAPY_to_FPS(desiredAPY, daiThreshold);
    flashGoverner.enforceTolerance(soul.flanPerSecond, fps);
    soul.flanPerSecond = fps;
  }

  function updateSoul(address token) public {
    Soul storage s = currentSoul(token);
    updateSoul(token, s);
  }

  function updateSoul(address token, Soul storage soul) internal {
    require(soul.soulType != SoulType.uninitialized, "E1");
    require(soul.state != SoulState.calibration, "E2");
    uint256 finalTimeStamp = block.timestamp;
    if (soul.state != SoulState.staking) {
      finalTimeStamp = tokenCrossingParameters[token][latestIndex[token]].stakingEndsTimestamp;
    }
    uint256 balance = IERC20(token).balanceOf(address(this));

    if (balance > 0) {
      uint256 flanReward = (finalTimeStamp - soul.lastRewardTimestamp) * soul.flanPerSecond;

      soul.accumulatedFlanPerShare = soul.accumulatedFlanPerShare + ((flanReward * TERA) / balance);
    }
    soul.lastRewardTimestamp = finalTimeStamp;
  }

  constructor(address flan, address limboDAO) Governable(limboDAO) {
    Flan = FlanLike(flan);
  }

  function configureCrossingConfig(
    address behodler,
    address angband,
    address ammHelper,
    address morgothPower,
    uint256 migrationInvocationReward,
    uint256 crossingMigrationDelay,
    uint16 rectInflationFactor //0 to 100
  ) public onlySuccessfulProposal {
    crossingConfig.migrationInvocationReward = migrationInvocationReward * (1 ether);
    crossingConfig.behodler = behodler;
    crossingConfig.crossingMigrationDelay = crossingMigrationDelay;
    crossingConfig.angband = angband;
    crossingConfig.ammHelper = ammHelper;
    crossingConfig.morgothPower = morgothPower;
    require(rectInflationFactor <= 10000, "E6");
    crossingConfig.rectangleOfFairnessInflationFactor = rectInflationFactor;
  }

  function disableProtocol() public governanceApproved(true) {
    protocolEnabled = false;
  }

  function enableProtocol() public onlySuccessfulProposal {
    protocolEnabled = true;
  }

  function adjustSoul(
    address token,
    uint256 initialCrossingBonus,
    int256 crossingBonusDelta,
    uint256 fps
  ) public governanceApproved(false) {
    Soul storage soul = currentSoul(token);
    flashGoverner.enforceTolerance(soul.flanPerSecond, fps);
    soul.flanPerSecond = fps;

    CrossingParameters storage params = tokenCrossingParameters[token][latestIndex[token]];

    flashGoverner.enforceTolerance(params.initialCrossingBonus, initialCrossingBonus);
    flashGoverner.enforceTolerance(
      uint256(params.crossingBonusDelta < 0 ? params.crossingBonusDelta * -1 : params.crossingBonusDelta),
      uint256(crossingBonusDelta < 0 ? crossingBonusDelta * -1 : crossingBonusDelta)
    );

    params.initialCrossingBonus = initialCrossingBonus;
    params.crossingBonusDelta = crossingBonusDelta;
  }

  /*
    Unguarded total access only available to true proposals.
    Tread carefully.
     */
  function configureSoul(
    address token,
    uint256 crossingThreshold,
    uint256 soulType,
    uint256 state,
    uint256 index,
    uint256 fps
  ) public onlySoulUpdateProposal {
    {
      latestIndex[token] = index > latestIndex[token] ? latestIndex[token] + 1 : latestIndex[token];

      Soul storage soul = currentSoul(token);
      soul.set(crossingThreshold, soulType, state, fps);
      if (SoulState(state) == SoulState.staking) {
        tokenCrossingParameters[token][latestIndex[token]].stakingBeginsTimestamp = block.timestamp;
      }
    }
    emit SoulUpdated(token, fps);
  }

  function configureCrossingParameters(
    address token,
    uint256 initialCrossingBonus,
    int256 crossingBonusDelta,
    bool burnable,
    uint256 crossingThreshold
  ) public governanceApproved(false) {
    CrossingParameters storage params = tokenCrossingParameters[token][latestIndex[token]];
    Soul storage soul = currentSoul(token);
    params.set(flashGoverner, soul, initialCrossingBonus, crossingBonusDelta, burnable, crossingThreshold);
  }

  function stake(address token, uint256 amount) public enabled {
    Soul storage soul = currentSoul(token);
    updateSoul(token, soul);
    require(soul.state == SoulState.staking, "E2");
    uint256 currentIndex = latestIndex[token];
    User storage user = userInfo[token][msg.sender][currentIndex];
    if (amount > 0) {
      //dish out accumulated rewards.
      uint256 pending = getPending(user, soul);
      if (pending > 0) {
        Flan.mint(msg.sender, pending);
      }

      //Note to auditors: exotic tokens such as rebase are handled via token proxies.
      uint256 oldBalance = IERC20(token).balanceOf(address(this));

      IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

      uint256 newBalance = IERC20(token).balanceOf(address(this));

      user.stakedAmount = user.stakedAmount + newBalance - oldBalance; //adding true differenc accounts for FOT tokens
      if (soul.soulType == SoulType.threshold && newBalance > soul.crossingThreshold) {
        soul.state = SoulState.waitingToCross;
        tokenCrossingParameters[token][latestIndex[token]].stakingEndsTimestamp = block.timestamp;
      }
    }

    user.rewardDebt = (user.stakedAmount * soul.accumulatedFlanPerShare) / TERA;
    emit Staked(msg.sender, token, amount);
  }

  function unstake(address token, uint256 amount) public enabled {
    _unstake(token, amount, msg.sender, msg.sender);
  }

  //Allows for Limbo to be upgraded 1 user at a time without introducing a system wide security risk
  function unstakeFor(
    address token,
    uint256 amount,
    address holder
  ) public {
    _unstake(token, amount, msg.sender, holder);
  }

  function _unstake(
    address token,
    uint256 amount,
    address unstaker,
    address holder
  ) internal {
    if (unstaker != holder) {
      unstakeApproval[token][holder][unstaker] -= amount;
    }
    Soul storage soul = currentSoul(token);
    updateSoul(token, soul);
    require(soul.state == SoulState.staking, "E2");
    User storage user = userInfo[token][holder][latestIndex[token]];
    require(user.stakedAmount >= amount, "E4");

    uint256 pending = getPending(user, soul);

    if (pending > 0 && amount > 0) {
      user.stakedAmount = user.stakedAmount - amount;
      IERC20(token).safeTransfer(address(unstaker), amount);
      rewardAdjustDebt(unstaker, pending, soul.accumulatedFlanPerShare, user);
      emit Unstaked(unstaker, token, amount);
    }
  }

  function claimReward(address token, uint256 index) public enabled {
    Soul storage soul = souls[token][index];
    updateSoul(token, soul);
    User storage user = userInfo[token][msg.sender][index];

    uint256 pending = getPending(user, soul);

    if (pending > 0) {
      rewardAdjustDebt(msg.sender, pending, soul.accumulatedFlanPerShare, user);
      emit ClaimedReward(msg.sender, token, index, pending);
    }
  }

  function rewardAdjustDebt(
    address recipient,
    uint256 pending,
    uint256 accumulatedFlanPerShare,
    User storage user
  ) internal {
    Flan.mint(recipient, pending);
    user.rewardDebt = (user.stakedAmount * accumulatedFlanPerShare) / TERA;
  }

  function claimBonus(address token, uint256 index) public enabled {
    Soul storage soul = souls[token][index];
    CrossingParameters storage crossing = tokenCrossingParameters[token][index];
    require(soul.state == SoulState.crossedOver || soul.state == SoulState.waitingToCross, "E2");

    User storage user = userInfo[token][msg.sender][index];
    require(!user.bonusPaid, "E5");
    user.bonusPaid = true;
    int256 accumulatedFlanPerTeraToken = crossing.crossingBonusDelta *
      int256(crossing.stakingEndsTimestamp - crossing.stakingBeginsTimestamp);

    //assert signs are the same
    require(accumulatedFlanPerTeraToken * crossing.crossingBonusDelta >= 0, "E6");

    int256 finalFlanPerTeraToken = int256(crossing.initialCrossingBonus) + accumulatedFlanPerTeraToken;

    uint256 flanBonus = 0;
    require(finalFlanPerTeraToken > 0, "ED");

    flanBonus = uint256((int256(user.stakedAmount) * finalFlanPerTeraToken)) / TERA;
    Flan.mint(msg.sender, flanBonus);

    emit BonusPaid(token, index, msg.sender, flanBonus);
  }

  //reward user for calling with percentage. require no active or waiting souls for withdrawal
  // We don't want airdrops, rebased growth or pooltogether winnings to be stuck in Limbo
  function claimSecondaryRewards(address token) public {
    SoulState state = currentSoul(token).state;
    require(state == SoulState.calibration || state == SoulState.crossedOver, "E7");
    uint256 balance = IERC20(token).balanceOf(address(this));
    IERC20(token).safeTransfer(crossingConfig.ammHelper, balance);
    AMMHelper(crossingConfig.ammHelper).buyFlanAndBurn(token, balance, msg.sender);
  }

  function currentSoul(address token) internal view returns (Soul storage) {
    return souls[token][latestIndex[token]];
  }

  //anyone can call migrate for a soul ready to be migrated
  //callers will be rewarded with flan to compensate gas
  function migrate(address token) public enabled {
    Soul storage soul = currentSoul(token);
    require(soul.soulType == SoulType.threshold, "EB");
    require(soul.state == SoulState.waitingToCross, "E2");
    require(
      block.timestamp - tokenCrossingParameters[token][latestIndex[token]].stakingEndsTimestamp >
        crossingConfig.crossingMigrationDelay,
      "EC"
    );
    (uint256 tokenBalance, uint256 lpMinted) = token.migrate(
      LimboAddTokenToBehodlerPowerLike(crossingConfig.morgothPower),
      tokenCrossingParameters[token][latestIndex[token]],
      crossingConfig,
      Flan,
      RectangleOfFairness,
      soul
    );
    emit TokenListed(token, tokenBalance, lpMinted);
  }

  function approveUnstake(
    address soul,
    address unstaker,
    uint256 amount
  ) external {
    unstakeApproval[soul][msg.sender][unstaker] = amount; //soul->owner->unstaker->amount
  }

  function getPending(User memory user, Soul memory soul) internal pure returns (uint256) {
    return ((user.stakedAmount * soul.accumulatedFlanPerShare) / TERA) - user.rewardDebt;
  }
}
