# Flan Genesis

Flan Genesis in the deployment script is complete. The reference pair as well as some important oracle pairs are filled with liquidity.
Limbo can now reward staking sustainably.

**This concludes the deployment script logic fleshing out. On the contract side, Limbo is ready for testnet.**

## Other changes in this commit

### common.ts
Prechecks section added to ensure deployer has sufficient tokens so that no gas is wasted for silly reasons.
PyroFlanBooster is disabled because it is not currently compatible with cliffFace

## Final steps before testnet

1. Assist UI Dev in readying PyroToken UI
    - Migration script hooks
    - Handle CliffFace dynamics. Specifically, the end user must not be aware of cliff face intermediaries in PyroTokens.
    - Adjust Swap UI to be cliff Face ready.
2. Write brief audit report (this may just be links to issues with links to pull requests)
3. Adjust testnet UI for proxies and new oracle simplifications.
4. Deploy to testnet and ensure that LimboDAO can be used in absence of formal UI without causing internal screaming.

## TODO after testnet is live (in no particular order)

- Alter PyroFlanBooster to be CliffFace friendly.
- Create LimboDAO UI
- Deploy to mainnet
- Write and audit Market for Fate (MF) contract
- Write UI for MF
- Deploy to L2 and persue Grand Unified Liquidity (GUL)
- Send Woodsman onto live talkshows to promote Behodler
- never announce new projects but simply work on them so as to avoid the accursed WEN
- fully decentralize MorgothDAO so that I can take time off for the first time in 3 years