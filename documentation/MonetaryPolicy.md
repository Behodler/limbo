<h1 style ="
text-align: center;"> The Monetary Policy of Limbo </h1>

## Introduction

When a new token is listed on Behodler, it requires an initial reserve equal in value to the average value of the reserve of every other token already listed. This prevailing average reserve is referred to in Behodler circles as the average value bonded (AVB) and is calculated by taking the total value locked (TVL) and dividing by the number of tokens listed.

*If Behodler has a TVL of <span style="display:inline;clear:none">&#36;</span>120,000 and there are 6 tokens listed then the AVB is <span style="display:inline;clear:none">&#36;</span>20,000.*

When a new token is seeded with reserve liquidity equal to the AVB, the price of the token will reflect the market price. If this isn't accomplished, an arbitrage exploitation will occur, most likely by an Ethereum block validator, to correct the price. The value taken by the validator will be mirrored by impermanent loss experienced by Scarcity (SCX) holders. However, the curvature of Scarcity amplifies the damage when the seeded quantity is less than the AVB. Because marginal SCX minted declines with increasing AVB, the value of the SCX minted by the validator will allow that validator to redeem more than the difference between the AVB and the new token reserve. The net result will be an even bigger negative shock to the value of SCX than had Scarcity minting followed a linear trajectory in line with prevailing LP token minting algorithms. The bigger the difference between initial reserve and AVB, the more this proportional impact magnifies.

```Note that this does not imply that a flash loan attack can mint up large swathes of liquidity in order to drain Behodler. Indeed, the curvature of SCX minting symmetrically protects Behodler from flash loan drains. This is discussed further in the appendix.```

For these two reasons, it is crucial that we have a mechanism for ensuring that new tokens listed on Behodler arrive with a seeding of reserve liquidity equal to the AVB. Since the AVB could grow beyond the capacity of any individual holder to achieve this requirement, we need the mechanism to make use of crowdfunding economics in order to source collective liquidity. Limbo is that mechanism. By providing a familiar yield farm user experience, we can set funding goals for new tokens, called thresholds. Once staked user balances exceed the threshold for a given token, the entire quantity is transferred to Behodler, the corresponding PyroToken contract is deployed and the new token is listed as tradeable on Behodler in one transaction. At this point the users have to be rewarded for having their staked token confiscated. In Limbo parlance, this is known as the Crossover Bonus. Crossover is in keeping with the world of the dead theme and using imagery of the River Styx symbolizes the moment a token in Limbo crosses over to the wonderful realm of Behodler. Yield farmers in DeFi expect more than to simply wait with a staked token in the hope of a Crossover bonus. Since other farms exist with staking yields, all tokens that can be staked are subject to a prevailing opportunity cost. Limbo must therefore offer a staking yield to users to offset this opportunity cost. So to summarize, in a threshold pool, a user is rewarded on a per second basis for staking, similar to other yield farms. And then at the point of Crossover where the total staking threshold is exceeded, all remaining staked users are rewarded an additional Crossover bonus.


EYE was initially put forward as a yield reward token since it has a value and the well established tokenomics of using a governance token to advance the welfare of dapps would preserve the value. However, EYE cannot be minted and so any reserve of EYE would eventually deplete. Limbo needs to be sustainable in order to keep the game going indefinitely.
A new token was therefore put forward, Flan, a reward token which would incentivize the staking of potential tokens to be listed on Behodler. When this happens, the generated SCX from the listing would be used to replenish the value of Flan in the interim so that Limbo would remain sustainable. The liquidity on Flan would be maintained and replenished through a pair on UniswapV2 of Flan/SCX. On each Crossover, the newly minted SCX would be evaluated for its Flan equivalent value and an equal portion of Flan would be minted up. The combined pair would be sent off to the Flan/SCX pair. If between Crossovers the Flan price drops, less Flan would be minted so as to rebalance the pair in a way that preserved the prestaking Flan price. This mechanism is known as _price tilting_.
It was then determined that a stable price goal for Flan would assist in many domains. Usability would improve if users could quickly calculate their returns. Governance decisions would be easier if configuring Limbo was done under the ambient assumption that the Flan price is stable and since most of DeFi is skewed towards favouring the liquidity provision of stablecoins (see <a open="_blank" href ="https://github.com/Behodler/Behodler2/blob/master/documentation/Behodler_whitepaper.pdf" >Behodler White Paper</a> for a technical explanation of this phenomenon), a stable Flan would get an additional boost from UniswapV3. The target chosen was Dai. On each Crossover, Flan and SCX are converted into Dai equivalent values using an oracle built on the TWAP mechanism of UniswapV2 and the FLN/SCX pair is rebalanced in such a ratio that Flan's price is 1 Dai.

While it is desirable to achieve price stability for Flan, it is strictly _not_ desirable to achieve price stability for SCX. Since the SCX price is algorithmically determined by the AVB of Behodler, the reverse is also true. If something keeps the SCX price down, the AVB of Behodler will be held down. For this reason, we want the SCX price to be allowed to rise _while_ maintaining Flan price stability. This outcome is not a given. There is a strong tendency for both tokens to stabilize simultaneously. The purpose of this paper is to chart an optimal Monetary Policy Strategy for Limbo such that the following two nominal goals are achieved:

1. Flan has a stable price to allow for unlimited, sustainable minting in order to induce staking in Limbo
2. The Scarcity price has no upper ceiling and is allowed to rise without limit.

In formulating this optimal monetary policy, a number of downstream secondary benefits are conferred to various parts of the Behodler Ecosystem.

*As a matter of form and to assist the reader, each of the subsequent sections will end with a section summary to act as a kind of TL;DR so that the bird's EYE view is always kept in mind.*

## The Path to Price Stability - transforming UniswapV2 into Curve.fi

As mentioned in the introduction, the mechanism for achieving price stability of Flan is to use the SCX minted from each Crossover to price tilt the Uniswap V2 pair of FLN/SCX to parity such that Flan works out to be worth 1 Dai. We'll refer to this pair as the Reference Pair from now on and give it the symbol, $Ψ$, the Greek uppercase letter Psi.

### The Reference Pair and Uniswap Affinity

The stability of the Flan price is dependent on the ability of $Ψ$ to absorb big trades. Since we have direct influence over the liquidity of $Ψ$ through Crossovers of Limbo, we wish to know that Limbo's influence is enough to have a market dominating determining factor over the price of Flan. If this is guaranteed, we have a stablecoin.
Therefore it's important to know how much of the Flan supply is in $Ψ$ and how much is circulating. The larger the circulating supply of Flan, the more the Flan price is at risk from being destabilized by economic shocks. If all of the supply of Flan is in $Ψ$ then Limbo sets the price of Flan. If all but a droplet of Flan is in circulation outside of $Ψ$ then the open market determines the price of Flan. (For now, we'll assume a stable SCX price but we will relax that assumption later.)

Let the total supply of Flan be represented as

$$
T = Ψ_F + E_F \tag {1}
$$

where T is the total supply of Flan, $Ψ_F$ is the supply of Flan in $Ψ$ and $E_F$ is the circulating quantity of Flan outside of $Ψ$. T is the number returned by calling the totalSupply() function on the Flan contract.

Since price certainty is proportional to $Ψ_F$ and inversely proportional to $E_F$, let's denote a price certainty quotient, $Ω$, where a value of 1 means T = $Ψ_F$ and a value of 0 means T = $E_F$. As $Ω$ drifts towards zero, we have less price certainty and as it drifts towards 1, we have more. So,

$$
Ω = \frac{Ψ_F}{T} \tag {2}
$$

The tension exists where we wish to reward the community as much as possible to induce staking but as we do so, $Ω$ drifts towards zero. A $Ω$ of 1 means we're not rewarding anyone and so Limbo grinds to a halt. We can say then that there's an optimal $Ω$ where there is both sustainable and manageable price stability and where rewards are at their highest.
Using this notation, we can observe that most of the fly-by-night farms we saw in the DeFi boom of 2020 had $Ω$ very close to zero. As soon as the market realizes the $Ω$ is close to zero, the reward token begins to decline in value and we have hyperinflation.

Let $C_F$ be the quantity of Flan minted between Crossovers. That is, $C_F$ represents the rewards handed out to staking users as well as the Flan issued as a Crossover bonus when the token lists. For now, assume there's only one token listing per period and that Perpetual staking pools (traditional yield farm pools) don't exist.

Incidentally, the one reason put forward for a commodity backed currency such as the gold standard and for full reserve banking are to achieve a $Ω$ of 1. The Zimbabwean hyperinflation era was because $C_F$ was too high. The "stakers" in this case were the Zimbabwean military.

At the point of Crossover, $C_F$ represents an increase of $E_F$ which translates to a larger T since it has all been minted. $Ω$ necessarily has decreased, meaning that Flan price stability is now under increased threat. We don't want to decrease $C_F$ since we wish for the community to receive their rewards and we don't have control over $E_F$. But at the point of Crossover, we have influence over $Ψ_F$. So we deposit the new token and receive SCX. Let the value $S_U$ represent the multiplication of the marginal price of Scarcity by the quantity of SCX minted. This is very different from the actual value that can be obtained by redeeming that SCX in Behodler. Because SCX isn't a proportional share of liquidity in reserve but instead is subject to slippage, the marginal price is the highest price and for each successive unit redeemed, the value retrieved is substantially lower. To illustrate with a numerical example, if the SCX price is <span style="display:inline;clear:none">&#36;</span>200 and there are 13 tokens listed on Behodler then this implies a TVL of <span style="display:inline;clear:none">&#36;</span>65,000 for an AVB of <span style="display:inline;clear:none">&#36;</span>5000. A Crossover event could easily mint 800 SCX because of the curvature of minting. $S_U$ is 200x800 = <span style="display:inline;clear:none">&#36;</span>160,000. And yet that quantity of SCX could only redeem at most <span style="display:inline;clear:none">&#36;</span>65,000 worth of SCX. The difference is price impact. While the first unit of SCX would indeed redeem <span style="display:inline;clear:none">&#36;</span>200 of value, the subsequent unit would redeem <span style="display:inline;clear:none">&#36;</span>190 and so on.

However, suppose we have a batch of 6000 SCX and the current price is still <span style="display:inline;clear:none">&#36;</span>200. We know that $S_U$ is <span style="display:inline;clear:none">&#36;</span>1,200,000. Now assume we have <span style="display:inline;clear:none">&#36;</span>1.2 million DAI and we pair it with the 6000 SCX on UniswapV2. If we then take the 800 SCX from a Crossover event and sell it into that pair, the slippage would be far less than had we redeemed that on Behodler. If we plug these numbers into the UniswapV2 algorithm, we get 140802.63622455 Dai. That is far more than the <span style="display:inline;clear:none">&#36;</span>65,000 we would have got for redeeming 800 SCX on Behodler.

The example above demonstrates that the more SCX we can lock up in Uniswap V2 pools, the more attractive it would be to trade SCX in UniswapV2 rather than to redeem it on Behodler. This is desirable because trade of SCX burns on transfer whereas redeeming on Behodler simply reduces the TVL on Behodler. This effect of tricking Uniswap into giving SCX an average price equal to $S_U$ is known as Uniswap Affinity in the Behodler community. The more we pair large quantities of SCX with deeply liquid tokens such as Dai or Eth, the more Uniswap Affinity is achieved.

We will return to this concept when discussing the role of Limbo monetary policy on Scarcity but for now we return to the discussion on Flan. In our example, recall the ambient assumption that the SCX price is fixed.

*Section Summary*


    1. On Crossovers, new Flan and new SCX is added to the FLN/SCX pair on Uniswap. This pair is known as the Reference pair.
    2. For a given supply of Flan, the more Flan in the Reference Pair, the more control Limbo has over the Flan price.
    3. By overstocking Uniswap pairs with SCX, we can *trick* Uniswap into setting the average price for SCX equal to its
    current marginal price. This makes it more attractive to sell SCX on Uniswap rather than Behodler, an effect we call
    Uniswap Affinity. By keeping SCX away from Behodler, we protect liquidity from leaving. 


### Rectangle of Fairness Vanquished

Initially it was believed that the disproportionately large quantity of SCX minted represents a threat to the survival of Behodler. If that SCX is ever released into the wild, it could cause immense damage by allowing the holder to drain Behodler. As such, it was discovered that 30 SCX is sufficient to redeem almost 100% of any token on Behodler, regardless of the absolute liquidity level. In other words, when a new token is listed and preseeded with equilibrium levels of liquidity, the quantity of Scarcity kept back from the minting event should not exceed 30 SCX. The rest should be burnt. This quantity is known as the Rectangle of Fairness (a quadrilateral region identified in a graph published on Medium once upon a time).
Flan equal in value to 30 SCX would then be minted so that the combined Flan and SCX would be added to $Ψ$ as liquidity. This operation would generate LP tokens which would be thrown into the void to prevent any rugpull-like abuse.

In numerical terms, if the AVB of Behodler is <span style="display:inline;clear:none">&#36;</span>5000 and the SCX price is <span style="display:inline;clear:none">&#36;</span>200, then $S_U$ of 30 SCX is <span style="display:inline;clear:none">&#36;</span>6000. This means liquidity increases in $Ψ$ by <span style="display:inline;clear:none">&#36;</span>12000. This constrains $C_F$ to not exceed <span style="display:inline;clear:none">&#36;</span>12000. If it does then $Ω$ after Crossover declines from its pre-Crossover level. If $C_F$ < <span style="display:inline;clear:none">&#36;</span>12000 then $Ω$ increases. However $C_F$ has to be at least larger than <span style="display:inline;clear:none">&#36;</span>5000 or the stakers would be cheated. So the Rectangle of Fairness, although prudent, constrains Limbo and Flan enormously and makes tweaking Flan per second rates on Limbo quite a fine tuning exercise with an increased need to predict market sentiment.

The existence of the Rectangle of Fairness is necessary _if_ the entire quantity of SCX minted could be released into the wild. This is only possible if the LP tokens generated from adding liquidity to $Ψ$ is released to the public. Then they can be disaggregated into the component Flan and SCX and the SCX can weak havoc.

Suppose instead that we don't burn any SCX and that we mint Flan equal to the full value of the minted SCX, $S_U$. In the case of <span style="display:inline;clear:none">&#36;</span>200 SCX price with an AVB of <span style="display:inline;clear:none">&#36;</span>5000, and a minting of 800 SCX, this would represent <span style="display:inline;clear:none">&#36;</span>160,000 of Flan. If we assume the 1:1 peg to Dai then this is 160,000 Flan minted up. Suppose that in order to induce stakers to bring <span style="display:inline;clear:none">&#36;</span>5000 of a new token, we mint 10,000 of Flan rewards which is composed of staking rewards of 4000 Flan and a Crossover bonus of 6000 Flan.
$C_F$ is therefore 10,000 which means E_F in equation (1) has increased by 10000 but $Ψ_F$ has increased by 160,000. So in this scenario, $Ω$ has drifted closer to (1) post Crossover (and by quite a significant amount). From a Flan perspective, taking full advantage of the SCX minting maximizes stability.

Now we turn to SCX. Suppose we wish to sell all of the Flan rewards into $Ψ$ in order to liberate SCX so that it can be used to redeem liquidity on Behodler. For instance, if we have 10,000, that implies 50 SCX at <span style="display:inline;clear:none">&#36;</span>200, if we assume no price impact from the trade. 50 SCX is a dangerous amount since it can redeem almost two AVBs worth of liquidity. Since 30 can redeem about <span style="display:inline;clear:none">&#36;</span>5000, we can estimate that 50 SCX can redeem about <span style="display:inline;clear:none">&#36;</span>8300. Since Flan is worth 1 Dai, this results in a net loss to redeemers of <span style="display:inline;clear:none">&#36;</span>1700. However, if Flan only exists inside $Ψ$ then it may be the only option a Flan holder has of converting their Flan into a more liquid, well established token such as Eth or Dai. In other words, even though the market price for the received Flan rewards is <span style="display:inline;clear:none">&#36;</span>10k, the users may opt to take the <span style="display:inline;clear:none">&#36;</span>1700 hit by selling it for SCX and redeeming it for <span style="display:inline;clear:none">&#36;</span>8300 worth of Eth on Behodler. So we may argue that what is required is for there to be plenty of other Flan pools in Uniswap so that recipients of rewards on Limbo can sell their reward instead of redeeming for SCX and causing Behodler to lose liquidity. This is a decent strategy but the equivalent may be achieved by ensuring plenty of SCX pools on Uniswap so that when Flan is sold in $Ψ$ for SCX, selling onto, say SCX/ETH or SCX/EYE yields less slippage than redeeming into Behodler. As has been demonstrated, this doesn't require a great deal of SCX. But it turns out that this approach has a number of desirable outcomes which will be explored in later sections. Before that, it is worth pausing to reflect on the stability dilemma.

*Section Summary*


    1. The Rectangle for Fairness initially constrained minted SCX at Crossover to protect Behodler from too many SCX free radicals.
    2. The cost of the Rectangle of Fairness is potentially tepid staking rewards on Limbo and thereby poses an existential risk to the success of Limbo.
    3. The assumption behind the Rectangle of Fairness is that excessive SCX should not be released into the public. 
    4. Burning the LP tokens generated from the Reference Pair is an alternative method of achieving this and it has the effect of massively boosting Flan's price stability.
    5. If there are no alternative sale options for Flan holders then Flan rewards will end up being converted to SCX and dumped on Behodler.
    6. Providing Flan Uniswap pairs that don't contain SCX is one approach to solving this. However later sections will make
    the case for SCX staking and SCX LP tokens as a more desirable approach.



### Stability Dilemma

Suppose we apply the stability analysis of equation (1) to SCX such that we get equation (3) below where the Total Supply of SCX is given by $T_S$,

$$
T_S = Ψ_S + E_S \tag {3}
$$

where the total supply of SCX is given by the sum of SCX locked in the Reference Pair and all circulating SCX (including SCX in LP pairs).

Prior to Limbo, $Ψ_S$ is zero and so SCX is priced at the whim of market forces. Let's give real numbers to this equation. At the time of writing, $T_S$ = 7000 which means $E_S$ = 7000 and $Ω$ = 0. After a Crossover of 1 token which generates 800 SCX, we send the newly minted 800 to $Ψ$ such that

$$
T = 800 + 7000 = 7800
$$

and $Ω$ is now 800/7800 = 0.1025. After another Crossover, $Ω$ rises to 0.186. As this continues, $Ω$ continues to rise so that $Ψ_S$ begins to dominate equation (3).
Therefore, it should become clear that the stability of Flan creates a symmetric stability of the SCX price.

It may be tempting to think that the vast majority of liquidity in $Ψ$ is fake, that it is just minted out of thin air and that it represents a kind of hyperinflation bomb waiting to be detonated. This is only true if the LP tokens minted from adding the liquidity are allowed into circulation. We could argue that simply dumping one of the tokens, say Flan, would be enough to liberate unsafe levels of SCX but by definition, this quantity of Flan doesn't exist since the vast majority of it is tied up in $Ψ$. And even if it were to come into existence, the slippage of $Ψ$ is again, by definition lower than any other pool which means it would never be profitable to sell vast quantities into the stable pool in order to dump an output token elsewhere.

In reality, the actual effect of adding liquidity from newly minted SCX and Flan to $Ψ$ and then disposing of the LP tokens is to flatten the Uniswap curve from the hyperbola of xy=k toward the flat, x+y=k. The x+y=k curve only benefits a token swap when the two tokens have a stable and fixed exchange rate. So we can infer that since the vast redundant minted liquidity has the effect of flattening the Uniswap curve into a stableswap curve, both Flan and SCX have become stablecoins.

While a stable Flan is desirable, a stable SCX is not. As mentioned earlier, the AVB of Behodler algorihmically determines the SCX price. So if the SCX becomes stable at, say, $200 then the AVB can never rise. The next section examines the yield economics of Limbo to explain how Limbo monetary policy strategy can be pursued in such a way that Flan retains a stable price while also allowing for the price of SCX to rise.

*Section Summary*


    1. The stabilization of the Flan price has the unintended consequence of also stabilizing the SCX price
    2. A stable SCX price is not desirable because AVB can only rise if the SCX price rises. 
    3. The rest of this paper will explore how to achieve SCX price growth while allowing the Flan price to remain stable.

## Yield at Intersection

The resolution of the stability dilemma requires the creation of SCX staking pools on Limbo. As will be shown, many pairs of Scarcity coupled with liquid tokens are the ideal. To start with, we'll just consider a single pool of pure SCX.

### The Law of One Price

Many different DeFi farms offer varying APY yields on their pools. For a given token, if there are no obstacles or bounding conditions on the staking of the token, the yield offered between two separate farms should converge on the same value. If this were not the case, yield arbitrage opportunity seekers would unstake from the low yield farm and stake into the high yield farm until the rates equalize. This is the Law of One Price in action. Where APYs differ, the tokens are not comparable in risk (for instance Dai is less volatile than ETH and so less risky), there are additional incentives provided by the dapp or some sort of friction that prevents equalization such as ignorance about the farm offering a higher rate.
But for identical tokens, we should, in the absence of ponzi economics, expect the yield to converge on the same value.

*Section Summary*

    For a given token, the yield as measured by APY on all farms throughout DeFi should converge on number. This is the Law of One Price.

### Disequilibrium: Flan Price Drag

For our analysis, assume there is one stakeable token (SCX) and that the prevailing yield throughout DeFi for staking this or similar tokens is given by $I$, expressed as an interest rate. Let $I_L$ be the yield on Limbo. In the short run we can increase the reward rate of Flan in this pool so that $I_L$ > $I$. But as time passes, the two values will converge.
To start with, assume we only have Perpetual pools on Limbo.

Let $Δ$ be the Flan per second rewarded to the Perpetual pool. Let $Δ_A$ be the Flan per _year_ minted to the pool such that

$$
Δ_A = 365⋅24⋅60⋅60Δ = 31536000Δ
$$

Let $S_L$ be the total <span style="display:inline;clear:none">&#36;</span> value of Scarcity staked on Limbo. That is the total quantity of SCX expressed in a common currency such as USD. Then

$$
I_L = \frac{Δ_A}{S_L} \tag {4}
$$

Returning to equation (1), we know circulating Flan, $E_F$ can redeem a certain quantity of SCX from the Reference Pair, $Ψ$, and we know that for this quantity, there will be almost zero price impact because, through successive prior Limbo Crossovers, we've flattened the UniswapV2 curve into a stableswap. If the price of SCX in terms of Flan is given by $P_S$ then the SCX we can liberate is

$$
S_E = {P_S}{E_F} \tag {5}
$$

where $S_E$ is the SCX we can liberate from the Reference Pair using circulating Flan. This is the _dangerous_ SCX since it represents the effect of Limbo to indirectly, through Flan rewards, drain Behodler of Liquidity and to lower the market SCX price.

If $S_L$ = $S_E$ then we know that all of $S_E$ is staked in Limbo chasing yield. Suppose that, through governance, $Δ$ is raised such that $I_L$ > $I$. We now have a case where $S_L$ > $S_E$ which means we need to find SCX from sources other than the Reference Pair in order to bring $I_L$ back down to $I$. One approach to bringing the yield back in line is to bid up the price of Flan on Behodler so that we can get more Flan for a given input and thereby liberate more SCX from the Reference Pair. This can be called the "drag option" as the rising yield for SCX on Limbo indirectly drags the price of Flan up as yield hunters increase demand for SCX.

The problem here is that $Ψ_F$ is much higher than $E_F$. If the price of Flan rises on Behodler, there will be a counter demand for SCX to buy Flan from $Ψ$ in order to sell into Behodler for a profit. Behodler's price will change quicker than $Ψ$ due to Crossover induced stability. In addition, bidding up the Flan price temporarily will increase $I_L$ because the numerator in

$$
I_L = \frac{Δ_A}{S_L}
$$

will increase in value. Presently the numerator has no nominal value such as USD because we assume Flan is worth 1 Dai. But the correct formulation would include an exchange rate multiplier to express the value. An increase in the price of Flan would then increase the size of the numerator. This will mean that while $I_L$ > $I$, a rise in the Flan price will increase the shortfall between $S_E$ and $S_L$.

So we can conclude that Flan drag can at best only be an ephemeral effect in this scenario.

*Section Summary*

    1. We can increase the short term APY on an SCX pool on Behodler above the prevailing DeFi yield for similar tokens.
    2. Doing so could indirectly increase the demand for and therefore price of Flan because one way of buying SCX is to get hold of Flan and sell into the Reference Pair. This effect is known as Flan price drag.
    3. If the goal of users causing Flan price drag is to acquire SCX then they won't be buying Flan from the Reference Pair. What remains is Behodler.
    4. Since the Reference Pair, by definition, has more liquidity than the AVB, an increase in the Flan price on Behodler can be quickly damped down by arbitrageurs who acquire Flan from Uniswap to sell into Behodler.
    5. The net result is that Flan price drag is most likely to be an ephemeral or non-existant effect. 
    In other words, if the yield on SCX staking is temporarily raised above the DeFi norm, the extra SCX staked as a result won't come from the Reference Pair. 


### Disequilibrium: SCX Price Drag

$S_E$ does not represent all circulating SCX but only the SCX that circulating Flan can redeem. What remains is the rest of circulating SCX. In a state where we raise $I_L$ above $I$, let $S_Φ$ be the higher level of SCX required to bring yield back down to $I$. Then, $S_Φ$ - $S_L$ is the missing amount of SCX we require to be staked in Limbo. The remaining SCX in circulation is all the SCX not tied up in the Reference Pair and not staked in Limbo. Let this quantity of SCX be given by $S_C$. We can now formulate the mint gravity inequality. If

$$
S_Φ - S_L > S_C \tag {6}
$$

then SCX has to be minted from Behodler. If the Behodler token prices are currently at rest then the increased minting of SCX will be spread amongst all tokens and the price of SCX will rise algorithmically. 

*The reader may wonder what would occur if the left hand side of the inequality in (6) is smaller than circulating SCX. The answer is that it can be made bigger. The analysis here assumes one pool of SCX is being staked. If we add additional pools such as LP tokens containing SCX or some sort of SCX wrapper, each additional pool requires a similar level of SCX added, increasing $S_Φ$. The cost of increasing the number of pools is an increase in Δ_A but this turns out to be sustainable at much higher levels than 1 pool as will be demonstrated by a relaxing of assumptions later in the paper.*

Observe equation (4) again.

$$
I_L = \frac{Δ_A}{S_L}
$$

An increase in the price of SCX caused by Behodler minting will increase $S_L$ since it represents the _value_ of staked SCX. However since we know that Flan's price is determined by the Reference Pair, the increased price of SCX before any trading occurs will raise the price of Flan. To understand why, imagine a Uniswap Pair with 10 units of Dai and 1 unit of Eth. We know that in this instance, the price of ETH is 10 DAI. Suppose the price of Eth doubles to be worth <span style="display:inline;clear:none">&#36;</span>20. Before any trading occurs, the pair ratio tells us that Dai is now worth <span style="display:inline;clear:none">&#36;</span>2 each. The market only corrects this price downwards if there is external Dai that can still be acquired at <span style="display:inline;clear:none">&#36;</span>1 and sold for a profit into the pair. However if there is not enough external DAI then essentially Dai = <span style="display:inline;clear:none">&#36;</span>2 is the new truth. It _is_ the market price of Dai.

This same logic applies to the Reference Pair. If the SCX price rises on Behodler and there is plenty of freely floating Flan then there will be plenty of liquidity to draw on in order to free up SCX from the Reference Pair and so bring the price on Behodler back down. In other words, one can buy SCX cheaply on Uniswap and dump onto Behodler until the price on Behodler drops back down. 

But by intentionally raising the yield on Limbo, we've drawn all freely floating Flan into the Reference Pair in order to draw out SCX for staking. In other words, the new disequilibrium where Flan gains a higher price and cannot be brought is a new reality.

Even though Behodler has less liquidity than the Reference Pair, through Limbo, we've pushed the market price for SCX up permanently, thereby increasing the TVL of Behodler.

*Section Summary*

    1. Increasing the price of SCX on Behodler temporarily increases the price of Flan on Uniswap automatically. This allows the yield on Limbo to remain temporarily higher than the rest of DeFi.
    2. Since high yields on Limbo draw circulating Flan back into the Reference Pair in order to liberate SCX for staking, in this scenario, there is no remaining Flan that can be used to buy SCX from the Reference Pair and dump onto Behodler to bring the price back down.
    3. In other words, a sufficiently high staking yield can permanently boost both the price of SCX and Flan.


### Bringing Crossovers back into play

Now we can relax the assumption that there are no Crossover pools and once again review the effect of a Crossover. Suppose we open up some deeply liquid token for Crossover that we know many of the community already hold. In other words, the community won't be buying this token with Flan, SCX or EYE but will simply be staking it. This assumption isn't necessary but it does make it easier to form an intuition without having to create swirling vortexes of value like some sort of weather pattern of financial complexity in our minds.

SCX price drag through high yield on Limbo, as discussed above, can be said to have taken place between Crossovers. Thanks to the enormous clout of the Reference Pair, we've been given monetary policy tools that allow us to stabilize Flan and to raise the price of SCX.

Suppose the price of SCX before SCX price drag was $P_S$ and just before Crossover is $P_D$ such that $P_D$ > $P_S$. The price of Flan has temporarily risen because there isn't enough circulating Flan to bring it back down to pre-drag levels. Therefore at Crossover the value of Flan that will need to be minted exceeds the Dai value of $P_D$. Price tilting will occur such that the ratio of Flan to SCX will be higher in $Ψ$ than pre-Crossover. The price of Flan according to Uniswap will fall relative to the price of SCX. This will bring down the value of $Δ_A$ which will bring down $I_L$ and so some of the staked SCX in Limbo will be unstaked in order to either redeem liquidity on Behodler or sell for Flan on Limbo. But the net effect will not be enough to bring the price of SCX back down to $P_S$ so long as the value of $Δ_A$ after Flan comes down to 1 Dai in value is still high enough that $I_L > I$. Therefore it is important that the establishment of $Δ_A$ when the Flan price is above the nominal target be constructed as though Flan were on par with the nominal target so that the Flan price doesn't over correct downwards and become worth less than the nominal target.

The net result of the constraints imposed by the construction of the Reference Pair as well as the setting of high rates of Flan rewards per second on Limbo will be to stabilize the price of Flan while allowing for a continual rising price of SCX.

This means that from Behodler's perspective, the purpose of Crossover pools in Limbo is to expand the breadth of tokens listed and the purpose of Perpetual pools is to expand the depth of liquidity _per_ token.

*Section Summary*

    1. If high yields boost both the price of SCX and Flan as explained in the previous sections, Crossovers have the effect of weakening Flan with respect to SCX by minting a compensating amount.
    We can expect the price of Flan and SCX to diverge stepwise at every Crossover until the market prices in the trend. When the market adjusts the prices in expectation, 
    Crossovers are able to deepen liquidity even more so than usual.
    2. Governance decisions on yields on Limbo should be calculated as though the Flan price is 1 Dai so that Crossovers don't overshoot the price correction and cause Flan to sink below 1 Dai. 
    3. Erring on the side of excessive Flan rewards is safe enough without the need for precise mathematical tuning.
    4. From Behodler's perspective, the purpose of Crossover pools is to expand the breadth of liquidity on Behodler and the purpose of Perpetual pools is to expand the depth of liquidity on Behodler.
    5. From Limbo's perspective, the purpose of Perpetual pools to provide price support for Flan and the purpose of Crossover pools is to stabilize the price of Flan.

### Second order effects: PyroFlan and SCX LP tokens

We've analyzed the effect of a raw Perpetual pool for SCX without considering other Perpetual pools and without taking advantage of Scarcity's fee-on-transfer (FOT) feature. In this section, the scope of Perpetual staking options will be expanded to take advantage of the full cryptoeconomic breadth of the Behodler Ecosystem.

**PyroFlan**

Let's introduce a pool for staking Flan in the form of PyroFlan. The pool is issued $π$ Flan per second which works out to $Π$ Flan per year where $Π = 31536000π$.

Because of the Law of One Price, we expect the yield of the PyroFlan pool to converge on the universal yield, $I$. Note that the yield of PyroFlan means the Flan reward plus the growth in redeem rate, especially if the Flan price stabilizes.

Initially it will start at $I_F$, a higher rate than $I$. When stakers receive Flan as a reward, they will be faced with the prospect of either selling into the Reference Pair for SCX and staking that for $I$ or minting PyroFlan and staking that for $I_F$. So long as $I_F$ is higher than $I$, Flan rewards will be drawn away to staking for PyroFlan. Therefore, if $S_E$ is the SCX that the circulating Flan can redeem from the Reference Pair, the effect of a PyroFlan Perpetual pool is to reduce this number by drawing some away for lockup in the PyroFlan pool. This will induce more minting of SCX. 
The effect of PyroTokens on their base tokens is to encourage lockup and increase demand, mostly through burning incentives. If a Limbo pool adds to this incentive enough that the price of Flan nudges higher between Crossovers then the Flan per year variable, $Δ_A$ in equation (4) will increase, causing $I_L$ to increase which will increase demand for SCX lockup in Limbo.

*Section Summary*

    1. Providing an above market yield on PyroFlan staking requires less Flan minting than for pure Flan staking.
    2. When the APY on PyroFlan exceeds the market norm, circulating SCX declines.
    3. If the return on SCX staking on Limbo is in line with the market then an above market yield on PyroFlan staking will induce more SCX minting.
    4. The effect of SCX minting will increase the price of Flan between Crossovers, amplifying and supporting the above effects.

**SCX Burn: PyroSCX**

Scarcity burns on transfer which raises the liquidity floor of Behodler. Unlike for PyroTokens, a burn of SCX does not instantly raise the price of SCX. When the liquidity floor rises, there is a confidence boosting effect on Scarcity which eventually translates downstream into a higher SCX price and more minting.
Limbo adds a new dynamic to SCX burning that brings the future price growth and present burning closer together in the time stream, similar to PyroTokens. Consider equation (3) again, 

$$
T_S = Ψ_S + E_S \tag {3}
$$

where the total supply of SCX is the sum of the SCX locked in the Reference Pair and all other SCX. Suppose we offer a Limbo pool for SCX with a $Δ_A$ high enough that all of the freely floating SCX, $E_S$, is used up. In the process of staking, some of the $E_S$ is burnt so that the remaining SCX to stake is $E_ε$ where 

$$
E_ε < E_S
$$

This will mean that not enough SCX is available to bring the yield down to the prevailing market yield of $I$. The difference will either have to come from minting SCX or from the Reference Pair. The Reference Pair SCX can only be purchased with Flan which means that if we've tied up Flan as in the previous examples, minting is, by definition, the only remaining source of SCX. The effect is that at the point where the $Δ_A$ has caused Limbo to absorb freely floating SCX, both directly and through Flan sales into $Ψ$, any burning will almost immediately raise the price of SCX as soon as stakers notice the arbitrage opportunity of above market returns in SCX staking in Limbo.

A final note on LP tokens. As SCX is drawn into pairs on Uniswap, we can have a situation where the price impact of SCX sales is lower on Uniswap than on Behodler. If traders meet this condition, they will be more likely to sell onto Uniswap, incurring a burn fee than to redeem on Behodler. This desirable equilibrium is known as Uniswap Affinity and will act to preserve liquidity in Behodler.

*Section Summary*

    1. Unlike for PyroTokens, SCX burning does not immediately translate to an increase in price.
    2. By creating arbitrage dynamics to induce a shortage of circulating Scarcity every time it burns, Limbo can be used to trigger SCX minting almost immediately after it is burnt, bringing the price raising and burning much closer together in time.
    3. Uniswap Affinity both assists and is assisted by this process.

**SCX Burn: LP tokens**

A Perpetual pool for pure SCX will act to burn SCX as illustrated above. However, LP tokens containing SCX are preferable in a number of ways and should form part of the SCX staking options offered on Limbo. 

**Arbitrage**

When multiple SCX containing LP tokens in popular and liquid tokens such as ETH or Uni are created, the possibility for high frequency traders to exploit arbitrage differences in price rises. In particular, for every new pair added, the drift in price between one pair and any other through random fluctuations in the different prices of the coupled 'other tokens' creates a kind of Brownian motion of price perturbations. The higher the liquidity locked, the smaller the required price divergence to allow for profit, assuming the traders make use of large volumes of capital. Flash loans make this challenge merely technical rather than financial.

And so for a given level of gas price, an inducement to stake more LP tokens AND for there to be many LP token pools will increase the degree of SCX burning. A second order effect would be to provide more locations for dumping any surplus SCX when it arises.

If the price of a token in a liquidity pool rises, the quantity of that token declines as traders sell the less valuable token in order to buy the more valuable token, a process known as impermanent loss. While random daily price jitters between SCX LPs shouldn't have a net effect (in fact Uniswap's fees compensate for this), accumulating impermanent loss may see the quantity of staked SCX decline. However, it is important to note that, in equation (4), the SCX term is *value* of SCX, not quantity. And so the effect of the rising price does offset to some extent the reduction in quantity. Nonetheless, the effect of this offset is ambiguous. As such, the strategy of rewarding SCX LPs in order to encourage SCX lockup will be more optimal when coupled either with increased Flan staking or pure SCX staking. The purpose of the increased Flan staking is to draw in circulating Flan from liberating SCX from the Reference pair and the purpose of SCX staking is to ensure that the absolute quantity of SCX staked remains high. From equation (4), an increase in the SCX price will also induce a reduction in SCX staked but the effect of pair rebalancing is not present and so we should expect the level of SCX staked to not decline as much as with LP tokens.

It should be noted that since $Δ_A$ is high enough that the supply of both Flan and SCX in circulation is constrained, an increase in the SCX price will increase the value of Flan in the Reference Pair. This would increase the value of $Δ_A$ and so offset the reduction in SCX unstaking that accompanies a price increase in SCX. For pure SCX staking, this may be enough to offset it entirely so that an increase in SCX price has no effect on the level of SCX staked when $I_L$ is at equilibrium. The remaining effect will be the LP token rebalancing. 

*Section Summary*

    1. Multiple deeply liquid SCX containing LP tokens will create constant burning through a Brownian motion daily drift in prices that arbitrage traders seek to exploit and correct.
    2. More liquid SCX pairs provide additional SCX sell locations in addition to the Reference Pair.
    3. Impermanent Loss implies that as the SCX price rises, absolute levels of SCX locked in Uniswap declines.
    4. A rising price of SCX increases the value of Flan rewards and so counters the reduction by inducing more LP lockup.
    5. Providing a pure SCX staking option can help blunt the reduction of locked SCX caused by a price rise, especially when coupled with the temporary Flan price rise caused by an increase in the SCX price.
    6. Conversely, if the SCX price falls, the absolute amount of SCX on Uniswap increases, acting as a sink for freely circulating SCX.

**A final word on PyroTokens and price movements**

While burning is an ongoing source of PyroToken redeem rate growth, Behodler fee revenue plays a very important role, depending on the performance of the PyroToken. Recall that a percentage of every sell into Behodler is distributed to the corresponding PyroToken. Since poorly performing tokens are expected to be sold more than performant tokens, we expect the redeem rate growth for PyroTokens to exert a countercyclical effect on token price performance. This mechanism allows Pyro(LP) tokens to automatically offset the effect of impermanent loss. **Indeed this may come to be seen as PyroToken's main selling point**.
 
This creates an incentive to list as many SCX LP tokens in Crossover pools as possible to produce as many PyroTokens as possible. It may be desirable that every time a new project is listed for Crossover staking on Behodler, a corresponding suite of LP tokens is listed including an SCX/Project pair, allowing for the creation of more Pyro- LP tokens. Pyro- LP tokens containing SCX provide an additional source of revenue to holders of SCX and support the health of Limbo and the integrity of Flan in a way that requires no additional Flan rewards to be minted.

## Summary
This section will bring the analysis above together by first reminding the reader of the ambient assumptions made, then by revisiting the important equations and finally by producing policy recommendations for the community.

### Assumptions made

The explanations that rely on Limbo yield converging on a prevailing DeFi yield require stakers to be careful profit seekers. This assumption doesn't appear to be too strong, especially since it only takes one vigilant staker to be able to soak up and compound their gains. 
Being able to assess the optimal $Δ_A$ in Limbo will require some measurement and a knowledge of the prevailing yield for similar tokens in DeFi. Undershooting this amount may result in the protocol tokens not performing as they should. Yet, overshooting is not particularly risky provided the liquidity in the Reference Pair is sufficient to absorb the extra Flan in circulation. Overshooting also temporarily creates a marketing pull as higher than normal APYs draw in new stakers.  

Much of the early analysis of Flan stability relies on the assumption that SCX has a stable market price. Of course when relaxing this assumption, we can talk about Flan stability with regards to SCX priced in dollar terms. But the existence of frequent Crossovers should be enough to counter the effects of SCX volatility. Since the Reference Pair has the effect of stabilizing both tokens, wild swings in the SCX price are expected to become less commonplace than prior to Limbo.

Finally, the initial stability analysis relies on the Reference Pair containing the vast majority of Flan and an eventual majority of SCX. While this may not always be true, the bootstrapping phase is where this requirement is most important and this paper can be thought of as Limbo:Year 1. Experience from the real world may inform an adjustment to this body of theory.

### Key equations and their implications
Equation 1 helps us understand the slack created by circulating unused Flan and how this affects the stability of the Flan price.

$$
T = Ψ_F + E_F \tag {1}
$$

and equation (2),

$$
Ω = \frac{Ψ_F}{T} \tag {2}
$$

gives us a measurement of the strength of our policy instruments (see the explanation of policy instruments in monetary policy in the Appendix).

By honing in on the freely floating Flan in equation (1), $E_F$, we know how much SCX total Flan rewards can release into the market. We can then draw on equation (4)

$$
I_L = \frac{Δ_A}{S_L} \tag {4}
$$

to determine the value of SCX required to be staked in Limbo. If we know the prevailing yield in DeFi, we can then, through governance, set the Flan-per-second ( $Δ$ ) required to achieve enough staking of SCX that all of the freely floating Flan is used up. In anticipation of new Flan minted from this reward, we may wish to raise $Δ_A$ to compensate. 

It would appear that if we raise $Δ_A$, we'll have more freely floating Flan and so will have to raise $Δ_A$ further in a runaway cycle of inflation but recall that the underscore _A represents the entire year's worth of Flan minting and so implicit in this equation is expectation formation by stakers. In other words, APY hunting. For instance, if we offer 100% APY on Flan, we do not instantly double the quantity of Flan staked. Instead, if the supply of Flan staked is X then X is removed from circulation. After day 1, the Flan supply has only increased by 0.0027X but this assumes the reward is immediately claimed. The net effect at worse is therefore a <span style="font-weight: bold; font-style:italic">decrease</span> in the Flan supply of 0.997X.
This temporary deflation of Flan allows us to effect SCX burning which leads to a permanent deflation of SCX, drawing more liquidity into Behodler. This spills over into Flan through the Reference Pair and future Crossovers. This is how the system is kept sustainable. In the absence of liquidity boosting mechanisms such as Crossover events, Flan would eventually hyperinflate. At some point, it may be that the effect of PyroFlan and very deeply liquid pools of Flan, it will become sustainable to not require Limbo Crossovers but this is not the case during the bootstrapping phase.

### Policy recommendations
The policy instrument for Limbo is Flan-per-second (fps) rewards on each pool. Calculating the optimal fps on threshold pools is fairly trivial since we have a target of AVB and simply have to offer a reward that exceeds the gas costs of staking sufficiently. 

Crossover pools should contain as many SCX paired pools as possible. For every new project listed through Limbo, the requirement for an SCX pool should be mandatory. This can be enforced when the market for Fate (LimboDAO voting points) is established formally. Until then, the community is strongly encouraged to enforce this as a norm. Of course, Behodler's ability to offer routerless, single sided exchange of LP tokens into base tokens is an attractive selling point and so the project token should also be pooled with Eth and popular stable coins. This of course indirectly adds to the liquidity available to SCX since the project token can act as a hop between liquid tokens and SCX.

For Perpetual pools, it is recommended that both pure SCX and SCX LP tokens be offered. On the Flan front, as liquidity increases, more Flan staking options will help draw in surplus Flan rewards. As the breadth of stakeable 'other' tokens increases, the Flan staking options should increase in order to soak up the newly minted rewards. Some recommendations are
1. PyroFlan
2. Pure Flan (by creating obvious yield arbitrage differences between Flan and PyroFlan pools, we indirectly encourage regular burning of PyroFlan through unstaking and redemption fees).
3. Flan/PyroFlan LP tokens for Sushi, Uniswap and Balancer
4. Flan/{popular stablecoin} on UniswapV3 through a UniswapV3 tokenizer.
5. The Reference Pair and/or a PyroToken of the Reference Pair to soak up both excess circulating Flan and SCX.

Flan should have an initial seeding ceremony known as Flan Genesis which establishes the Reference Pair with a large quantity of initial liquidity. In addition, the Flan genesis should create PyroTokens of both Flan and the Reference Pair.

*The pricing of Flan and SCX relies on regular trade in some obscure odd pools. For instance, (SCX/FLN; SCX). These pools should be deployed at Flan Genesis so that arbitrage profit seekers can drive their prices to equilibrium.*

Once liquidity and price stability is established, the community should aim to purchase CRV tokens by creating a Flan mint stream. This can be automated so that a contract fills up with Flan and a user can then trigger a CRV purchase through Uniswap V3 or CRV. The rate of purchase should exceed the aggregate value of all other CRV purchases so that as time progresses, the Behodler Ecosystem's clout in the Curve War grows unchecked. It might be prudent to list CRV on Behodler and then to stake PyroCRV to accelerate this process. In time, a CRV proposal can be wrapped as a LimboDAO proposal to create a Flan pool on Curve.fi in order to help secure Flan price stability. Then the tokens minted by such a pool can be staked first as a Crossover token on Limbo and then as a Perpetual token for Flan rewards. A Convex-like proxy can be created such that CRV emissions are auto-compounded on the Limbo side.  
The effect of multiple pools of stable coins will be to increase the value of SCX that can be staked on Limbo which raises the natural growth rate of liquidity on Behodler and increases the SCX price.

As more project tokens are added, the community may wish to alter the Behodler UI to allow for filtering by project (as well as a few big tokens such as Eth and Dai). This would cater to the Zapper audience who wish to use Behodler to jump in and out of yield and base tokens.

**Flan Genesis**
Flan Genesis is a once off contract that creates Flan, seeds Behodler and establishes the Reference Pair. The Reference Pair could then be listed on Behodler, generating more SCX for increased liquidity of the pair. The Genesis seeds the Reference Pair with so much liquidity that it begins to behave like a stableswap pair ( $x+y=k$ ) instead of a typical CFMM pair ( $xy=k$).

**Policy Fine tuning**
The full analysis of this paper outlines the lower bounds that must be overcome in order to induce the full breadth of cryptoeconomic benefits provided by Limbo. Calculating the actual numbers in the real world can be a very data intensive process and is prone to measurement error. However, it should be clear that there is little downside to overshooting the lower bounds. Therefore, it will be easier for the community to develop simple heuristics to follow. For instance, if the SCX price falls in a given period, increase the Flan Per Second yield on SCX LP tokens and PyroFlan by 50% and observe the effect.
Another metric to watch is to compare SCX locked on Limbo with SCX outside of the Reference Pair. The bigger the former relative to the latter, the more likely we are to achieve all the goals of Limbo. Therefore, having a target ratio that informs adjustment in base Flan rewards can be built into an automatic governance mechanism, allowing the market to anticipate and price in yield changes on Limbo.

Central Banks are implicitly aware of the dangers of micro tinkering and have developed heuristic based management as well. For instance, inflation targeting nations often adjust interest rates in fixed increments of 50 or 25 basis points in response to inflation data. You never see monetary policy committees suggesting obscure, fine tuned adjustments like 7.1387%.

So in a sense, the technical parts of this paper are not required reading for anyone participating in governance in Limbo. They serve rather to justify the policy recommendations made. It is sufficient to do only the following:

   1. Offer many perpetual SCX LP staking options.
   2. Offer both Flan and PyroFlan Perpetual pools.
   3. New tokens for Crossover should be accompanied by SCX/Project LP tokens.
   4. Make sure the Flan per second yield on Perpetual pools is high enough to induce a very big lockup of SCX in Limbo, relative to the circulating SCX supply. 

## Conclusion.
The stability of Flan is necessary to ensure the sustainability of Limbo rewards. By establishing price stability through regular Crossover events, Flan can be used to stimulate the growth of Scarcity (and hence the liquidity in Behodler), even as the Flan price remains stable.

Stability is achieved by vastly oversupplying the SCX/Flan Uniswap V2 pair known as the Reference Pair with liquidity in an initial event known as Flan Genesis and replenished with liquidity on every Crossover. If the LP tokens generated from ongoing seeding were released to the public then the excess Flan and SCX in the Reference Pair would lead to hyperinflation and systemic collapse. For this reason, all LP tokens are dumped into a black hole contract. In this way, the net effect of over stocking the Reference Pair is to simply flatten the swap curve until it resembles a stablecoin swap curve with vast depth of liquidity and linear curvature (signifying fixed exchange rates for a given swap). The reserves in the Reference Pair will never exit the Pair except to act merely as trade lubricant (aka liquidity). The only force that could release all of the SCX in the Reference Pair is minting Flan beyond the capacity of Limbo to absorb.

Since Flan is minted in an ongoing reward cycle, the danger created is that over time, there will be a one way sale of Flan into the Reference Pair for SCX which would be dumped onto Behodler, reducing liquidity and the Flan price, thereby requiring higher Flan emissions in order to compensate for falling price and eventually culminating in hyperinflation and collapse of Behodler.
Therefore a strategy is required to absorb Flan emissions. Two approaches are put forward: 

1. Perpetual SCX staking is offered on Limbo at a rate high enough such that if the entire supply of Flan were sold for SCX in the Reference Pair, all of that SCX would find higher than market returns through staking in Limbo. By pursuing this strategy, we can create a shortage of SCX on Limbo such that whenever SCX burning occurs, it necessitates more SCX minting in order to fill the Limbo Gap. This would close the time gap between an SCX burn and price rise such that SCX begins to behave more like a PyroToken.
2. Perpetual Flan and PyroFlan staking is offered on Limbo in order to absorb Flan emissions before they enter the Reference Pair.

Furthermore the strategies of 1 and 2 can be deepened and made more sophisticated. For 1, we can offer SCX LP token staking so that SCX burns more and so that Uniswap Affinity is enhanced. For 2, we can enter the Curve Wars, create Uniswap V3 pools and so on, in order to deepen Flan liquidity and establish true price stability throughout DeFi.

By formalizing the analysis of monetary policy in Limbo, it is my hope that the community will both use and update this document with experience so that Limbo and Behodler, through Scarcity, work synergistically and so that Flan stability is established early and permanently. In this way, the Behodler Ecosystem will very quickly become a great power in DeFi, bootstrapped not from deep-pocketed VCs but from the power of good cryptoeconomics. 

## Appendix

The appendix elaborates on some concepts assumed in the main body.

### SCX curvature

Let $T$ be the TVL of token X on Behodler. 
Let $A$ be the AVB.
Let $D$ be the disequilibrium difference. In other words, let $D = A - T$. If $D = 0$ then X is correctly priced on Behodler.

If $D>0$ then the price of X will be too high on Behodler. A user in this case can mint up SCX by depositing $D$ to take the price of X down to the market price.  Let $W$ be the amount of ETH a user withdraws by redeeming their new SCX.
On Behodler, 

$$
W > D
$$

So let L, the Limbo Gap, be

$$
L = W - D 
$$

The Limbo Gap represents the degree to which newly minted SCX is able to redeem more than it *should*. Since W is the value of what SCX can redeem and D is the value added to produce that SCX, if L is positive, it means we're able to steal value from Behodler by minting Scarcity.

Limbo exists to close the Limbo Gap for a newly listed token. By listing a new token with L = 0, no one can mint SCX and then immediately redeem more value than they added in the first place. 

Suppose that Behodler is back to equilibrium and let's deposit too much X to lower the price of X below the market price. Let X be Dai in this case to simplify and assume that Dai is worth $1. And let's deposit D units of Dai. Because of slippage in SCX (curvature of SCX minting),

$$
D>W
$$

If the price on Behodler falls out of alignment with the market and an external AMM such as Uniswap has huge liquidity, someone may want to mint SCX with DAI in order to redeem ETH. Doing so would run up against SCX slippage.

If SCX was minted proportionately like a typical LP token then the price of SCX wouldn't change for a given minting and someone could empty Behodler of ETH in one transaction at a profit if the price diverges from Uniswap. In other words, if the price of Eth on Behodler is 10 Dai and the price of Eth on Uniswap is 11 Dai and if we had 100 Eth on Behodler then someone could deposit 1000 Dai to get 100 Eth and sell it on Uniswap to get just less than 1100 Dai. Behodler would be left with 0 Eth and 2000 Dai.

In real Behodler, doing this would cause the SCX price to rise as more is minted which implies a price impact. And so a much smaller arbitrage sale would occur.

The curvature of SCX minting is necessary for a single sided liquidity addition protocol to function in the presence of market forces. When the TVL of a token in Behodler is higher than AVB, the SCX mint curvature protects Behodler from liquidity drains. When the TVL is below AVB, SCX minting can lead to excessive liquidity withdrawal. Limbo acts to protect Behodler from TVL below AVB by seeking to list tokens with the required seed level of liquidity. 

### The Art of Monetary Policy

Effective monetary policy starts by identifying policy instruments and then derives nominal targets. An instrument is a source of incentives available to the policy maker. For instance, a central bank can expand the money supply by either changing the supply of bonds (loans) or by directly setting the interest rate it charges to primary borrowers (banks). A nominal target is a short term goal in a variable that can be influenced. In the 20th century, a common nominal target was the exchange rate of the US dollar. By influencing the local money supply according to the dynamics of the economy, foreign countries were able to force their national currencies to track the US dollar 1:1. These foreign pegs to the US dollar can be thought of as the first stablecoins in existence and so central banks of the 20th century pioneered the ground later tread by cryptocurrencies such as Dai. While the sentiment in tradional Bitcoin circles toward central banking tends to be hostile because of the Soviet style central planning of of what should be a spontenous institution, the experience of central banks has provided an enormous literature on the topic of how-to-make-your-own-currency which is exactly what cryptocurrency startups are concerned with. 

In a Biblical twist of turning a bad situation into a good outcome, the flourishing of central banking in the 20th century has created a firm body of theory on which crypto founders can draw on in order to move the world into an era of spontaneous value transfer and reverse the Cantillon effect. 
In addition, the resurgence in enthusiasm for free market theories of money such as those championed by Murray Rothbard and to a lesser extent, F.A. Hayek, helps pass the baton of a planned-with-training wheels token to an active market participant can be carefully navigated by the careful founder.

Returning to dusty theory from the 20th century is more important than ever if DeFi is to not end up rudderless. A number of best practices from traditional finance (TradFi) are imbued with subtle centralized mind patterns of which the practitioners are unaware (such as inflationsim, the belief that monetary expansion brings a form of prosperity) and so importing the practices of TradFi without consideration to the underlying economic theory may risk importing much of the contagion of TradFi that has resulted in so much value transfer from the the poor to rich. An example of this is the waves of liquidations that crypto lending has injected into DeFi. Every wave of liquidation undermines the value of deflationary currencies such as Eth by injecting volatility during market downturns, first by luring in Eth as collateral and then unleashing it on the market during the unwinding.

Continuing in this vein, we can categorize the emergence of stablecoins in DeFi through this historical lense and the best token to start with in this regard is Dai. While there were many attempts at algorithmic and synthetic stablecoins made before Dai, none of them paid heed to theory and instead simply attempted to imitate Central Banks as though by enacting an analogy, their fictions would become reality.
By understanding the relationship between debt and interest rates, MakerDAO was able to successfully establish the first successful decentralized crypto fiduciary stablecoin. The term fiduciary, which derives from the Latin word for trust, implies that although the Dai in circulation was backed by more than 100% capitalization of Eth, the price of Eth and Dai can diverge and so there's a risk in holding Dai. If we rank currency on a spectrum from pure commodity such as gold on one end and pure fiat on the other, there are many intermediate steps and each step involves handing over more trust to the issuing institution. The institution can buy this trust from the public by fostering increasing demand and liquidity for their currency. With enough liquidity, the difference between a commodity and a fiat currency appears to be of academic interest only to the general public.

So let's start on at the beginning and slowly work our way to fiat by way of a rolling parable. At first, we have pure gold. A smith of some sort begins minting coins of standard weight in order to create an easy to measure, uniform system of value to facilitate quicker trade in the economy. At first the public continues to weigh the coins at each transaction in order to verify the smith's authenticity. The smith has a number of grocer friends in the local food market and they all agree to accept the smith's coins without weighing. The general public begin to gravitate towards these grocers for pure convenience. In medieval terms, accepting these coins without weighing is the equivalent to the emergence of tap to pay credit cards. Consumers tend to enjoy less friction and so resistance to payment declines ever so slightly at the sight of the tap-to-pay logo in a shop. A similar effect spreads for smithCoin. Competitiveness forces other retailers to accept smithCoin and liquidity for smithCoins begins to deepen. At this point, the smith can become corrupt and dilute coins in order to steal wealth from the economy. This is the first type of inflation. Let's assume for now that the smith isn't corrupt and that he wants to save consumers the effort of lugging around heavy coins. He promises to store their coins in his safe in order to prevent theft and issues paper gift vouchers which he'll redeem. Convenience slowly convinces the public to switch over to these certificates of deposit and even more convenience has people trading these certificates directly for products or giving as gifts rather than cashing in for coins. The smith begins issuing more paper notes but not by simply printing more since this could lead to his insolvency which would undermine trust and cause his entire operation to be abandoned by the public. Instead he lends out new certificates at interest. This means that while he temporarily issues more paper than coins in reserve, he requires even more than that to be paid back. The only way the debtors can pay back the paper that doesn't even exist is to deposit more gold into the smith to generate those papers. And so the smith forces the debtors to either expand the economy or to have their assets seized. The severity and degree to which the smith can effect these changes can be tweaked by the interest he charges and the number of certificates he issues. He now has two policy instruments at hand and his money supply is no longer fully backed by gold but partially by outstanding credit. It has now become fiduciary media because some of this circulating currency is not fully backed by an asset of equal and constant value. The credit expansion operation can be made to grow faster than the gold collecting and so over time, the smith can gradually phase out to holding of gold coins so that all of the circulating certificates are backed by outstanding debt. At this point he has a fiat currency. This has been the traditional route for national currencies to evolve from pure commodity to fiat and it took the United States about 100 years in fits and starts.
It turns out that in a competitive setting, market forces make moving towards fiat almost impossible. It requires a certain degree of compulsion and monopolization to be sustainable. In reality, for every additional money issuer, the risk of insolvency for banks issuing fiduciary media rises and so a natural cap on 'fiatness' emerges. This is why crypto lenders go as far as to insist on greater than 100% reserves. The blockchain reveals the degree of trust required by the public and so the distance in time between lost trust and bank runs is on the order of seconds. Indeed a vigilant bot can force a contract into liquidation in the span of block.

As a currency moves toward fiat, it gains more policy instruments and must more carefully choose its targets. A currency issuer must always be mindful of the constraints of its instruments. Countries that end up in hyperinflation usually start off by nudging the instruments just a little too far which puts them into an unsustainable position which necessitates a little more straining of the instruments. The effect becomes quickly exponential.

For MakerDAO, they currently face a peculiar crisis. Previously, issuers of currencies relied on sturdy commodities while issuing increasingly untrustworthy paper currencies. MakerDAO exemplifies the power of decentralization in that Dai is one of the most honoured and honourable currencies in history but one of its primary assets, USDC, has become untrustworthy, undermining the ability of its policy instruments to pursue the nominal target of 1:1 peg with the US dollar. A debate is now airing on wether to abandon the peg (change the policy target) or whether to dump the USDC in favour of Eth (change the policy instruments). This experience demonstrates an important lesson in DeFi: diversification into centralized assets imports the existential risks inherent to centralized finance.

On an existential note, if MakerDAO fails to navigate Dai through the present crisis, it may be wise for Flan to substitute for a different target. While strong tokens such as ETH and a decentralized wrapper for BTC are always interesting, a more obvious candidate may be SCX itself. Presently, the SCX price is fairly volatile but after the Flan Genesis, we expect the Reference Pair to dampen short term volatility of SCX significantly. Therefore, it may be worth setting Flan to be worth a depreciating target of SCX. For instance, take whatever the market price of Flan is at the time of depegging from Dai and build in a 1% per month depreciation relative to SCX since we expect SCX to rise in price over time.
