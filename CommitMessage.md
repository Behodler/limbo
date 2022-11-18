# Limbo.sol
## Attack vector opened by perpetual leniancy
Suppose we have a token listed as perpetual and want to list a token as threshold. If we bring perpetual staking to a close (new state added to SoulState enum), then we can propose a new round of staking for a threshold version. The problem is that in migration logic, the entire balance of the token on Limbo is migrated which would steal all the perpetual tokens not yet unstaked. 
Soul now has an aggregateStakedBalance for migration logic so that perpetual pools are left unaffected.
This technically allows for having the same token in staking state multiple times concurrently. However, this isn't permitted simply to protect Limbo from griefing or unforeseen attack vectors.

So for now the governance flow for transitioning from perpetual to threshold must be:
1. Change latest token state to perpetual terminated
2. Set higher index to threshold

New tests have been added to limbo.test.ts and some static typing has been added to assist with speed of testing.