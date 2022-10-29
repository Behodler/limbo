Last updated Oct 29 03:56
# UniswapHelper
Removed unused variables
Stop update from reverting on too recent an update to prevent migration griefing

# LimboOracle
Added helper function for front end token sorting

Removed old deployment files

# common.ts
Static typing of address accumulation for reduced errors
deploy function easier to use

# deploymentFunction
Added oracle deployment and liquidity adding and trade on all necessary pairs
Statically typed everything

# orchestrate
Updated to comform to new requirements of deploymentFunction

# tests
changed ABIs requires changes to compile and pass
corrected some assertion logic

# final words
The deployment script has been generalized to work across all networks so that we can go to mainnet, polygon, testnets etc. But it needs to be verified that it can handle mainnet's existing contracts.