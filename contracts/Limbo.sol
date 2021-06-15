// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "./facades/LimboDAOLike.sol";
import "./facades/Burnable.sol";
import "./facades/FlanLike.sol";
import "./facades/AngbandLike.sol";
import "./facades/LimboAddTokenToBehodlerPowerLike.sol";
import "./facades/BehodlerLike.sol";
import "./facades/UniPairLike.sol";
import "./facades/UniswapRouterLike.sol";
import "./DAO/Governable.sol";
import "./facades/UniswapHelperLike.sol";
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

enum SoulState {calibration, staking, waitingToCross, crossedOver}
enum SoulType {
    uninitialized,
    threshold, //the default soul type is staked and when reaching a threshold, migrates to Behodler
    perpetual //the type of staking pool most people are familiar with.
}

abstract contract TokenMigrator {
    function migrate(address token) public virtual;
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
 token not recognized as valid soul.	        E10
 flan quote drift too high                      E11
 not enough time between quote and execution    E12
 claim rewards disabled when exit penlaty>0     E13
 only threshold souls can be migrated           E14
*/
contract Limbo is Governable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    using SafeERC20 for FlanLike;

    event SoulUpdated(address soul, uint256 allocPoint);
    event Staked(address staker, address soul, uint256 amount);
    event Unstaked(address staker, address soul, uint256 amount);
    event ClaimedReward(
        address staker,
        address soul,
        uint256 index,
        uint256 amount
    );
    event YourSoulIsMine(address token, address destination, address proposal);
    event BonusPaid(
        address token,
        uint256 index,
        address recipient,
        uint256 bonus
    );

    event TokenListed(address token, uint256 amount, uint256 scxfln_LP_minted);

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
        uint16 SCXburnPercentage; //% between 1 and 10000: When SCX is generated from a crossing, most of the SCX is burnt. The rest is used to prop up flan.
        uint256 SCX_fee;
        uint256 migrationInvocationReward; //calling migrate is expensive. The caller should be rewarded in flan.
        UniswapRouterLike router;
        UniswapHelperLike uniHelper;
        AngbandLike angband;
        LimboAddTokenToBehodlerPowerLike power;
        UniPairLike Flan_SCX_tokenPair;
        uint256 flanQuoteDivergenceTolerance;
        uint256 minQuoteWaitDuration;
    }

    struct User {
        uint256 stakedAmount;
        uint256 rewardDebt;
        bool bonusPaid;
    }

    bytes4 private constant TRANSFER_SELECTOR =
        bytes4(keccak256(bytes("transfer(address,uint256)")));

    uint256 constant TERA = 1e12;
    uint256 constant myriad = 1e4;
    uint256 constant SCX_calc = TERA * 10000;

    uint256 flanPerSecond;
    CrossingConfig public crossingConfig;
    uint256 public totalAllocationPoints;
    mapping(address => mapping(uint256 => Soul)) public souls;
    mapping(address => uint256) latestIndex;
    mapping(address => mapping(address => mapping(uint256 => User)))
        public userInfo; //tokenAddress->userAddress->soulIndex->Userinfo
    mapping(address => mapping(uint256 => CrossingParameters))
        public tokenCrossingParameters; //token->index->data

    FlanLike Flan;

    modifier updateSoul(address token) {
        Soul storage soul = currentSoul(token);
        require(soul.soulType != SoulType.uninitialized, "E1");

        uint256 balance = IERC20(token).balanceOf(address(this));
        soul.lastRewardTimestamp = block.timestamp;
        if (balance > 0) {
            uint256 flanReward =
                flanPerSecond.mul(soul.allocPoint).div(totalAllocationPoints);

            Flan.mint(flanReward);

            soul.accumulatedFlanPerShare = soul
                .accumulatedFlanPerShare
                .add(flanReward)
                .mul(TERA)
                .div(balance);
        }
        _;
    }

    modifier RequireState(address soul, SoulState state) {
        require(currentSoul(soul).state == state, "E2");
        _;
    }

    constructor(
        address flan,
        uint256 _flanPerSecond,
        address limboDAO
    ) Governable(limboDAO) {
        Flan = FlanLike(flan);
        flanPerSecond = _flanPerSecond;
    }

    function configureCrossingConfig(
        uint16 SCXburnPercentage,
        address Flan_SCX_tokenPair,
        address angband,
        address addToBehodlerPower,
        address behodler,
        address uniHelper,
        uint256[2] calldata flnQuoteConfig,
        uint256 migrationInvocationReward
    ) public onlySuccessfulProposal {
        crossingConfig.SCXburnPercentage = SCXburnPercentage;
        crossingConfig.Flan_SCX_tokenPair = UniPairLike(Flan_SCX_tokenPair);
        crossingConfig.angband = AngbandLike(angband);
        crossingConfig.power = LimboAddTokenToBehodlerPowerLike(
            addToBehodlerPower
        );
        crossingConfig.uniHelper = UniswapHelperLike(uniHelper);
        crossingConfig.migrationInvocationReward =
            migrationInvocationReward *
            (1 ether);
        crossingConfig.behodler = behodler;
        crossingConfig.flanQuoteDivergenceTolerance = flnQuoteConfig[0];
        crossingConfig.minQuoteWaitDuration = flnQuoteConfig[1];
    }

    function adjustSoul(
        address token,
        uint256 allocPoint,
        uint16 exitPenalty
    ) public governanceApproved {
        Soul storage soul = currentSoul(token);
        totalAllocationPoints = totalAllocationPoints.sub(soul.allocPoint);
        totalAllocationPoints = totalAllocationPoints.add(allocPoint);
        soul.allocPoint = allocPoint;
        soul.exitPenalty = exitPenalty;
    }

    /*
    Unguarded total access only available to true proposals.
    Tread carefully.
     */
    function configureSoul(
        address token,
        uint256 allocPoint,
        uint256 lastRewardTimestamp,
        uint256 accumulatedFlanPerShare,
        uint256 crossingThreshold,
        uint256 soulType,
        uint16 exitPenalty,
        SoulState state,
        uint256 index
    ) public onlySuccessfulProposal {
        {
            Soul storage soul = currentSoul(token);

            totalAllocationPoints = totalAllocationPoints.sub(soul.allocPoint);
            totalAllocationPoints = totalAllocationPoints.add(allocPoint);
            latestIndex[token] = index > latestIndex[token]
                ? latestIndex[token] + 1
                : latestIndex[token];

            soul = currentSoul(token);
            soul.allocPoint = allocPoint;
            soul.lastRewardTimestamp = lastRewardTimestamp;
            soul.accumulatedFlanPerShare = accumulatedFlanPerShare;
            soul.crossingThreshold = crossingThreshold;
            soul.state = state;
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
        tokenCrossingParameters[token][latestIndex[token]]
            .initialCrossingBonus = initialCrossingBonus;
        tokenCrossingParameters[token][latestIndex[token]]
            .crossingBonusDelta = crossingBonusDelta;
        tokenCrossingParameters[token][latestIndex[token]].burnable = burnable;

        currentSoul(token).crossingThreshold = crossingThreshold;
    }

    function governanceShutdown(address token, address fundDestination)
        public
        onlySuccessfulProposal
        returns (bool)
    {
        Soul storage soul = currentSoul(token);
        soul.state = SoulState.calibration;

        uint256 balance = IERC20(token).balanceOf(address(this));
        //We want the shutdown to go ahead regardless of whether the token implementation is broken
        (bool transferSuccess, ) =
            token.call(
                abi.encodeWithSelector(
                    TRANSFER_SELECTOR,
                    fundDestination,
                    balance
                )
            );

        emit YourSoulIsMine(token, fundDestination, msg.sender);
        return (transferSuccess);
    }

    //First stake deletes previous so that we can do one for listing a token like SCX/EYE and then reopen it to be permanent?
    function stake(address token, uint256 amount) public updateSoul(token) {
        Soul storage soul = currentSoul(token);
        require(soul.state == SoulState.staking, "E2");
        uint256 currentIndex = latestIndex[token];
        User storage user = userInfo[token][msg.sender][currentIndex];

        if (user.stakedAmount > 0) {
            uint256 pending =
                user
                    .stakedAmount
                    .mul(soul.accumulatedFlanPerShare)
                    .div(TERA)
                    .sub(user.rewardDebt);
            if (pending > 0) {
                Flan.safeTransfer(msg.sender, pending);
            }
        }
        if (amount > 0) {
            IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
            user.stakedAmount = user.stakedAmount.add(amount);
            uint256 newBalance = IERC20(token).balanceOf(address(this));
            if (
                soul.soulType == SoulType.threshold &&
                newBalance > soul.crossingThreshold
            ) {
                soul.state = SoulState.waitingToCross;
                CrossingParameters storage crossing =
                    tokenCrossingParameters[token][latestIndex[token]];
                crossing.stakingEndTimestamp = block.timestamp;
            }
        }
        user.rewardDebt = user
            .stakedAmount
            .mul(soul.accumulatedFlanPerShare)
            .div(TERA);
        emit Staked(msg.sender, token, amount);
    }

    function unstake(
        address token,
        uint256 index,
        uint256 amount
    ) public updateSoul(token) {
        Soul storage soul = souls[token][index];
        require(
            soul.state == SoulState.staking ||
                soul.state == SoulState.crossedOver,
            "E2"
        );
        int256 exitPenalty = soul.exitPenalty;
        require(exitPenalty < 10000, "E3");
        User storage user = userInfo[token][msg.sender][index];
        require(user.stakedAmount >= amount, "E4");

        uint256 pending =
            user.stakedAmount.mul(soul.accumulatedFlanPerShare).div(TERA).sub(
                user.rewardDebt
            );
        if (pending > 0) {
            pending = myriad.sub(uint256(soul.exitPenalty)).mul(pending).div(
                10000
            );
            Flan.safeTransfer(msg.sender, pending);
            if (amount > 0) {
                user.stakedAmount = user.stakedAmount.sub(amount);
                IERC20(token).safeTransfer(address(msg.sender), amount);
            }
            user.rewardDebt = user
                .stakedAmount
                .mul(soul.accumulatedFlanPerShare)
                .div(TERA);
            emit Unstaked(msg.sender, token, amount);
        }
    }

    function claimReward(address token, uint256 index)
        public
        updateSoul(token)
    {
        Soul storage soul = souls[token][index];
        User storage user = userInfo[token][msg.sender][index];
        require(soul.exitPenalty == 0, "E13");

        uint256 pending =
            user.stakedAmount.mul(soul.accumulatedFlanPerShare).div(TERA).sub(
                user.rewardDebt
            );
        if (pending > 0) {
            Flan.safeTransfer(msg.sender, pending);
            user.rewardDebt = user
                .stakedAmount
                .mul(soul.accumulatedFlanPerShare)
                .div(TERA);
            emit ClaimedReward(msg.sender, token, index, pending);
        }
    }

    function claimBonus(address token, uint256 index) public {
        Soul storage soul = souls[token][index];
        CrossingParameters storage crossing =
            tokenCrossingParameters[token][index];
        require(
            soul.state == SoulState.crossedOver ||
                soul.state == SoulState.waitingToCross,
            "E2"
        );

        User storage user = userInfo[token][msg.sender][index];
        require(!user.bonusPaid, "E5");
        user.bonusPaid = true;
        uint256 totalStakingDuration =
            crossing.stakingEndTimestamp - crossing.stakingBeginsTimestamp;
        int256 accumulatedTeraFlanPerToken =
            crossing.crossingBonusDelta * int256(totalStakingDuration);

        //assert signs are the same
        require(
            accumulatedTeraFlanPerToken * crossing.crossingBonusDelta > 0,
            "E6"
        );

        int256 finalTeraFlanPerToken =
            int256(crossing.initialCrossingBonus) + accumulatedTeraFlanPerToken;

        uint256 flanBonus = 0;
        if (finalTeraFlanPerToken > 0) {
            flanBonus =
                uint256((int256(user.stakedAmount) * finalTeraFlanPerToken)) /
                TERA;
            Flan.mint(msg.sender, flanBonus);
        }
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

    function migrate(address token)
        public
        RequireState(token, SoulState.waitingToCross)
    {
        require(currentSoul(token).soulType == SoulType.threshold, "E14");
        //parameterize LimboAddTokenToBehodler
        crossingConfig.power.parameterize(
            token,
            tokenCrossingParameters[token][latestIndex[token]].burnable
        );

        //invoke Angband execute on power that migrates token type to Behodler
        uint256 tokenBalance = IERC20(token).balanceOf(address(this));
        IERC20(token).transfer(address(crossingConfig.power), tokenBalance);
        crossingConfig.angband.executePower(address(crossingConfig.power));

        //get marginal SCX price and calculate triangle of fairness
        uint256 scxMinted =
            IERC20(crossingConfig.behodler).balanceOf(address(this));
        uint256 tokensToRelease =
            BehodlerLike(crossingConfig.behodler).withdrawLiquidityFindSCX(
                token,
                1000,
                10000,
                8
            );
        uint256 marginalPrice = SCX_calc.div(tokensToRelease);

        /*
            If we take the marginal price and input quantity and project a linear
            relationship back to the origin then the area under the curve represents
            the fair supply of SCX where early adopters aren't disproportionately whaled.
            This area under the curve is a right angle triangle and so is named the triangle
            of fairness. Any excess SCX should be burnt.
            */
        uint256 triangleOfFairness =
            marginalPrice.mul(tokenBalance).div(SCX_calc);

        //burn SCX - triangle
        uint256 excessSCX = scxMinted.sub(triangleOfFairness);
        require(BehodlerLike(crossingConfig.behodler).burn(excessSCX), "E8");

        uint256 lpMinted =
            crossingConfig.uniHelper.buyAndPoolFlan(
                crossingConfig.behodler,
                crossingConfig.flanQuoteDivergenceTolerance,
                crossingConfig.minQuoteWaitDuration,
                triangleOfFairness
            );
        //reward caller and update soul state
        require(
            Flan.transfer(msg.sender, crossingConfig.migrationInvocationReward),
            "E9"
        );
        currentSoul(token).state = SoulState.crossedOver;

        emit TokenListed(token, tokenBalance, lpMinted);
    }
}
