## DeloyerSnufferCap Limbo dependency removed

Originally when the deployment script was written, it was envisaged as just necessary for deploying to testnet. As the robustness and flexibility of it grew, it became the gold standard for granular ecosystem deployment in Limbo for all chain deployment. There's a contract called deployersnuffer cap which gives the deploying user admin powers to set which contracts can be exempt of pyroToken fees. This power should only be enabled during the deployment phase and should expire thereafter. To achieve this, the contract looks at Limbo which keeps track of whether the contracts are currently in configuration mode or live.

### PyroToken V3 complication

Now that the script is going to be used to add PyroTokensV3 to mainnet, the deployer snuffer cap will need to not have a Limbo dependency. However, the admin powers should be set to expire. It's tempting to add a block timeout or a timestamp timeout but this may need to be uneccessarily long to accomodate a long running deployment script. Instead, a function will be made public that kills the contract. Only the deployer can call it to prevent malicious griefing. This means that between PyroTokenV3 being deployed and Limbo deployment, it will still be enabled so that when Limbo arrives, it can be auto exempted and then disabled.
The community is encouraged to vigilantly watch for this disabling. If it isn't disabled once Limbo is live AND the team refuses to disable it after the issue has been raised then the community can consider this a red flag that the Behodler team is up to no good (I would watch CryptoCat. You never know with him).

## Synchronous testing
Previously the hardhat config file had to be altered to allow for running syncrhonous code in tests. The deployment script is synchronous so one would have to turn this on and off manually depending on the test being run. Now this is done programatically so that the default is instant mining (the hardhat default) and tests that require synchronous mining can turn that on by executing the code inside the runSynchronously function.

Synchronous execution doesn't fail on reverts which requires a lot of logging. Now that tests run on automine again, we can remove logging and allow for revert failures. This has identified a bug in the RegisterPyroV3 contract which has been corrected. This bug would not have caused any loss of funds on mainnet but would have necessesitate a redeploy of a lot of contracts which would cost money.

## Funding, user gas concerns and L2 strategies

I shudder to think of the gas costs of running this against mainnet. Testnet deployment will give a gas number which we can then convert to dollars using current gas price. Hopefully it's less than $100 billion. I wonder if we should deploy to L2s first, thereby circumventing all gas concerns around Limbo and CliffFace usage as well. The GUL strategy would ensure that an L2 first approach would still boost the liquidity on mainnet (and thereby the SCX price) and mainnet EYE would still be used to govern L2 LimboDAO so there'd be no risk to mainnet holders in terms of price performance but we could delay mainnet deployment until we can pay for it with Flan. If we start on L2 and indirectly boost Behodler L1 liquidity then L1 gas costs become no longer concerning. L1 Behodler could be a clearing house where really big transactions take place so that high gas costs consitute only a tiny fraction of the transaction cost. But every day users would immediately get access to a nice L2 experience from day 1 of Limbo, rather than promising the community L2 one day.

### A trip to the Zoo

The benefit of ZooDAO on Moonbeam is that they have a need for both native yield generation from external sources and liquidity. If we list Zoo, Zoo/DAI, Zoo/SCX and Zoo/Flan on MoonbeamLimbo (Limbeam?) then they'll get a boost in liquidity and they can allow user deposits of Zoo to go into PyroZoo. We can exempt the contract which deposits Zoo into PyroZoo from redemption fees (feature of PyroV3) so that there's no risk to the Zoo protocol. If Flan does well, they can replace the part of their code which points to Dai with Flan and PyroFlan would be the source of "Dai" yield. There's a ready made contract in the Limbo repo which can turn on a stream of Flan to the PyroFlan reserve, guaranteeing a minimum APY. Obviously we want some Flan liquidity before doing that but you can see from this thought experiment how a deep Zoo integration into the Behodler Ecosystem can benefit Zoo.

**Perks for Behoblins:** We could write a proxy contract which works this way:
when staking 1000 units of Zoo/Flan, Zoo/EYE or Zoo/SCX on Limbo, you're issued an NFT which is elligible for Zoo battles. Holders of the NFT are airdropped Zoo tokens or something like that (depending on what the Zoo community would like as an incentive to send Zoo to the Behodler Ecosystem). Even if the incentives to Behoblins directly are zero, the indirect boost from deep integration of Zoo into Behodler Ecosystem would directly help the protocol tokens (EYE/SCX/Flan) and would be a marketing device in that other dapps wanting to benefit from the fruit of Limbo could approach the community.
Then all we need is that market for governance dapp to be deployed and we have Convex like incentives for holding EYE.


## Steps to testnet

1. PyroDeployment to mainnet (script is ready to go. I may trial this on a testnet in private to be sure)
2. PyroToken migration UI (remind me to tell UI dev that the interface for approving base tokens on migrator needs to be part of the popup in a way that isn't pain)
3. Allow Arren to run dev env locally
4. Some drama
4.1 A whale in the community who doesn't read these commit messages complaining that there's no progress being made and threating to dump.
4.2 Other behoblins salivating at a buying opportunity just before testnet deployment.