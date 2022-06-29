// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

//LOW LEVEL
error NotAContract(address EOA);
error ArrayLengthMismatch (uint arr1,uint arr2);
error InvocationFailure (address target);

//OWNABLE
error OnlyOwner(address caller, address owner);
error TransferToZeroAddress();

//LIMBO
error InvalidSoul (address token);
error InvalidSoulState (address token, uint state);
error InvalidSoulType (address token, uint actualType, uint expectedType);
error ExcessiveWithdrawalRequest (address token, uint amount,uint staked);
error BonusClaimed(address token, uint index);
error CrossingBonusInvariant(int accFlanPerTeraToken, int bonusDelta);
error TokenAccountedFor(address token);
error InvocationRewardFailed (address caller);
// The purpose of this is to prevent flash loans or block manipulators from gaming migrations
error MigrationCoolDownActive(address token, uint index, uint migrationDelay);
error FlanBonusMustBePositive (address token, uint index, uint staked, int finalFlanPerTeraToken);
error ProtocolDisabled ();

//FLAN
error MintAllowanceExceeded(address msgSender,uint allowance, uint amount);
error TransferUnderflow(uint senderBalance,uint fee, uint amount);

//UNISWAPHELPER
error DaiThresholdMustBePositive();
error OracleLPsNotSet (address fln_scx,address dai_scx,address scx__fln_scx);
error OnlyLimbo(address msgSender, address limbo);
error NotOnMainnet();
error DivergenceToleranceTooLow(uint tolerance);
error PriceOvershootTooHigh(uint8 overshoot);

//ERC20
error ApproveToNonZero(address token, address spender, uint256 amount);
error InsufficinetFunds(uint balance, uint value);
error AllowanceExceeded (uint allowance, uint amount );
error AllowanceUnderflow(uint allowance, uint subtraction);
error OperationFailure ();

error BurnUnderflow(uint accountBalance, uint amount);
//GOVERNANCE
error ExistingFlashGovernanceDecisionUnderReview(address sender, address target);
error LodgeFailActiveProposal(address current, address lodged);
error NotLive();
error ProposalNotApproved(address proposal);
error AssetNotApproved(address asset);
error FlashGovNotInitialized();
error ProposalNotInVoting(address proposal);
error LimboAndFlanNotOwnedByDAO(address limbo, address flan);
error AssetStakeInvariantViolation(uint invariantNumber,uint var1, uint var2);
error AssetStakeInvariantViolation1(uint var1, uint var2, uint var3);
error AssetMustBeEYE (address eye, address invalidAsset);
error FlashGovernerNotSet();
error ProposalMismatch(address proposal, address currrentProposal);
error OnlyProposalFactory(address msg_sender, address factory);
error FateToFlanConversionDisabled();
error UniswapV2FactoryMismatch (address pairFactory,address trueFactory);
error InvalidVoteCast(int fateCast, int currentProposalFate);
error VotingPeriodOver (uint blockTime,uint proposalStartTime,uint votingDuration);
error AccessDenied(address configurationLord, address msg_sender);
error BackrunDetected (address expectedDAO, address actualDAO);
error GovernanceActionFailed (bool configured, address proposal);
error FlashGovernanceDisabled(address target);
error FlashGovernanceEpochFull(uint epochSize, uint lastAct);
error InvalidChangeTolerance (uint8 tolerance);
error FlashDecisionPending(address target, address msgSender);
error FlashToleranceViolated(uint v1, uint v2);


//PROPOSALS
error OnlyFactoryOrDAO(address dao, address factory);
error ProposalLocked (address proposal);
error ProposalNotLocked(address proposal);
error ExecutionFailed ();
error TokenNotApproved (address token);

//ORACLE
error InvalidPair(address token0, address token1);
error ReservesEmpty (address pair, uint reserve1, uint reserve2);
error InvalidToken (address pair, address token);
error UpdateOracle (address tokenIn,address tokenOut, uint amountIn);
error AssetNotRegistered(address pair);
error WaitPeriodTooSmall (uint timeElapsed, uint period);