// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

//LOW LEVEL
error NotAContract(address EOA);
error ArrayLengthMismatch(uint256 arr1, uint256 arr2);
error InvocationFailure(address target);

//OWNABLE
error OnlyOwner(address caller, address owner);
error TransferToZeroAddress();

//LIMBO
error InvalidSoul(address token);
error InvalidSoulState(address token, uint256 state);
error InvalidSoulType(address token, uint256 actualType, uint256 expectedType);
error ExcessiveWithdrawalRequest(address token, uint256 amount, uint256 staked);
error BonusClaimed(address token, uint256 index);
error CrossingBonusInvariant(int256 accFlanPerTeraToken, int256 bonusDelta);
error TokenAccountedFor(address token);
error InvocationRewardFailed(address caller);
// The purpose of this is to prevent flash loans or block manipulators from gaming migrations
error MigrationCoolDownActive(address token, uint256 index, uint256 migrationDelay);
error FlanBonusMustBePositive(address token, uint256 index, uint256 staked, int256 finalFlanPerTeraToken);
error ProtocolDisabled();

//FLAN
error MintingNotWhiteListed(address msgSender);
error TransferUnderflow(uint256 senderBalance, uint256 fee, uint256 amount);
error MaxMintPerEpochExceeded(uint256 max, uint256 aggregate);

//UNISWAPHELPER
error DaiThresholdMustBePositive();
error OracleLPsNotSet(address fln_scx, address dai_scx, address scx__fln_scx);
error OnlyLimbo(address msgSender, address limbo);
error NotOnMainnet();
error DivergenceToleranceTooLow(uint256 tolerance);
error PriceOvershootTooHigh(uint8 overshoot);
error PriceBufferConfigInvalid(uint64 tolerance, uint32 rewardPercentage, uint32 scxTax);

//ERC20
error ApproveToNonZero(address token, address spender, uint256 amount);
error InsufficinetFunds(uint256 balance, uint256 value);
error AllowanceExceeded(uint256 allowance, uint256 amount);
error AllowanceUnderflow(uint256 allowance, uint256 subtraction);
error OperationFailure();

error BurnUnderflow(uint256 accountBalance, uint256 amount);
//GOVERNANCE
error ExistingFlashGovernanceDecisionUnderReview(address sender, address target);
error LodgeFailActiveProposal(address current, address lodged);
error NotLive();
error ProposalNotApproved(address proposal);
error AssetNotApproved(address asset);
error FlashGovNotInitialized();
error ProposalNotInVoting(address proposal);
error LimboAndFlanNotOwnedByDAO(address limbo, address flan);
error AssetStakeInvariantViolation(uint256 invariantNumber, uint256 var1, uint256 var2);
error AssetStakeInvariantViolation1(uint256 var1, uint256 var2, uint256 var3);
error AssetMustBeEYE(address eye, address invalidAsset);
error FlashGovernerNotSet();
error ProposalMismatch(address proposal, address currrentProposal);
error OnlyProposalFactory(address msg_sender, address factory);
error UniswapV2FactoryMismatch(address pairFactory, address trueFactory);
error InvalidVoteCast(int256 fateCast, int256 currentProposalFate);
error VotingPeriodOver(uint256 blockTime, uint256 proposalStartTime, uint256 votingDuration);
error AccessDenied(address configurationLord, address msg_sender);
error BackrunDetected(address expectedDAO, address actualDAO);
error GovernanceActionFailed(bool configured, address proposal);
error FlashGovernanceDisabled(address target);
error FlashGovernanceEpochFull(uint256 epochSize, uint256 lastAct);
error InvalidChangeTolerance(uint8 tolerance);
error FlashDecisionPending(address target, address msgSender);
error FlashToleranceViolated(uint256 v1, uint256 v2);
error OnlyFateSpender(address msgSender);

//PROPOSALS
error OnlyFactoryOrDAO(address dao, address factory);
error ProposalLocked(address proposal);
error ProposalNotLocked(address proposal);
error ExecutionFailed();
error TokenNotApproved(address token);
error GriefSafetyFactorExceeded(uint256 griefSafetyFactor, uint256 actualLength);
error NotEnoughFateToLodge(uint256 userBalance, uint256 required);
//ORACLE
error InvalidPair(address token0, address token1);
error ReservesEmpty(address pair, uint256 reserve1, uint256 reserve2);
error InvalidToken(address pair, address token);
error UpdateOracle(address tokenIn, address tokenOut, uint256 amountIn);
error AssetNotRegistered(address pair);
error WaitPeriodTooSmall(uint256 timeElapsed, uint256 period);

//Proxy
error OnlyProxy(address sender, address proxy);
error SlippageManipulationPrevention(uint256 blockNumber, uint256 priorBlockNumber);
error AmplificationTooLow(uint256 R_amp);
error BehodlerSwapOutInvariantViolated(address inputToken, uint256 actualAmount, uint256 expectedAmount);
error NotMorgothPower(address sender,address power);

//TESTING
error BehodlerMaxLiquidityExit(uint256 outputAmount, uint256 initialOutputBalance, uint256 maxLiquidityExit);
error BehodlerSwapInvariant(uint256 inputRatio, uint256 outputRatio);
error BehodlerSwapInInvariantViolated(uint256 output, uint256 expectedOutput);
error SCXBalanceTooLow(uint256 expected, uint256 actual);
error ExcessiveInputAmount(uint256 amountsZero, uint256 amountInMax);
