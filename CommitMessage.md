# New Morgoth Power: RefreshTokenOnBehodler
When running against a test network, the deployment script creates new tokens for trading on Behodler and approves them on Lachesis. However,
the tokens are not updated on Behodler. 
A new morgoth power simply refreshes Behodler to be in sync with Lachesis

# Gas measurement in next commits.
Some gas measurement code will still be coming on this branch but the PR is so the UI dev can proceed without bugs in testnet.