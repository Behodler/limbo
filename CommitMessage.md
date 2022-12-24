# Deployment Script 
A very adaptive deployment script has been created for deploying the entire ecosystem to any chain. If an ecosystem is partially deployed such as with mainnet, a config file exists which can be populated with preexisting contract addresses. The script then skips.

## Not completed in this commit
1. Flattening the list of addresses for the UI dev(s)
2. Saving deployed dev state to a file for UI projects to just "spin up" behodler on demand
3. Adjusted wargame tests to use new state

## For future
In this version, Flan was created, deployed and Behodler was prepopulated with some Flan. Once it's complete, the state and ABIs can be handed to the UI dev. Then I can replace the simple Flan logic with Flan Genesis. It's likely that instead of being a separate ceremony, Flan Genesis will now simply be one of the many functions invoked in the script.

## TODO for testnet deploy
1. Change dev_evn project to use new hardhat state
2. Assist UI dev in getting PyroToken UI out the gates
3. Stress the team immensely by orchestrating PyroTokenV3 migration (RIP Josh).
4. While that's going on, cleaning up and assisting UI dev in getting Limbo UI ready.

## Contracts still to be written (not required for mainnet launch)
 SecondaryRewardToken. This isn't complicated and is very similar to existing PyroTokens but it will be needed before we can list crv or cvx pools, for example.

## To consider before mainent launch
 Possible simultaneous deploy to Polygon or an L2. However, the Scarcity linking needs to be carefully approached
