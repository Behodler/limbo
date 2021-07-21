// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./facades/LimboDAOLike.sol";
import "./facades/Burnable.sol";
import "./facades/BehodlerLike.sol";
import "./facades/FlanLike.sol";
import "./facades/UniPairLike.sol";
import "./facades/MigratorLike.sol";
import "./DAO/Governable.sol";
import "./facades/AMMHelper.sol";
import "./facades/AngbandLike.sol";
import "./facades/LimboAddTokenToBehodlerPowerLike.sol";
import "hardhat/console.sol";
/*
LIMBO is the main staking contract. It corresponds conceptually to Sushi's Masterchef and takes design inspiration from both
Masterchef.
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

Think about reverting states and what that means.


Flash governance:
Since there might be many souls staking, we don't want to have to go through long to confirm proposals.
Instead, we want to have the opportunity to flash a governance action quickly. What we can do is require
a stake of EYE. Then the staker can trigger some governance unilaterally but their EYE remains locked for a few days.
The community can then decide if their governance action was in accord with Snapshot.
If it isn't, they can slash the deposit by betwen 1 and 100%. Flash gov can only move a variable some percentage per day.
Eg. suppose we vote on snapshot to raise the mimimum soul for Sushi to 1200 Sushi from 1180, 1.69%.
We have s maximum of 4% per day. So some flash staker comes along and moves it 3%. They are now 
elligible to be slashed. 

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
 claim rewards disabled when exit penlaty>0     EA
 only threshold souls can be migrated           EB
 not enough time between crossing and migration EC
 bonus must be positive                         ED
 Unauthorized call                              EE
 Protocol disabled                              EF
 Reserve divergence tolerance exceeded          EG
 not enough time between reserve stamps         EH
*/
contract Limbo is Governable {
    using SafeERC20 for IERC20;
    using SafeERC20 for FlanLike;

    event SoulUpdated(address soul, uint256 allocPoint);
    event Staked(address staker, address soul, uint256 amount);
    event Unstaked(address staker, address soul, uint256 amount);
    event TokenListed(address token, uint256 amount, uint256 scxfln_LP_minted);

    event ClaimedReward(
        address staker,
        address soul,
        uint256 index,
        uint256 amount
    );
    event YourSoulIsMine(address token, address proposal);
    event BonusPaid(
        address token,
        uint256 index,
        address recipient,
        uint256 bonus
    );

    struct Soul {
        uint256 allocPoint;
        uint256 lastRewardTimestamp; //I know masterchef counts by block but this is less reliable than timestamp.
        uint256 accumulatedFlanPerShare;
        uint256 crossingThreshold; //the value at which this soul is elligible to cross over to Behodler
        SoulType soulType;
        SoulState state;
        uint16 exitPenalty; // % between 0 and 10000, set to 10000 or more for no unstaking
    }

    struct CrossingParameters {
        uint256 stakingBeginsTimestamp; //to calculate bonus
        uint256 stakingEndTimestamp;
        int256 crossingBonusDelta; //change in teraFlanPerToken per second
        uint256 initialCrossingBonus; //measured in teraflanPerToken
        bool burnable;
    }

    struct CrossingConfig {
        address behodler;
        uint256 SCX_fee;
        uint256 migrationInvocationReward; //calling migrate is expensive. The caller should be rewarded in flan.
        uint256 flanQuoteDivergenceTolerance;
        uint256 minQuoteWaitDuration;
        uint256 crossingMigrationDelay; // this ensures that if Flan is successfully attacked, governance will have time to lock Limbo and prevent bogus migrations
        address morgothPower;
        address angband;
        address ammHelper;
        uint8 marginalPricePrecision; //binary search max steps parameter used by behodler to estimate tokens required to produce a given quantity of SCX
        uint8 rectangleOfFairnessInflationFactor; //0-100: if the community finds the requirement to be too strict, they can inflate how much SCX to hold back
    }

    struct User {
        uint256 stakedAmount;
        uint256 rewardDebt;
        bool bonusPaid;
    }

    uint256 constant TERA = 1E12;
    uint256 constant myriad = 1e4;
    uint256 constant SCX_calc = TERA * 10000;
    bool protocolEnabled = true;
    uint256 public flanPerSecond;
    CrossingConfig public crossingConfig;
    uint256 public totalAllocationPoints;
    mapping(address => mapping(uint256 => Soul)) public souls;
    mapping(address => uint256) public latestIndex;
    mapping(address => mapping(address => mapping(uint256 => User)))
        public userInfo; //tokenAddress->userAddress->soulIndex->Userinfo
    mapping(address => mapping(uint256 => CrossingParameters))
        public tokenCrossingParameters; //token->index->data

    FlanLike Flan;

    modifier enabled {
        require(protocolEnabled, "EF");
        _;
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
            finalTimeStamp = tokenCrossingParameters[token][latestIndex[token]]
            .stakingEndTimestamp;
        }
        uint256 balance = IERC20(token).balanceOf(address(this));

        if (balance > 0) {
            uint256 accruedFlan = (finalTimeStamp - soul.lastRewardTimestamp) *
                flanPerSecond;
            uint256 flanReward = (accruedFlan * soul.allocPoint) /
                totalAllocationPoints;

            Flan.mint(address(this), flanReward);

            soul.accumulatedFlanPerShare =
                soul.accumulatedFlanPerShare +
                ((flanReward * TERA) / balance);
        }
        soul.lastRewardTimestamp = finalTimeStamp;
    }

    constructor(
        address flan,
        uint256 _flanPerSecond,
        address limboDAO
    ) Governable(limboDAO) {
        Flan = FlanLike(flan);
        flanPerSecond = _flanPerSecond;
        crossingConfig.marginalPricePrecision = 8;
    }

    function configureCrossingConfig(
        address behodler,
        address angband,
        address ammHelper,
        address morgothPower,
        uint256 migrationInvocationReward,
        uint256 crossingMigrationDelay,
        uint256 minQuoteWaitDuration,
        uint256 flanQuoteDivergenceTolerance,
        uint8 marginalPricePrecision, //0 = leave unchanged,
        uint8 rectInflationFactor //0 to 100
    ) public onlySuccessfulProposal {
        crossingConfig.migrationInvocationReward =
            migrationInvocationReward *
            (1 ether);
        crossingConfig.behodler = behodler;
        crossingConfig.crossingMigrationDelay = crossingMigrationDelay;
        crossingConfig.minQuoteWaitDuration = minQuoteWaitDuration;
        crossingConfig.angband = angband;
        crossingConfig.ammHelper = ammHelper;
        crossingConfig.morgothPower = morgothPower;
        crossingConfig
        .flanQuoteDivergenceTolerance = flanQuoteDivergenceTolerance;
        crossingConfig.marginalPricePrecision = marginalPricePrecision == 0
            ? crossingConfig.marginalPricePrecision
            : marginalPricePrecision;
        require(rectInflationFactor <= 100, "E6");
        crossingConfig.rectangleOfFairnessInflationFactor = rectInflationFactor;
    }

    function disableProtocol() public governanceApproved {
        protocolEnabled = false;
    }

    function enableProtocol() public onlySuccessfulProposal {
        protocolEnabled = true;
    }

    function adjustSoul(
        address token,
        uint256 allocPoint,
        uint16 exitPenalty,
        uint256 initialCrossingBonus,
        int256 crossingBonusDelta
    ) public governanceApproved {
        Soul storage soul = currentSoul(token);
        flashGoverner.enforceTolerance(soul.allocPoint, allocPoint);
        flashGoverner.enforceTolerance(soul.exitPenalty, exitPenalty);

        totalAllocationPoints = totalAllocationPoints - soul.allocPoint;
        totalAllocationPoints = totalAllocationPoints + allocPoint;
        soul.allocPoint = allocPoint;
        soul.exitPenalty = exitPenalty;

        CrossingParameters storage params = tokenCrossingParameters[token][
            latestIndex[token]
        ];

        flashGoverner.enforceTolerance(
            params.initialCrossingBonus,
            initialCrossingBonus
        );
        flashGoverner.enforceTolerance(
            uint256(
                params.crossingBonusDelta < 0
                    ? params.crossingBonusDelta * -1
                    : params.crossingBonusDelta
            ),
            uint256(
                crossingBonusDelta < 0
                    ? crossingBonusDelta * -1
                    : crossingBonusDelta
            )
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
        uint256 allocPoint,
        uint256 crossingThreshold,
        uint256 soulType,
        uint16 exitPenalty,
        uint256 state,
        uint256 index
    ) public onlySuccessfulProposal {
        {
            Soul storage soul = currentSoul(token);

            totalAllocationPoints = totalAllocationPoints - soul.allocPoint;
            totalAllocationPoints = totalAllocationPoints + allocPoint;
            latestIndex[token] = index > latestIndex[token]
                ? latestIndex[token] + 1
                : latestIndex[token];

            soul = currentSoul(token);
            soul.allocPoint = allocPoint;
            soul.crossingThreshold = crossingThreshold;
            soul.state = SoulState(state);

            if (SoulState(state) == SoulState.staking) {
                tokenCrossingParameters[token][latestIndex[token]]
                .stakingBeginsTimestamp = block.timestamp;
            }
            soul.soulType = SoulType(soulType);
            soul.exitPenalty = exitPenalty;
        }
        emit SoulUpdated(token, allocPoint);
    }

    function configureCrossingParameters(
        address token,
        uint256 initialCrossingBonus,
        int256 crossingBonusDelta,
        bool burnable,
        uint256 crossingThreshold
    ) public governanceApproved {
        CrossingParameters storage params = tokenCrossingParameters[token][
            latestIndex[token]
        ];
        flashGoverner.enforceTolerance(
            initialCrossingBonus,
            params.initialCrossingBonus
        );
        flashGoverner.enforceToleranceInt(
            crossingBonusDelta,
            params.crossingBonusDelta
        );

        tokenCrossingParameters[token][latestIndex[token]]
        .initialCrossingBonus = initialCrossingBonus;
        tokenCrossingParameters[token][latestIndex[token]]
        .crossingBonusDelta = crossingBonusDelta;
        tokenCrossingParameters[token][latestIndex[token]].burnable = burnable;

        Soul storage soul = currentSoul(token);
        flashGoverner.enforceTolerance(
            crossingThreshold,
            soul.crossingThreshold
        );
        currentSoul(token).crossingThreshold = crossingThreshold;
    }

    function governanceShutdown(address token) public onlySuccessfulProposal {
        currentSoul(token).soulType = SoulType.uninitialized;
        emit YourSoulIsMine(token, msg.sender);
    }

    function stake(address token, uint256 amount) public enabled {
        Soul storage soul = currentSoul(token);
        updateSoul(token, soul);
        require(soul.state == SoulState.staking, "E2");
        uint256 currentIndex = latestIndex[token];
        User storage user = userInfo[token][msg.sender][currentIndex];

        if (amount > 0) {
            //dish out accumulated rewards.
            uint256 pending = ((user.stakedAmount *
                soul.accumulatedFlanPerShare) / TERA) - user.rewardDebt;
            if (pending > 0) {
                pending -= ((uint256(soul.exitPenalty)) * pending) / myriad; //staking more on an exitPenalty soul is like unstaking and restaking logcically. Without this incentive, users can game the system by staking more than they need.
                Flan.safeTransfer(msg.sender, pending);
            }

            IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
            user.stakedAmount = user.stakedAmount + amount;
            uint256 newBalance = IERC20(token).balanceOf(address(this));
            if (
                soul.soulType == SoulType.threshold &&
                newBalance > soul.crossingThreshold
            ) {
                soul.state = SoulState.waitingToCross;
                tokenCrossingParameters[token][latestIndex[token]]
                .stakingEndTimestamp = block.timestamp;
            }
        }

        user.rewardDebt =
            (user.stakedAmount * soul.accumulatedFlanPerShare) /
            TERA;
        emit Staked(msg.sender, token, amount);
    }

    function unstake(address token, uint256 amount) public enabled {
        Soul storage soul = currentSoul(token);
        updateSoul(token, soul);
        require(soul.state == SoulState.staking, "E2");
        uint16 exitPenalty = soul.exitPenalty;
        require(exitPenalty < 10000, "E3");
        User storage user = userInfo[token][msg.sender][latestIndex[token]];
        require(user.stakedAmount >= amount, "E4");

        uint256 pending = ((user.stakedAmount * soul.accumulatedFlanPerShare) /
            TERA -
            user.rewardDebt);

        if (pending > 0) {
            pending -= ((uint256(soul.exitPenalty)) * pending) / myriad;
            Flan.safeTransfer(msg.sender, pending);
            if (amount > 0) {
                user.stakedAmount = user.stakedAmount - amount;
                IERC20(token).safeTransfer(address(msg.sender), amount);
            }
            user.rewardDebt =
                (user.stakedAmount * soul.accumulatedFlanPerShare) /
                TERA;
            emit Unstaked(msg.sender, token, amount);
        }
    }

    function claimReward(address token, uint256 index) public enabled {
        Soul storage soul = souls[token][index];
        updateSoul(token, soul);
        User storage user = userInfo[token][msg.sender][index];
        require(soul.exitPenalty == 0, "EA");

        uint256 pending = ((user.stakedAmount * soul.accumulatedFlanPerShare) /
            TERA) - user.rewardDebt;

        if (pending > 0) {
            Flan.safeTransfer(msg.sender, pending);
            user.rewardDebt =
                (user.stakedAmount * soul.accumulatedFlanPerShare) /
                TERA;
            emit ClaimedReward(msg.sender, token, index, pending);
        }
    }

    function claimBonus(address token, uint256 index) public enabled {
        Soul storage soul = souls[token][index];
        CrossingParameters storage crossing = tokenCrossingParameters[token][
            index
        ];
        require(
            soul.state == SoulState.crossedOver ||
                soul.state == SoulState.waitingToCross,
            "E2"
        );

        User storage user = userInfo[token][msg.sender][index];
        require(!user.bonusPaid, "E5");
        user.bonusPaid = true;
        uint256 totalStakingDuration = crossing.stakingEndTimestamp -
            crossing.stakingBeginsTimestamp;
        int256 accumulatedFlanPerTeraToken = crossing.crossingBonusDelta *
            int256(totalStakingDuration);

        //assert signs are the same
        require(
            accumulatedFlanPerTeraToken * crossing.crossingBonusDelta >= 0,
            "E6"
        );

        int256 finalFlanPerTeraToken = int256(crossing.initialCrossingBonus) +
            accumulatedFlanPerTeraToken;

        uint256 flanBonus = 0;
        require(finalFlanPerTeraToken > 0, "ED");

        flanBonus =
            uint256((int256(user.stakedAmount) * finalFlanPerTeraToken)) /
            TERA;
        Flan.mint(msg.sender, flanBonus);

        emit BonusPaid(token, index, msg.sender, flanBonus);
    }

    // We don't want airdrops or pooltogether winnings to be stuck in Limbo (pun?)
    function withdrawERC20(address token, address destination)
        public
        onlySuccessfulProposal
    {
        require(currentSoul(token).soulType == SoulType.uninitialized, "E7");
        uint256 balance = IERC20(token).balanceOf(address(this));
        IERC20(token).transfer(destination, balance);
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
            block.timestamp -
                tokenCrossingParameters[token][latestIndex[token]]
                .stakingEndTimestamp >
                crossingConfig.crossingMigrationDelay,
            "EC"
        );

        LimboAddTokenToBehodlerPowerLike(crossingConfig.morgothPower)
            .parameterize(
            token,
            tokenCrossingParameters[token][latestIndex[token]].burnable
        );

        //invoke Angband execute on power that migrates token type to Behodler
        uint256 tokenBalance = IERC20(token).balanceOf(address(this));
        IERC20(token).transfer(
            address(crossingConfig.morgothPower),
            tokenBalance
        );
        AngbandLike(crossingConfig.angband).executePower(
            address(crossingConfig.morgothPower)
        );

        //get marginal SCX price and calculate rectangle of fairness
        uint256 scxMinted = IERC20(address(crossingConfig.behodler)).balanceOf(
            address(this)
        );

        uint256 tokensToRelease = BehodlerLike(crossingConfig.behodler)
        .withdrawLiquidityFindSCX(token, 1000, 10000, 8); // crossingConfig.marginalPricePrecision);
        uint256 marginalPrice = SCX_calc / tokensToRelease; //point price estimate for MP

        uint256 rectangleOfFairness = (marginalPrice *
            tokenBalance *
            (100 + crossingConfig.rectangleOfFairnessInflationFactor)) /
            (SCX_calc * 100);
        rectangleOfFairness = rectangleOfFairness > scxMinted
            ? scxMinted
            : rectangleOfFairness;

        //burn SCX - rectangle
        uint256 excessSCX = scxMinted - rectangleOfFairness;
        require(BehodlerLike(crossingConfig.behodler).burn(excessSCX), "E8");

        //use remaining scx to buy flan and pool it on an external AMM
        IERC20(crossingConfig.behodler).transfer(
            crossingConfig.ammHelper,
            rectangleOfFairness
        );
        uint256 lpMinted = AMMHelper(crossingConfig.ammHelper).buyAndPoolFlan(
            crossingConfig.flanQuoteDivergenceTolerance,
            crossingConfig.minQuoteWaitDuration,
            rectangleOfFairness
        );

        emit TokenListed(token, tokenBalance, lpMinted);

        //reward caller and update soul state
        require(
            Flan.mint(msg.sender, crossingConfig.migrationInvocationReward),
            "E9"
        );
        currentSoul(token).state = SoulState.crossedOver;
    }
}
