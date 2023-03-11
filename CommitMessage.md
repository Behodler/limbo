## Entire Behodler Ecosystem Deployed successfully to Sepolia
This was a dry run to guage gas and to test the deployment script against a live network for the first time.
Deploying to EVM networks is a very risky process. A slow note or choked up network can cause a script to fail, forcing the process to restart. This can be enormously costly when using real Eth. As such, the deployment script was designed to patiently approach each network and record not only the contract addresses but whether those contracts are correctly calibrated. It's not good deploying Behodler and thinking you can move on when in fact Behodler failed to be calibrated. 

The deployment script first records the contract and then signs off on whether the contract is configured. Suppose the script crashes after deployment but before configuration. The next time it is run, it will load up the existing contract and attempt to configure. This adds a certain atomicity to the deployment operations.

### CAUTION WEN LORDS (Prudence, seigneurs de quand)
Please understand what this does and doesn't mean. Although the testnet contracts have been deployed, the testnet UI is not ready for release. As much as we welcome enthusiasm, please know there are more steps ahead. Anyone who tries to sell the idea that testnet UI is going to be released in the next day or 2 is trying to pump their bags.

## Next Steps
1. Test status quo deployment on Sepolia (same contracts as mainnet currently)
2. Test deploy PyroTokens V3 on top of status quo on Sepolia. Estimate gas costs for mainnet.
3. Run Pyro UI against sepolia, go through all the use cases such as migrating etc.
4. Make sure Pyro UI can jump back and forth seamlessly between mainnet and sepolia. This allows the community to play with fake PyroV3 before committing to the real thing. It also means adding L2 is trivial.
5. Deploy to mainnet.
6. Update LimboUI to accomodate new ABIs (warning to users: the UX may be a little clunky at first. Eg. button clicks may not be accompanied by twirly gifs or become suddenly disabled without explanation. Please save your complaints. We just want to get the UI out first before polishing it.)
7. Make sure LimboDAO on Sepolia is manageable

I suppose, on reflection, after writing the above list, we are actually pretty close. 

*In this fallen age, the sons of DeFi worship at the feet of golden bulls and DAOs are managed by deities of child sacrifice. A fire of purifying burning is coming for the idols of Mammon as the Canaanite gods of Ethereum are cast into Limbo once and for all.*


### Other miscellaneous change: pausing vs waiting
Async pausing function removed since it relies on some hardhat specific code. Instead we just set a block wait period which can be ignored by local testnets. This is more in line with best practice.