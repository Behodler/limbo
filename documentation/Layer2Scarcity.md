# Unified Liquidity: How to Scale Behodler to many layers.

# Introduction 
It's tempting to think that the best way to scale Behodler is just to replicate the ecosystem with a deployment script so that you have Behodler, Limbo, Flan, PyroTokens and Morgoth clones across each layer.
However, this is not ideal for many reasons. Firstly, most projects have a token that is wrapped on different layers. Behodler, on the other hand, is a token, Scarcity. So if you simply clone Behodler across layers, you'll have multiple versions of Scarcity floating about, all with independent prices.
Similarly, since Flan liquidity is provided by Scarcity, you'd have to have multiple versions of Flan.
There is a way to have one true Scarcity (and possibly one true Flan) across all layers. This approach would bind all liquidity across all layers so that Behodler would have one massive collection of liquidity spanning many layers. It would constrain the supply of Scarcity while massively multiplying systemic TVL which would be excellent for the Scarcity price and for Flan stability. What's more, this approach would require very few code changes.

This paper charts the idea in it's current iteration

## Limbo Refresher
When a token is listed on Limbo, flan issued for deposits like a traditional yield farm. When the token TVL surpasses a threshold, staking and unstaking are locked. The token reserve is then migrated to Behodler as a deposit which generates Scarcity (SCX). This SCX is then paired with newly minted flan to prop up the liquidity of Flan. This migration process is what gives Flan its enormous stability and liquidity which allows for future funding of tokens. 
Each migration from Limbo to Behodler creates new SCX. Around 600 or so units of SCX are produced per migration. 

## Layer 2 proposal

### A small tweak to Behodler AMM
Suppose we launch Behodler on Arbitrum. We deploy the Behodler AMM and Limbo. Limbo issues an arbitrum version of Flan. For now, we don't concern ourselves with the relationship between this Flan and main net Flan.

Unlike the Behodler on mainnet, Behodler Arbitrum cannot issue SCX to token deposits. Rather there is one white listed token which can be deposited to produce SCX. So if we set the special token to Dai then only Dai can be deposited to produce SCX. This SCX is a new type of SCX. It has a different contract address to mainent SCX. 

We create a wrapper token on Arbitrum for porting across mainnet SCX. So you deposit SCX on a bridge on mainent and you are issued this wrapper SCX on the Abitrum blockchain just as you do with other tokens currently.

Let's call this wrapper of mainnet SCX on Arbitrum Scarcity Prime (SCX_p) and the version of Scarcity issued by Arbitrum Behodler Scarcity L2 (SCX_L2).

On Arbitrum Behodler, we set the special white listed token to SCX_p and the exchange rate is always 1:1.

In other words, depositing a unit of SCX_p on Behodler Arbitrum will produce SCX_L2. So we do away with all that logarithmic minting. Instead, SCX_L2 is just a 1:1 wrapper for SCX_p. This means that the market price of SCX_p is identical to mainnet Scarcity for the same reason that WETH has the same price as Eth.

Other than that, trading is the same. Suppose we deposit 400 SCX_p on Behodler_Arb and then we list Dai for Trade. In order to get the Dai out, we'd redeem it using the same logarithmic redemption logic of mainnet. The SCX_L2 supply would then decline just as it does on mainnet. If we deposit Dai, we cannot mint SCX_L2 and we cannot swap out SCX_p. So in order for there to be swapping, there has to be more than 1 token listed on Behodler_Arb. 

So to summarize, SCX_L2 can be used to redeem liquidity but SCX_L2 can only be minted by depositing SCX_p. 

### Small tweaks to Limbo.
Limbo mainnet mints new SCX on migrations. On Arbitrum, Limbo would perform a swap instead. So suppose we list Aave on Limbo Arbitrum and raise a portion of Aave. On migrate, the newly listed Aave would be swapped in to Behodler Arbitrum for SCX_P. So instead of minting new SCX_L2, SCX_P would be swapped out. The swap would not be priced according to the xy=k rule. Instead, it would have a fixed exchange rate. So a threshold pool would have 2 parameters: the crossover number and the SCX exchange rate.

```
Eg. we list Aave and set the crossover to 2000 Aave with a rate of 1.2 SCX per Aave. In other words, once 2000 Aave has been raised, it is swapped out for 2400 SCX_p.
``` 

This SCX_p is then combined with Flan in an LP token (Uniswap Arbitrum) and used to raise Flan liquidity on Arbitrum.

# Implications for Scarcity
Since SCX_L2 is a wrapper for SCX_P, the amount of SCX_L2 locked in Behodler need not be limited. For regular tokens, the amount of liquidity locked per token is equal to the average TVL (AVB). In other words, if Behodler Arbitrum has 10,000 Dai then if we list a token that is priced at $10, we will lock 1000 units. However, SCX_P is just minted like Weth so if the SCX price is $100, we can lock 5000 SCX_P if we wish without unbalancing things since the SCX_P in Behodler_Arb cannot be swapped out.

Since SCX_P is swapped out of Behodler, part of the capitalization of SCX_L2 is diversified into the new token listed. Eg. If we mint 100 SCX_L2 with 100 SCX_P and then list 1000 Dai with a price of 1 Dai = 0.05 SCX then Behodler_Arb will now contain 50 SCX_P and 1000 Dai. If we redeem SCX_L2 for SCX_P, we can only redeem 50 units. The rest will have to come from the Dai.

This means that if we wish to list new tokens on Abritrum, we have to have at least AVB worth of SCX_P locked. We can achieve this by having occasional Limbo migrations of new SCX_P for Flan.

This would mean that in order for new liquidity to be brought into Behodler Arbitrum, we'd have to bring SCX minted on mainnet across. Liquidity growth on all the different layers would then drive liquidity growth on mainnet Behodler indirectly. This would boost the price of SCX on mainnet Behodler which would then leak into the other layers by supporting the liquidity of Flan.

This also means there will be one SCX across layers and one SCX price which is essentially priced on mainnet. It will unify liquidity across all layers.

For instance, suppose Polygon Limbo wants to lists 10,000 MIM and the SCX price is $200.
 
Polygon Limbo first lists a pool for new SCX_p of 50. Stakers go to mainnet and deposit tokens to mint up 50 SCX which they then wrap into SCX_P. The act of minting 50 SCX on mainent raises the price of SCX to $210.

Limbo deposits the $210 of SCX into Behodler_Poly and mints no new SCX_L2. We then list a pool for MIM and on success, only 47 SCX is swapped out of Behodler_Poly, leaving a net gain of 3 over the initial price expectation. This 47 is then used to boost Flan liquidity on Poly.

Because the SCX price has risen, Flan's liquidity across all the other layers (Arbitrum, Optimism etc) have all risen automatically.

In this way, growth of liquidity on one layer rises the tide for all the other layers. This seeks to unify liquidity across all of Behodler into one big pool. It also means that for every dollar of liquidity growth, there will be less SCX minted than if we only have Behodler on mainnet.

# Implications for Flan 
Flan will be priced according to the same metric as on Mainnet. So if we're targeting Dai on Mainnet, we'll target Dai on Arbitrum. In addition, Flan is capitalized by the same version of SCX across layers. This means that while the token contracts are different, Flan mainnet is likely to trade 1:1 with Flan Arbitrum with high levels of liquidity. And so they can be treated as essentially equivalent tokens.

While there is minting of Flan to raise the intial SCX_P, this essentially means twice as much Flan per unit of incoming liqudity is minted on L2. However, the current design on Limbo mainnet is that more than 10x liquidity comes in for every unit of Flan. So the net result to Flan liquidity is still positive and this doesn't even factor in the positive impact this entire scheme will have on the SCX price.

I'm not sure wha to name this strategy. Contenters include:
1. Unified Liquidiry
2. Super Scarcity
3. Full bodied Flan