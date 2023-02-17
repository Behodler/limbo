# Intent

This commit message at the outset is to set my intentions correctly and, hopefully, if there's an omission in my thought process, someone will show the merciful kindness of pointing this out.

## PyroToken Holder Risks

Unlike Limbo, PyroTokens V3 will not be trialed publicly through a testnet branch before being deployed to mainnet. However, the testnet for Limbo will include a complete, working version of PyroTokens V3.

The holder of Pyro V2 can migrate to V3 the moment it is deployed to mainnet. However, if you have a great deal of funds and wish to experience maximum safety, it is recommended that you wait until after Limbo testnet has been out for some time (and better yet Limbo is on mainnet). If a missed bug or exploit is discovered in Pyro V3 that locks or loses user funds, a fix can be trialed and deployed to the Limbo testnet. But there will be a period during between Pyro V3 launching and Limbo testnet being deployed. During that period, no replacements to the Pyro V3 contracts will be deployed. 

If, however, the Pyro V3 code is without fault then the risk to the cautious holder is an opportunity cost: revenue on Behodler will begin flowing to V3 and no longer to V2.

**Let the warnings in this document be circulated far and wide. In the event of an unforeseen hack or bug, let no one complain about lost PyroToken funds. The maximally cautious holder will wait either until it's clear that PyroToken V3 is safe or until a replacment with bug fixes has been deployed.**

## Plan for this branch

We want to take a state of blockchain similar to mainnet and deploy PyroToken V3. This means we

1. Deploy the Liquidity Receiver and Migrator
2. Point Behodler to the new Liquidity Receiver (through Morgoth)
3. Deploy PyroTokens for every PyroToken traded on mainnet.

This means we need to customize the deployment script further. The SectionsToList array in common.ts is a recipe for deployment. We need two additional recipes which will deploy the contracts up to the state of current mainnet and deploy PyroTokens on top of that existing deployment respectively. We will also need a new prechecks function for whether Melkor is the one executing. This will save on wasted gas. The following changes are necessary:

1. Rename SectionsToList to something more specific like TestnetRecipe
2. Write a recipe for deploying Behodler up to the current state.
3. Write a prechecks function for asserting that Melkor is in command. 
4. Write a recipe does everything PyroTokens V3 needs, starting from the current state of Behodler
5. Unit test all of that.
6. Run script against a real testnet (sepolia).
7. Deploy to mainnet and feel that awful dread feeling. You know that feeling when you have a bunch of things to remember when leaving the house and you think "I hope I didn't forget something"? Now multiply that by the net worth of your community, compress it into a the size of grenade and insert it into your heart. That's what running a mainnet deployment feels like. Pray for me, please.