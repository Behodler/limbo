# Culled code
In LimboDAO, there was an address for Fate in domainConfig. Fate has no address. This was removed.
In Limbo and in UniswapHelper, there is a helper function for estimating FPS from a given APY. This type of help should either be on a stateless contract in the periphery or on the front end but does not belong in a business logic contract, especially given the gas costs of carrying deadwood code in Ethereum.

UpdateMultipleSoulConfigProposal relies on the minAPY_to_FPS pure function in UniswapHelper. It was moved directly into the proposal contract.

# EcosystemDeployment.md
Remaining work: 
1. Flan Genesis.
2. Putting it all together.