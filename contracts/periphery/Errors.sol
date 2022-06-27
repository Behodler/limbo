// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

//LOW LEVEL
error NotAContract(address EOA);

//LIMBO

//UNISWAPHELPER

//ERC20
error ERC20_ApproveToNonZero(address token, address spender, uint256 amount);
error ERC20_InsufficinetFunds(uint balance, uint value);

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

//OWNABLE
error OnlyOwner(address caller, address owner);
error TransferToZeroAddress();
