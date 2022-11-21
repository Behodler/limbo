# Introduction
Many tokens in DeFi earn a secondary reward token, usually a governance token. For instance, the pool tokens in Curve earn the CRV reward token. Convex then compounds this architecture. This model may be the most dominant reward mechanism in DeFi since it creates an automatic flywheel of demand for the governance token which is attractive to funding third parties. The issue of whether tokens earn the reward directly to a holder's wallet or staking is required is irrelevant since any permissionless staking mechanism can be tokenized. For instance, if we wanted to list Sushi Onsen pools on Limbo, we could just create a tokenized version of Onsen pools and list those.

The token reserve would then earn all the Sushi. On the other hand, if a token already exists, such as with Curve, the holder earns the reward token. In this article, we don't consider tokens that compound balances through rebasing. We specifically want tokens that earn rewards paid in other tokens. 

We wish to know how to handle these tokens in Limbo and Behodler. It would not be ideal to simply ignore these rewards.

### Reward distribution
In Limbo secondary reward tokens (SRTs) have the following problems:
1. If we tokenize a staking pool, what happens to the reward tokens that accumulate in the reserve of the wrapper? For instance, if we create a tokenized version of an Onsen pool in Sushi, how do we claim the Sushi rewards and where to where do they flow?
2. If we list an existing reward earning token such as a Curve pool on Limbo, we face the problem that the Limbo contract earns the reward rather than the staking user. There is no on chain accounting mechanism to then fairly distrubute these rewards. So the holder of a Curve pool would then have to choose between earning CRV or Flan. Economically this means Limbo would have to offer higher Flan rewards to compensate for the opportunity cost of forgone CRV. It would be desirable if the rewards were additive. Then Flan could be the cream on top and would place Limbo in competition with Convex. Indeed Flan could then be offered on top of Convex rewards so that a hierarchy of reward tokens accumulates to a original holder. 

## Initial Solution: ClaimSecondaryRewards function
The initial solution put forward in code was a bit of a place holder. Essentially, the decision of what to do with accumulating secondary rewards was to just leave it to governance. A function on Limbo which can only be called by a proposal allowed for withdrawing any token not currently listed for staking on Limbo.

This function didn't account for subtle nuances such as those elaborated in the previous "Reward Distribution" section. It was potentially vulnerable to security pressure and so was ultimately removed.

## Token Proxies
Now that token proxies have matured into a complete system, we have a potential mechanism for capturing secondary rewards for holders.

### First Pass: 2 redeem rates.
The simplest solution would be to have two (or more) redeem rates, one for each token. For example, if we have TriCrypto earning CRV, we could have a proxy token which has a reserve of TriCrypto (henceforth TC) and CRV like a kind of double PyroToken. As CRV rewards roll in, the redeem rate for the CRV portion increases.

Suppose we have a proxy wrapper called TriState that has reserves currently of 100 TC and 10 CRV and that 200 TriState have been issued. This implies redeem rates for TriState of

```
CRV: (10/200=)0.05 and TC: (100/200=)0.5.
```

In other words, 1 unit of TriState will redeem 0.05 CRV and 0.5 TC.

Suppose the reserve of 100 TC earns 5 CRV in rewards. The new redeem rates are are now

```
CRV: 0.075 and TC: 0.5
```

### Second Pass: Only a reward redeem rate

Indeed it appears the base token (TC) does not change relative to the TriState supply and so can be fixed and arbitrary. We may as well set it to 1. Then there's only one redeem rate for the reward token.

The problem comes in when someone wants to mint TriState. Since there are 2 reserves and 2 redeem rates, minting would require supplying both the reward token and the base token, not in proportion of their market price but in the proportions that they appear in the reserves.

This is strange for someone who initially simply wants to accumulate rewards on TriCrypto. The purpose of proxies is partly to simplify Limbo usage. The use case we're aiming at is someone staking TriCrypto on Limbo. Under the hood, it is wrapped as TriState and staked in Limbo to earn Flan. Then on unstaking, they receive all CRV rewards and Flan.

If we introduce the requirement to supply CRV in order to stake TriCrypto, it breaks the abstraction and creates an unpleasant user experience. If we introduce an extra step which sells some of the base token on the open market for the correct amount of CRV, we could solve the problem but then the staking user would be subject to much higher gas costs and potential slippage on an AMM which is not a trivial thing to be swept under the hood. 

### Third pass: Global claim on incoming rewards and one redeem rate

If we wish to avoid having two tokens and all their attendant complexities, we can instead have a public claim function that anyone can invoke. It claims all pending CRV rewards for the entire TriCrypto reserve pool and then, using Curve's TWAP oracle, swaps the rewards for the base token and deposits the base token into the reserve, boosting the redeem rate.

As an example, Suppose we have ProxyTRI which is a proxy wrapper for TriCrypto. ProxyTRI holds 1000 TryCrypto and there are 1000 ProxyTRI in supply, making the redeem rate 1. The price of CRV is currently 10 CRV to 1 TriCrypto. The reserve accumulates a pending CRV reward of 20 CRV. Someone triggers the claim function and the 20 are swapped out for 2 TriCrypto which are added to the reserve. The redeem rate has now risen to 1002/1000 = 1.002.

The caller of the claim function could receive a small percentage of the reward in order to incentivize regular claim invocation. This mechanism can be generalized to multiple reward tokens such as with Convex finance.

The benefit of this approach is that it autocompounds the TriCrypto pool. If a competitive market APY is 10% and the result of compounding creates a 5% APY on TriCrypto then Limbo need only reward 6% APY in Flan minting in order to beat the market. In the absence of this reward capture, Limbo would have to mint at a rate of 10% APY or more. So this mechanism reduces the inflation of Flan.  

Once migrated to Behodler, PyroProxyTRI would experience redeem rate growth from both CRV inflows and regular PyroToknen mechanisms.

# Not covered in this article.
Curve and Convex both offer reward boosting for locking. It isn't clear exactly how that would work here but if it can be shown that locking boosts the remaining token base then the public claim function could always be written to auto lock some portion of rewards. The point is that we can implement functionality on a per protocol basis as needed. The proxy infrastructure already accomodates upgrades so if the base protocol changes, migration can be seamless.