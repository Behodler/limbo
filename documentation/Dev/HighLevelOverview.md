# Purpose
This document is to assist both front end integrations and smart contract composition of Limbo.

# Governance
There are two forms of governance actions, directed by LimboDAO. Each has certain tradeoffs pertaining to security. 

## Proposals
All governance actions can be executed via a proposal. Proposals are passed via majority onchain votes. Voting points are called Fate and are accumulated by staking either EYE or EYE LP. When EYE is staked, users earn fate at a rate of the square root of the EYE balance per second. When an EYE LP is staked, the user earns 2 times the square root of the eye balance of their LP position. Finally, if EYE is burnt, the user earns Fate equal to a multiple (currently 10) of the EYE burnt. This is a last resort veto option.
Fate cannot be transferred. Voting is simple majority wins. Fate is spent, not staked. 
To lodge a proposal, anyone can submit a proposal contract with a large deposit of Fate. If the proposal passes, half the Fate is returned to the proposer. If it fails, all the Fate is lost. This creates an incentive to not spam propose (Karen attack).

## Flash governance.
For decisions of lower risk that need to happen more frequently than the proposal delay, flash governance exists. Here a user need only have a predefined minimum balance of EYE in their wallet to call functions marked with flash governance. The EYE is taken as a deposit and the function executes immediately. The community can issue and vote on a proposal to burn the staked EYE in the event that the execution was considered malicious. After a window of time has passed, they EYE can be reclaimed.
To protect the dapp from massive disruption, flash governance decisions can be forced to only deviate the existing value by a few percentage points.
Finally, a limit on the frequency of flash governance decisions is set so as to prevent a Karen attack.

# Limbo
Limbo is the yield farm at the centre of the dapp. A pool in Limbo is called a Soul to keep with the nomenclature. The reward token is Flan and all souls have a flan-per-second rate set at the soul level. This means that the entire soul receives that allotment per second which is then divided among the users in proportion to their staked amount of input token.

## Souls
Limbo has two types of souls which can exist in 4 different states.
 
### Types
1. Threshold. Threshold souls are for tokens being migrated to Behodler. Through governance, a threshold of input tokens is set. When a migration occurs, users are rewarded compensation via a crossingBonus. During the staking phase, the crossing bonus can either increase per second or decrease (or remain unchanged). This is controlled via the crossingBonus delta variable. For instance, if we set a crossing bonus of 10000 and a delta of -2 then the bonus will start at 10000 and decline by 2 every second. Once the threshold is crossed, the bonus number is frozen and is divided among stakers pro rata.
2. Perpetual. A perpetual soul cannot be migrated and instead offers an indefinite APY to stakers.

### States
1. Calibration. Here the soul exists and can be adjusted until it is ready for staking. Any attempt to stake tokens in this state is rejected.
2. Staking. This is the live state and accepts deposits. This state applies to both types of souls.
3. WaitingToCross. When the threshold is crossed for a threshold soul, the state is updated to WaitingToCross. Users can no longer withdraw their tokens. At this point, two price stamps have to be taken (by anyone) through a helper oracle contract to establish reliable prices to assist with migration. Only after those stamps have occurred is the soul ready to be migrated. 
4. CrossedOver. This is the completed state of a soul. Here the input tokens have been migrated. 

When a threshold soul is migrated, a migration bonus in Flan is calculated that participants can claim in compensation for their tokens.

# Contract topology
**Proposals** are standalone contracts that inherit the proposal base contract which can be invoked generically via an invoke function, following the command pattern.

**Proposal Factory** controls the whitelisting of valid proposals. The whitelisting feature itself can be controlled by a special whitelist proposal contract which is auto whitelisted on deploy. In this way, the DAO bootstraps itself with the only valid proposal it needs: the one that determines whether a proposal is valid or not. This immediately frees the DAO from enduring a period of centralization.
To lodge a proposal with LimboDAO, users would pass a whitelisted contract to the lodgeProposal function.
Note that proposals are intended to be recycled with new parameters, not reinstantiated each time since the whitelisting process would slow things down too much. 

**FlashGovernanceArbiter** handles all flash governance housekeeping logic and is itself governed by LimboDAO.

**Governable** is a base class that all governable contracts must inherit in order to be subject to the authority of LimboDAO.

**Flan** is a governable token that is used for rewarding souls on Limbo. Flan has a whitelisting mint feature and is burnable. Through governance, a burn on transfer functionality can be enabled. Flan implements the ERC677 token standard, a compliant extension of ERC20.

**Limbo** is governable and provides an interface for staking/unstaking and migrating tokens to Behodler. Limbo is whitelisted to mint Flan.

**UniswapHelper** As part of the migration, Limbo interacts with an external AMM in order to influence the price external to Behodler. Currently the supported external AMMs are Uniswap V2 and Sushiswap CFMM.
When a staked token earns a protocol token, an airdrop or any other ancillary rewards they accumulate in Limbo, UniswapHelper is used to buy and burn Flan using the protocol reward token.

**Soul reader** is just a helper contract to make front end work easier.

# Breakdown of precise functionality
This section explains all public properties and unguarded public functions, and can be thought of as supporting documentation for the ABIs. Bold functions are governance operations.


## LimboDAO
### Properties
* domainConfig: global configuration variables. Mostly just contract addresses.
* proposalConfig: global parameters of proposals.
* fateGrowthStrategy. Pertains to each users' growth of fate per second. usually 0.
* fateState tracks the fate details for a particular user. FatePerDay is the current growth rate, FateBalance is the total fate, and lastDamnAdjustment is the timestamp to assist with growth calculations.
* modifiers: onlySuccessfulProposal are for functions that can only be invoked by a successful proposal. governanceApproved is a superset of onlySuccessfulProposal that includes flash governance.

### Functions
* incrementFateFor: can be invoked by anyone. it simply updates fate balance of a particular user.
* seed: configures the DAO. Morgoth has full control over this.
* Vote: for proposals
* executeCurrentProposal. If a proposal has gathered enough fate, it can executed instantly.
* **setApprovedAsset: whitelist fate earning assets.**
* SetEYEBasedAsset: For staking either LP or EYE to earn fate.
* burnAsset: earn much more fate through burning instead of staking
* successfulProposal: returns true if* proposal has been approved.
* KillDAO: for transferring to a new DAO.
* **approveFlanMintingPower: give minting power to an address. Uses allowance system like ERC20.**
* **transferOwnershipOfThing: for transferring any assets owned by DAO.**
* timeRemainingOnProposal: self explanatory
* **setProposalConfig: configure proposal rules**

## Limbo
### Properties
* CrossingConfig contains all the contracts needed for the migration. 
* souls are all the souls on Limbo. Notice that for each token, there's an array of souls because there's no reason a token can't be loaded twice. We always access the latest soul in the array.
* lastIndex keeps track of the latest soul for each token.
* UserInfo keeps track of the staking accounting for each user per token.
* tokenCrossingParameters. For soul, store the relevant metadata such as time started. Als the crossing bonus and initial crossing.

### Functions
* **attemptToTargetAPY: A dollar APY is used by this function to calculate a flan per second (fps) rate. Attempt speaks to the fact that the threshold and exchange rates are moving targets. Note: a daiThreshold value of zero means "ask behodler what the current threshold is"**
* updateSoul: updates aggregate rewards for a staking soul.
* **configureCrossingConfig: governance to calibrate migration.** migrationInvocationReward is the amount of flan issued to the caller of migrate in compensation of gas. crossingMigrationDelay is an enforced delay in migration to prevent flash loan attacks and rectInflationFactor allows the community to swell or contract the rectangleOfFairness in the event that SCX production is not optimal.
* disableProtocol: in case of emergencies
* enableProtocol: note that disable can be flash called but enable requires a proper proposal.
* **configureSoul: used for initializing a soul for staking**
* **adjustSoul: a lower risk calibration function for updating existing souls**
* **configureCrossingParameters: preparing a soul for crossing over into Behodler, including whether it is burnable or not**
* stake: deposit tokens for earning flan
* unstake: remove tokens from Limbo and receive accumulated rewards. Note that exit penalty reduces deposit by percentage. Any front end should provide this as a warning. Exit penalty of 100% means this soul can not be unstaked. 
* claimReward: withdraw accumulated rewards. 
* claimBonus: only callable after migration for compensating user for having staked tokens migrated. Note that this function can be called against old souls which is why the index parameter exists.
* claimSecondaryRewards: when a token receives a secondary income (eg. a pooltogether token earning a jackpot) or a rebasing token, we don't want these tokens to become stuck in limbo. This function uses the token to buy flan from Uniswap and burns it. A percentage is given to the invoker to encourage regular flushing. Only tokens that are not being currently staked or currently waiting for migration can be flushed.
* migrate: for threshold souls in waitingToCross state, migrate lists tokens on Behodler, adds them as liquidity, burns excess SCX and uses the remaining SCX to bolster the liquidity and price of Flan. Invoking user is rewarded with Flan because gas costs of migrate are high.

## Proposal (abstract base contract)
### Properties
* string description
* LimboDAO
* modifiers: onlyDAO allows the DAO to execute the proposal. notCurrent prevents accidental recalibration of a live proposal, undermining cast votes. This isn't mandatory so whitelisting proposal votes are encouraged to require this.

### Functions
* **orchestrateExecute: called by DAO to kick off execution**
* execute: virtual function to be implemented by concrete implementation. 

## ProposalFactory 
### Properties
whitelistedProposalContracts

### Functions
* **toggleWhitelistProposal: whitelists a proposal. Can only be invoked from a successful proposal. To resolve the chicken and egg problem, the constructor of ProposalFactory auto whitelists a whitelisting proposal.**
* lodgeProposal: the public entry point into proposal lodging. Callable by anyone. Invoker must have enough fate.


## UniswapHelper
### Properties
* modifiers: ensurePriceStability prevents functions from executing without updating the simple oracle. Note that oracle is simplified at the cost of convenience, not security. incrementBondingCurves increases the count of Behodler bonding curves on each migration. Flan's value target depends on this variable.
* onlyLimbo
* latestFlanQuotes: price quotes for FLN_SCX (uniswap), DAI_SCX (behodler), DAI balance on Behodler, block number of sample. This is the oracle.

### Functions
* blackhole: the location to which newly minted LP tokens are sent indefinitely.
* setFactory: only invokable outside of mainnet for testing purposes.
* setDAI: sets the DAI contract outside of mainnet.
* **configure: configures contract**
* generateFLNQuote: this function must be called twice before a migration is possible. The invocation must be spaced out enough that a miner can't brute force win two consecutive blocks to attack Limbo.
If the prices diverge too much, the migration will fail. Both the spacing and divergence tolerance are configurable through governance.
* minAPY_to_FPS: helper function used by Limbo to calculate fps from APY. Can be invoked by front end for assistance in calculations.
* buyFlanAndBurn: used by Limbo to buy Flan with a given token and burn. Harmless if called outside of Limbo contract.

## SoulReader
### Functions
* SoulStats: latestIndex, stakeBalance and flan per second
* CrossingParameters: returns most pertinent crossing parameters, exitPenalty, intitialCrossingBonus, bonusDelta, flan per second

## Flan
Implements ERC677 which won't be repeated here.
### Properties
* mintAllowance: an allowance per address for mintable flan. Setting this to uint max will make allowance infinite
* **setBurnOnTransferFee: Flan is by default not a burn on transfer token but this can be turned on to underpin price**
* **whiteListMinting: grant infinite minting power to address**
* **increaseMintAllowance: increase mint allowance for an address**
* mint: invokable by address with a positive mint allowance
* safeTransfer: transfer any amount without reverting on invalid amounts. Invalid amounts are just ignored.

## FlashGovernanceArbiter
### Properties
* flashGovernanceConfig: determines the type of asset used for flash governance, the amount required, the duration for locking and wether the asset is burnable. By default this is EYE
* security: prevents Karen attacks and changes that are too big
* pendingFlashDecision: For every flash decision there is an invoking user and a host contract. This records the salient info for that mapping so that security can be enforced.

### Functions
* assertGovernanceApproved: invoked by a modifier to check if the calling user either has enough of the flashgovernance asset to invoke or if the calling address is a sucessful proposal.
* **configureFlashGovernance**
* **configureSecurityParameters** 
* **burnFlashGovernanceAsset: when a user abuses flash governance, the community can burn their deposit**
* withdrawGovernanceAsset: once the dispute period has passed, an invoker of flash governance can withdraw their asset.
* enforceToleranceInt: optional helper function to enforce a maximum % change allowable per variable.