Last updated: November 8
# FlashGov security
If the lock time for a flashgovernance EYE deposit is less than the proposal voting window then there is no risk to malicious flash governance decisions. This commit now enforces in code that if the voting window is changed on LimboDAO or if the lock time is changed on FlashGovArbiter that this desired rule is enforced.

It is recommended to make the lock time many multiples of the voting window but this recomendation is not enforced in code.

Files changed:FlashGovernanceArbiter, LimboDAO, proposal tests.

# Deployer Snuffer Cap
On PyroTokens, the snuffer cap is an authorized contract which controls whether fees apply to addresses. For instance, if we have proxy wrappers of PyroTokens, we don't want FOT applied every time wrapping and unwrapping occurs. DeployerSnufferCap is a temporary snuffer cap to give deployment scripts authorization to snuff at will. As soon as tempConfigLord in LimboDAO is disabled (permanently), this snuffer cap stops working

# EcosystemDeployment.md started
I can't express how valuable this document has been in preventing bugs and attacks. DocumentsAllTheWayDown

# CliffFace logic fixed
Fixed marginal redeem rate bug

# MorgothTokenApprover
Fleshed out logic for the token approver. This contract, controlled and owned by MorgothDAO whitelists and blacklists tokens for Limbo. When a token is proposed, it is run by the token approver. At first this is centralized in the team but it will gradually be outsourced to some source of truth Kleros type mechanism. However, we don't want short term centralization to ruin the party so there's a way for anyone to propose any token:
MorgothTokenApprover will wrap any token as a CliffFace proxy. Proposals on Limbo will then pass if the token they're proposing has either been whitelisted or has been proxy wrapped by the token approver.
Still a little testing to be done but once the testing is complete, this will see the fulfilment of a vision long in the planning which makes Limbo both safe and decentralized and allows for a Curve Wars style market to emerge where EYE is stacked by big players in order to have their token listed on Limbo.
Perpetual tokens can be listed on Limbo without much restriction but if they're FOT or rebase, they should be wrapped as a LimboProxy first. If they're not, the end user will lose funds staking. It will be up to the community to warn against such pools, to disable pools through voting or to design the UI to hide such pools. Onchain censorship will not be written as these pools don't threaten Behodler.

# Mixed Solidity.
A real version of the ecosystem for testing and deployment has been created. The Morgoth section uses an old solidity and, thanks to hardhat, this side by side compiling is tolerated, provided there are no code dependencies. I haven't gotten around enforced bytes32 padding. Morgoth will definitely need to be re-written at some point to both simplify and incorporate experience gained since its initial deployment. This would also provide an opportunity for an audit.

# TokenProxy expanded to support decimal places less than 18
We can now support unusual decimal places such as with BTC wrappers. However, the resultant proxies will be 18 decimal places. Eg. $1 of proxyUSDC will be 10^18 units. When unwrapped it will yield 10^6 units of USDC. (to community: please don't list centralized stablecoins)