# Potential bug in FlashGov singleton pattern
The flash governer is set using a Singleton pattern on the Governable base class. Firstly, this wasn't being made use of in the assertGovernance function.
However, an upgradeability issue arises. If the DAO changes its flashGov object, every single governance contract would need to be notified which presents a security smell.

# Synchronous Time management
In the wargame tests, we're simulating reality including actual block times instead of the unit test friendly instant-confirmation approach.
Initially we used javascript's native timeout function but this slows things down. Hardhat provides a way of time traveling. So we're using that now.

# UniswapHelper
SCX fee was hardcoded. Now it's retrieved. 

# Limbo Migration
Upon writing this wargame test, it was revealed that when a limbo migration happens, a portion of the migrated tokens, equal to the burnFee on Scarcity contract, was deducted and sent to LiquidityReceiver. This creates the tricky situation where the first person to mint the PyroToken for that token would get that entire fee. The Morgoth power which is responsible for orchestrating the migration has been changed so that the flow is:

1. Retrieve current burn fee on Behodler
2. Set burn fee to zero
3. Migrate new token
4. Reset fee to original amount

This means that the entire token set is migrated and the PyroToken is initialized with zero reserve. The above steps happen atomically so that no shenanigans are possible.

# Configure Scarcity Power
A Morgoth power invoker can only operate on one ownable contract at a time. This contract is known as the domain of that power. For instance, SetLachesisPowerInvoker's domain is Lachesis. If a power invoker needs to change 2 domains in one transaction, a new power invoker can be created. The outer most power invoker is then made a minion on Morgoth and the power to invoke the innermost is poured into the outer. For the LimboAddTokenToBehodler power invoker which migrates a token, the domain is lachesis. However, it now needs to first set the fee on Behodler to zero. So it has been given the power to invoke ConfigureScarcityPower. 
By default powers on Morgoth are use once only contracts. However, some powers need to be invoked repeatedly such as the migration power. We don't want to deploy a new contract on every migration. For this reason, the IdempotentInvoker base contract was created. Since ConfigureScarcity is now called on every migration as well, it has been changed to an Idempotent power invoker.
TODO: we need a flow chart in the docs for Morgoth decision making logic.

# DeploymentScript
The wargame test is now acting as a kind of integration test that does the whole schpiel of the Behodler Ecosystem in one test. This means that the oracle is made of use. In order for the Oracle to function, the token pairs have to have initial reserves and to have been traded against at least once. This is all added in the deployment script.


# Next steps
1. Save dev state and handover state to UI dev
2. Flesh out Flan genesis logic in deployment script
3. In parallel with 2 (ie. UI dev does this), launch PyroTokens3 with migration.
4. Limbo Testnet
5. In parallel with 4 (flesh out some Limbo Proxy examples to help UI dev)