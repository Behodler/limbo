# Update Proposal Grief factor

The update proposal's parameters are not cleared on execution. This would create a griefing factor for LimboDAO. It's critical but the type of bug that would be quickly picked up in public testnet.

## Testing For Public Testnet

We need to test all the griefing angles possible on proposals once on testnet. For instance, listing so many tokens that the for loop dies. It might be worth changing the base Proposal contract to call via the low level call approach to avoid reversion so that we can create the equivalent of a *finally* block which performs cleanup.
Then each proposal can specify cleanup or leave it empty.

For C# devs, this would be a little like the IDisposable class invoked in a *using* block.

Once PyroUI is launched, I must look into getting this right. Now's your chance to create that list of stress tests to perform on testnet, Wiggum (insert harald emoji)

### Reflections on testnet

While economic theories can't really be stress tested on a testnet, malicious behaviour can be thoroughly examined. It's interesting to note that many dynamic, subtle interactions created by bad actors have been missed in the audits but will become obvious in testnet. To any devs out there, audits are not enough! In fact, if you put a gun to my head and told me to pick between audits and public testnet, I think I'd pick the latter. With enough run time, all issues can be picked up in a testnet. Having said that, GPT-5 powered audits may be a game changer in the future.

## For Justin

Need to either redeploy this part of sepolia testnet or redeploy entire testnet (insert many haralds). The latter is quicker but will sadden the UI dev a bit.

### Unit Test updates

In a previous commit, some strings referring to contracts were given clearer names but these changes were not correctly propagated to the tests. This has been fixed.

## LockUntilComplete modifier in Proposal base contract

This modifier serves as a great entry point to prevent griefing attacks and adding a condition gives that much more flexibility to fight off the grief bots. For instnace, in MultiSoulUpdate proposal, one grief vector is to lock the proposal with zero tokens, forcing the community to vote on a dud proposal. This attack is almost costless to the attacker but it costs the DAO a great deal of time and slows down Limbo listing (grief). I've added the requirement that locking can only happen when the list of tokens is at least 1.
