# Morgoth Token Approver
Fully tested. 
Functionality:
On Morgoth, there's a power called ConfigureTokenApprover. It gives the ability to configure the token approver and requires a new power to be conferred to the desired minion. In this test, we're assinging the power to a new minion and so functionality of Morgoth is tested here as well. This constitutes a partial integration test.

The following avenue exist for the community to list new tokens on Limbo:
1. Propose a token which is whitelisted by MorgothTokenApprover
2. Wrap any token which isn't blacklisted on MorgothTokenApprover
3. Perpetual tokens are all fair game. This means that if a user stakes in a perpetual token pool, they should beware of evil tokens. It is as permissionless as Uniswap but requires a proposal to pass.
Thought: I wonder if proposers should be required to stake EYE which the community can burn like with flash governance. In other words, intentionally bad proposals can be slashed.

# EIP 170 strikes again 
Some deadwood code was cut away from LimboDAO because of that annoyingly arbitrary EIP 170
Tests fail which rely on it. What was a helper method on LimboDAO has been moved into the tests as an in test helper function