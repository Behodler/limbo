# Token Proxies as a necessary guard rail in DeFi

## Introduction

Behodler belongs to a rare and vanishing breed of AMM where all liquidity is stored in one contract. While Balancer has a single contract reserve, it enforces a logical separation to maintain the 8 token paradigm. So why do AMMs tend to stick to the usual 2 of Uniswap, occasionally venturing into small groups (Curve.finance and Balancer) but almost never more (Bancor)?

The focus of this question is cryptoeconomic, that is while security does play a role, we're not interested in software bugs leading to exploits but rather flawed economic models leading to price crashes via the mechanisms of the blockchain such as flash loans. It turns out the answer is the old enemy of AMMs, impermanent loss. This document is divided into the following broad sections:

1. What is impermanent loss and why does it pose an existential risk to single pool AMMs (such as Behodler)?
2. A solution is provided to stem impermanent loss without undercutting the upside. In other words, a contract is proposed that puts a floor on TVL in a liquidity pool without putting the brakes on liquidity growth. This is quite different to insurance against impermanent loss. With insurance, more volatile pools require higher premiums and we end up with stablecoin pools still taking the lion's share of liquidity provision. Nothing is free and we discuss tradeoffs. What's important is that Behodler places much higher value on liquidity providers than Uniswap and this has to be reflected as a strong Scarcity price performance.
3. Beyond Behodler: Token Proxies as a standard for all of DeFi. Here we discuss the ability to broaden the scope of token proxies to fix impermanent loss in any AMM and we allude to a standard template which will be used from now on throughout the Behodler Ecosystem. It may be worth submitting the standard as an ERC at some point to help with spread of correcting economic distortions in DeFi.

<table>
    <thead>
        <tr>
            <td>Term</td><td>Acronym</td>
        </tr>
    </thead>
    <tbody>
    <tr>
            <td>Scarcity</td>
            <td>SCX</td>
        </tr>
        <tr>
            <td>Impermanent Loss</td>
            <td>IL</td>
        </tr>
        <tr>
            <td>Total Value Locked</td>
            <td>TVL</td>
        </tr>
            <tr>
            <td>Liquidity Pool</td>
            <td>LP</td>
        </tr>
         </tr>
            <tr>
            <td>Constant Function Market Maker</td>
            <td>CFMM</td>
        </tr>
         <tr>
            <td>Miner (or Maximally) extracted value</td>
            <td>MEV</td>
        </tr>
    </tbody>
</table>

## Extreme Impermanent Loss

Suppose we have a liquidity pair in Uniswap of USDC/Eth. Currently there is 100 Eth and 200,000 USDC in this pair. This means that the spot price according to this pair is 1 Eth is worth 2000 USDC.
To simplify, let's assume that this liquidity was all provided for by one person, a wildly rich genius who goes by the pseudonym, Dr Liquid. Now Dr Liquid is an empiricist who wants to explore what IL means first hand. So he holds in a separate wallet static balances of 200 000 USDC and 100 Eth.
One day, the price of Eth rises to be worth \$2100. Arbitrage traders notice that you can buy Eth for only \$2000 on Uniswap through Dr Liquid's pair so they begin selling USDC into the contract in return for cheap Eth.
Uniswap's swap algorithm forces an invariant to hold, xy=k where x and y are the balances of each token. To start with, k = 100x200000 = 20000000. We want a new combination where USDC/ETH = 2100 (the new price) and where k is still 20000000. However, Uniswap charges a 0.3% fee on the swap which complicates things a bit. The effect of the fee is to increase k just a bit after each trade. This is how liquidity providers are compensated for. They gain a little bit of k after each trade.

If we plug into the algorithm, we get the following:

- Traders sell a total of 4947 USDC into the pair and take out 2.406 Eth
- The new k is 20001448.3817545
- The new balances of Eth and USDC are 204947 USDC and 97.59 Eth which gives a price of $2100.011 per Eth

Dr Liquid wants to know if this price movement increased the value of his LP. Specifically he wants to compare to his static wallet balances because that is what determines IL. If the LP value is lower after this trade then he's made an impermanent loss.
The value of the LP in dollar terms is 204947x1 + 97.59x2100 = \$409886.
The value of his static balances is 200000x1+100x2100 = \$410,000.

His static balances are \$114 higher in value than his LP position, even with the trading fee and so Dr Liquid has made an impermanent loss. It would have been better in this case to hold all his assets as static balances.

### Why does impermanent loss exist?

To understand why this happens, the most intuitive approach is to take an extreme example. An on-the-margin example like the previous one just leaves the reader pondering the mysteries of hyperbolas without giving a gut feel for why this makes sense. Once we have an IL intuition, we can see the implications for Behodler.
Suppose we reset Dr Liquid's portfolio above to its initial state. An audit is conducted of USDC reserves and it turns out that all the incoming dollars were invested into a rugpull project and essentially the reserve base is worthless. USDC immediately loses its peg and falls to be worth \$0.001.

Anyone holding USDC at this point would do well to sell it into Dr Liquid's liquidity pool because it still prices Eth at 2000 USDC when the market price of Eth is now 2000000 USDC. So traders rush to offload USDC onto Dr Liquid's pool and drain out the ETH. The end state of the LP is
Eth balance: 3.16688065669845
USDC balance: 6,333,764

The total dollar ballance of the LP is 6333764x0.001 + 3.1669x2000 = \$12667.564

The total dollar balances of his static wallet are 200000x0.01+100x2100 = \$212000

IL in this scenario was 212000 - 12667.564 = \$199332.

So now it should be clear that the effect of a change in price in an AMM is for traders to offload the less valuable token into the token pair in return for some of the more valuable token. They're rebalancing their portfolio and your LP position reflects a mirror image of that rebalancing. Whatever the trader gains in rebalancing, you lose. You are the credit to their debit. It doesn't matter if one of the tokens rises or falls in price, the result is the same: the trader will offload tokens to rebalance.
So why would you take such a terrible deal? Trading fees. A trading fee is charged to traders for this service. If the prices later return to their original numbers, you end up with the same LP but with two bursts of trading fees and so would have more in your LP than had you sat with static balances.

This is why stablecoin LPs thrive in AMMs. Most stablecoins fluctuate in price enough for arbitrage traders to trade in and out but they tend to hover around the same price so that the net result is a stable set of balances but increasing fee revenue.

### Capital Allocation Distortion

The AMM algorithms essentially underpay liquidity providers of project tokens and overpay providers of stablecoin liquidity. It penalizes project tokens that fail as much as ones that succeed. Recall that if you have an LP of Dai/ProjectX and the ProjectX price explodes upwards, you'll be left with a Dai heavy LP as traders rush in to offload Dai in return for ProjectX. If ProjectX rugs, you'll be left with a ProjectX heavy LP as traders rush in to get their Dai. Either way, you as the LP holder lose. Innovative projects are what advance the DeFi ecosystem but they're being crowded out by stablecoins because AMMs do not compensate LP holders for holding risky assets.

### IL Death Spiral

In the USDC losing peg example, only pairs that contain USDC are directly affected. They all lose enormous value. There is a secondary effect as all that liberated Eth is partially dumped on Eth containing LPs and so the effect of the depegging ripples out towards the rest of DeFi. But each round of ripples is less severe than the last.

Contrast this with an AMM in which all liquidity is pooled. Suppose we have an AMM with 10 tokens, one of which is USDC. When the depegging occurs, traders dump USDC on this AMM and withdraw ALL of the remaining tokens. The end result is an AMM that is almost exclusively USDC with droplets of other tokens.
Where the effect on Uniswap is significant, the effect on Behodler would be catastrophic.

A token which gradually loses value until it falls to obscurity is also bad for a single pool AMM. The only protection is for the token to have a fixed supply so that the rot eventually comes to an end. But an infinite mint token that loses all its value either through failure or inflation would drain Behodler of all its liquidity and result in Scarcity becoming a wrapper for the worthless token.

Solving the IL death spiral is a matter of survival in Behodler and this has been recognized from early in its development. The solution is finally here.

The rest of this document will outline the solution, the tradeoffs made and the implications for other components in the Behodler Ecosystem as well as DeFi more broadly.

## Token Proxies

### What is a token proxy?

A token proxy is just a contract that wraps a token and interacts with the outside world on behalf of the _base_ token. So WETH is a proxy for Eth. All of the PyroTokens are proxies for their base tokens. cDai is a proxy for Dai.
The reason proxies are used is to normalize behaviour across many tokens so that contracts written to deal with tokens can treat those various tokens in the same manner without having to make special exceptions. For instance, the reason WETH exists is because Eth does not comply with the ERC20 standard. So instead of all DeFi contracts have almost duplicated code for Eth, they simply refuse dealing with Eth and insist on Weth. Behodler and Uniswap both follow this approach.

### Proxies in Limbo

Limbo provides a proxy factory of sorts. In the code base there's a registry contract for keeping track of all proxies and a common proxy interface. The idea is that when we want to list a strange new token that confuses or tries to exploit the underlying logic of Limbo, the community can instead insist on forcing the token to be wrapped in a proxy that behaves in a standardized way. The first proxy introduced to Limbo is the rebase proxy. This is for rebase tokens to be converted into redeem rate tokens like PyroTokens. The reason is that Limbo tracks the balance of a user's staked position at staking and unstaking. If the actual balance changes, then at unstaking the user either gets too little or too much of the token. The rebase proxy balance is stable but the redeem rate for each unit varies according to rebase events. For instance, suppose we have a rebase base token whose total supply doubles. Each wallet's balance doubles. The redeem rate for the rebase proxy will automatically double. So you may have 10 units of rebase proxy that redeems for 10 units of base token. But after the doubling event, those same 10 units will automatically pay out 20 units of base token. The rebase protects Limbo without cheating users on their staked balances. If you're wondering if Flan payout should increase when a rebase up event happens, the answer is no. Flan is paid out as a stream to a pool and divided proportionately. So if everyone's token balance doubles, the relative proportions remain unchanged and so Flan payouts remain the same.

### Proxies in Behodler

Back when Behodler 2 was still fresh out of the blocks, there was a heated debate in the community that we should keep Behodler to a small list of tokens, perhaps only stablecoins and perhaps create many Behodlers effectively mirroring either Balancer's or Curve's approach.
I fell into the camp that argued that welcoming in all tokens would be possible but the IL death spiral loomed ever large. I suggested that the only feasible way to prevent an IL death spiral was to have a token proxy that protects Behodler from nefarious behaviour such as inflation. Back then it was called a guard rails contract. The benefit of the proxy approach is that we could open up the field to allow just about any token to list. There are some other benefits as well which will be discussed below. Although the concept was nice, there were three problems to solve on an algorithmic level:

1. How exactly does the proxy protect Behodler?
2. How does a proxy detect the onset of an IL death spiral? Is this a governance issue or an oracle issue? Is there something automatic? Perhaps Game Theory would help? For instance, could we force listing tokens to place a giant Eth bond as assurance?
3. How would the algorithm be written in such a way that it achieved the main goals and was gas efficient?

While gas efficiency is not crucial, especially since L2 versions of Behodler are inevitable, we don't want obnoxious gas expenditure either, so there's a need to reach for simplicity when possible. Fortunately the best solution is the simplest solution.

## The CliffFace contract. An automatic, low gas solution to the IL death spiral which confers some beneficial properties to Scarcity.

Let's design a contract that can absorb IL. To do so, we'll need to explore some challenges conceptually. The first thing we need is a way to decide on whether a token is going to take us into an IL death spiral. We'd like this mechanism to be immediate so that if a malicious unknown admin suddenly mints up a trillion new tokens and dumps on Behodler, the contract can instantly respond to catch the dump. We also want the mechanism to detect a boiling frog attack. That is a token that slowly loses value and dies will slowly seep into Behodler and without any fanfare, rebalance the entire AMM so that Scarcity becomes a wrapper for a terrible token.

_Note that while I use intentional language like attack, the cause need not be malicious. Perhaps a promising project failed and so the associated token gradually withered away. We've seen many of these in cryptocurrency and it's the sign of a healthy market that such deadwood is cleared away, regardless of the pain and heartache suffered in the interim._

### Iterations

The first attempt would be to keep a record of aggregate buys and sells of a token. If the sells begin accelerating away from the buys, we can assume that the token is losing value quickly. Or can we? It's true that if a token suddenly plunges in value, we'll see a massive surge in sells. However, if the general level of liquidity in Behodler rises quickly, we'll also see a surge of sells. While this seems counter intuitive, remember that the only way for liquidity to rise in an AMM is if more of every token enters that AMM and one way this can happen is for the token to be sold into the AMM. For rising liquidity this will take the generalized form of a mint event. Scarcity will be minted. But this won't always be the case. It may be that as liquidity rises, people tend to mint their Scarcity with stablecoins. However this causes an imbalance as Dai begins to fall below \$1 in value on Behodler. So others come in and sell their Eth into Behodler for cheap Dai. The net result is that Eth and Dai are both added as we'd expect from a rising pool of liquidity but the route to this growth was choppy and uneven. Eth appears to enter through selling for Dai which gives the impression that Eth is losing value. But this is just an illusion.
Therefore there's no reliable way for a contract to detect whether a surge in selling is because a token is tanking or because liquidity is rising.
What if we keep track of the total supply of Scarcity as a metric for rising liquidity. The problem here is that Scarcity can burn and if we add a new token to Behodler, the Scarcity supply increases without average bonded liquidity having risen. Both these factors are enough to confuse or at least complicate (gas) any analytical algorithm.
What about tapping into the Uniswap V2 TWAP mechanism to generate an oracle price feed. We use a common stablecoin such as Dai to measure the price of every proxy token and report back if it is falling. This is starting to come right but it requires that absolutely every token listed on Behdoler have a corresponding Dai pool on Uniswap and that the pool has high liquidity. The TWAP mechansim also requires frequent updating to keep the price fresh and that costs gas. So we'd need an incentive system for every token to be updated which would require a whole new cryptoeconomic game to be invented just to invoke people to keep the price relevant.

### Endogenous Price Floor

Recall that the spot price of tokens on a CFMM such as Behodler or Uniswap V2 is the ratio of reserves. For instance, if there is 10,000 Dai and 20 Eth on Behodler then the spot price of 1 Eth will be 500 Dai. If a token has exactly the same balance as Dai then we know that the spot price is \$1 or 1 Dai.
Suppose we placed a price floor on proxy tokens using a simple rule: if the reserve balance exceeds the current balance for Dai, the proxy contract enters into emergency red light territory. So on every sell we simply ask "is the amount being sold plus the existing balance greater than the Dai balance?"

Now anyone familiar with MEV or flash loan exploits can immediately spot that the risk here is that a deliberate attacker can, in one transaction, flash loan a ton of Dai into Behodler to give themselves room to dump a scam token into Behodler and drain liquidity. So the fix is that on every trade, we record the Dai balance at the end of the trade and we record the current block number. Then on the next trade, we only allow sells in a future block number and using the previously recorded Dai balance. In this way, the attacker would have to devalue Dai in a previous block. Miners, of course, would detect the devaluing and arbitrage the price back to equilibrium before the attack can be carried out.

### How to stop the dump

The next step is to figure out what exactly to do when we detect a token is taking a spiral. Before diving into the solution, we need to keep some top level concepts in mind. Again let's turn to examples.
Suppose we're worried that Sushi may be hyperinflated in the future and we wish to protect Behodler from this fate. So we create a token proxy for Sushi which will protect Behodler from the IL death spiral.

When a user trades Sushi for Eth on the Behdoler front end, they'll have no notion that a proxy was used. They'll approve Sushi for Behodler, execute a sell transaction and receive Eth.
Under the hood, Behodler doesn't have any Sushi in reserve. Instead it has a proxy token stored. So when a trade occurs, the user's sushi is first converted into proxySushi and then sold into Behodler. This is then swapped for Eth. 

Now let's start off with a proxySushi having a redeem rate of 1 with Sushi. Let's assume that Sushi is worth \$1 and that we're trading Sushi for Dai. So a user comes along and sells 10 Sushi. The 10 Sushi is wrapped as 10 proxy Sushi which is then swapped for about 10 Dai and sent to the user.
If the reverse occurs where 10 Dai is swapped for Sushi, the 10 Dai swaps out 10 proxySushi which is then unwrapped as 10 Sushi.
Suppose that instead of having a redeem rate of 1, proxySushi has a redeem rate of 2. That is, if you send in 10 Sushi to mint proxySushi, you'll receive back 5 proxySushi. Now assume someone sells in 10 Dai. Behodler will swap that out for 5 proxySushi which is then unwrapped for 10 Sushi.
In this case, according to Behodler, each proxySushi is worth 2 Dai. But this does not mean Sushi is worth 2 Dai. Instead Sushi stays valued at 1 Dai. So a long as the proxy redeem rate is stable, the actual value can be any number. And the end result will be the same.

Now we come to the magic. A new concept, marginal redeem rate. Until now, we've seen tokens like Weth and Pyrotokens which have a universal redeem rate that applies to everyone equally. But what if we could force a higher redeem rate on a seller under certain conditions? What would this translate to?

Suppose we once again have a token which is worth \$1. Let's call this token RugCoin. We list it on Behodler with a proxy token that starts with a redeem rate of 1. We'll call the proxy token ProxyRug. There are currently 10,000 Dai in Behodler. So by definition, there will be 10,000 ProxyRug in Behodler.
We adopt the rule that when the balance of ProxyRug exceeds the balance of Dai, the ProxyRug contract enters into emergency red light territory. At this point, protective measures kick in.

So along comes someone to sell 100 RugCoin. ProxyRug takes in 100 and notices that the balance will exceed the Dai balance. It calculates the overshoot through taking the ratio of proxyRug/DAI. In this case 10100/10000 = 1.01. This is the redeem rate used in this sale only, the marginal redeem rate. The user ends up minting 100/1.01 = 99 ProxyRug. So instead of sending in 100 ProxyRug, the seller ends up sending in 99 and receives back about 99 Dai.
What happens to the total redeem rate for proxyRug? Well the supply has increased by 99 but the reserves have increased by 100. The new redeem rate is 10100/10099 = 1.00009902. So the total redeem rate has risen by less than the marginal rate faced by the seller.

Before giving commentary on this result, let's do one more example. Let's reset the numbers so that the redeem rate is 1 and the balance of ProxyRug is 10,000. Now a seller attempts to sell 5000 RugCoin for Dai. First, let's remove all safety measures and just allow the full 5000 to be converted into 5000 ProxyRug. 

Plugging into the xy=k formula, because of slippage, the seller gets 3333 Dai out. The new marginal price of proxy  falls to 0.44 Dai.

If Behodler has only 2 tokens listed, Dai and ProxyRug and if we assume that \$0.44 is the new RugCoin value which is why the seller sold exactly that amount, then the value of reserves in Behodler has fallen from 10000x1+10000x1 = \$20,000 to 15000x0.44 + 6666x1 = \$13,266.

That's quite the impermanent loss. Of course if RugCoin continues to fall in value, Behodler eventually becomes a RugCoin wrapper.

Now let's unleash the protective measures and try again.
Seller dumps 5000 RugCoin. ProxyRug enters into red light territory. It calculates the marginal redeem rate as 15000/10000 = 1.5. So it converts 5000 RugCoin into 3333 proxy Rug. Entering the xy=x formula again, only 2499.81 Dai is released to the dumper (as opposed to 3333).

The redeem rate for ProxyRug has also increased. The new redeem rate is 15000/13333 = 1.125.

Now let's calculate impermanent loss from this trade. The initial value was \$20,000. After this trade, it is 13333x1.125 + 7500.19 = 20833.19

What? The value of reserves has increased. Impermanent gain? What sorcery is this? What is going on?

### Discussion on Impermanent Gain.
What does the seller of RugCoin experience when selling all that RugCoin. In the normal example, they see the price fall. Average slippage of 33%. The spot price has fallen by 66% to 0.44 Dai. In the protective example, a front end user sees less Dai coming out. In other words, slippage is higher at about 50%. The final price in Dai of ProxyRug is 7501/15000 = 50c. But since the redeem rate is now 1.125, this means that each RugCoin is valued at \$0.5625.
The front end will report that after the sale of 5000 RugCoin, the price of RugCoin on Behodler is 0.5625 Dai. Recall that we claimed that the market price has fallen to 44c. So there's still more trading to be done. More Rug needs to be sold. 
Here, the seller experiences a higher average slippage of 50% but the marginal price is impacted by only 44% which is less than the 66% in the unprotected example.
So the seller absorbs more of the price impact, sparing the rest of the market.

In traditional AMMs, when the price of the token falls, the liquidity providers bear the brunt through impermanent loss. In this new paradigm, the seller bears the brunt through exaggerated slippage. Essentially, when a token enters a death spiral, the supply might try to dump on Behodler but it will all come crashing up against a cliff face that says "You shall not pass!" to impermanent loss. Not only does the token not cause the Scarcity price to fall but the aggressive action taken actually causes the value of reserves in Behodler to be higher! Impermanent gain.

The bottom line is that we can pick a token such as Dai to be a reference token. We then draw a line in the sand so that if any CliffFace wrapped token attempts to dump on Behodler, it forces the dumping sellers to absorb the full cost of the dump through exaggerated price impact. Arbitrage bots are neutralized from hurting Behodler. The extent to which reserves exceed the balance of Dai determines the price impact penalty. As soon as reserves fall below Dai, the penalty falls away. 
The result for Behodler when high slippage kicks in is a rising value of reserves, impermanent gain. So that a dump actually causes the value of Scarcity to rise.
Finally, we sample the Dai balance in previous blocks. In this way, we recruit MEV seeking miners to protect Behodler from malicious entities who try to dump Dai onto behodler to trick the AMM into allowing more of a malicious token to be dumped.

## Some final questions
1. Why Dai?
There's no magical reason but getting a bottom line dollar value gives quite a nice intuition. We could use Eth or EYE as the reference token. The problem is that if the reference token experiences a big price rise, the relative levels of liquidity of the rising price token will fall. When that happens, all the remaining tokens are in danger of falling into red light territory. Essentially we'd be requiring tokens to outperform ETH in order to enjoy normal slippage. Perhaps in the future, we might intentionally do this as a way of supercharging Scarcity but for now, we don't want to scare away all traders. Let's wait until we have a bit of a network effect.
2. What if the token price falls to zero?
The formula for calculating the marginal redeem rate ensures that the slippage will asymptotically approach infinity. Eventually Behodler will just suck up all that excess junk into a black hole and release only a faint Hawking radiation of output tokens. 
3. What if the crashing token supply is limited?
We may see a point where, after raiding Uniswap, the rest of the entire token supply is dumped into Behodler. At this point, it would appear that the Behodler price is higher than the market price. Perhaps the entire supply will be drawn into Behodler. But then at this point, Behodler's price *is* the market price so it becomes a philosophical issue. Nonetheless the rot is stemmed.
4. What if the token price actually falls to zero because it's a rug? Won't all that reserve be worth nothing? 
Yes. Absolutely. But the breath of relief is that it didn't take down the entire AMM with it. There will be some drain as the token spirals downwards, it will take some liquidity out of Behodler but the asymptotic slippage will kick in and protect Behodler. So in this scenario Behodler makes a net loss but most liquidity will remain intact. 
5. I can see how this boosts the value of SCX but does this help EYE or Flan? 
CliffFace allows us to risk listing much riskier tokens than before. In the previous article (on Medium), I mentioned that being able to sell Fate to prospective projects would create a kind of Curve Wars situation for EYE. The more projects we can allow into this bidding process, the more demand for EYE. So by opening up listings on Behodler, EYE gains enormous value. Flan? Well remember that Flan is approximately pegged to Dai. If the value of Flan falls, traders might rush in to sell Flan on Behodler for Dai. However, if we list Flan via CliffFace, the sellers will absorb the cost of the price drop when it falls below \$1. The net result will be that Flan's value on Behodler will have a robust price floor and traders will find it hard to push it below \$1. Indeed, they could try dumping on Uniswap, Sushiswap etc but then the net result will be the Flan price is low on Uniswap and \$1 on Behodler. So arbitrageurs will buy Flan on Uniswap until the price goes up to \$1 and try dumping on Behodler, only to find resistance on the way down. The end result may be a lower than \$1 price for Flan but the price impact would be far less. Perhaps instead of falling to 89c, the price falls to 95c. What's more, a much bigger supply of Flan will be locked in Behodler (and as PyroFlan) than in the vanilla AMM scenario. So we get stablecoin protection for free. 
6. Won't traders just take their tokens and trade elsewhere?
To paraphrase Anakin Skywalker (techically Darth Vader at that point), they will try. Initially traders will sell on Uniswap when they encounter the high slippage on Behodler. But at some point, the Uniswap price will be so low, that the Behodler slippage will be worth the penalty. The overall result is that when a token rug pulls, the market primarily dumps it on *other* AMMs, draining their liquidity while sparing Behodler from the spreading contagion.
7. Will this impact gas? 
Yes, the gas costs of using a proxy will be higher than for a pure token trade. So for super trustworthy tokens such as Weth or Dai, it is worth leaving them unwrapped. But for just about any other token, one never knows how long the project will continue to thrive so it's always better to play it safe. The community will have to decide if it wants to remove the existing tokens on Behodler and reintroduce them wrapped in CliffFace.
8. PyroCliffFace?
PyroTokens are based on tokens listed on Behodler. So technically we'd be creating PyroTokens of the proxy wrapper tokens. Again the UI devs will have to cover this so that the minting and redemption process happens seamlessly from base token to PyroToken without mentioning the proxyWrapper to the end user. The reported redeem rate on the front end will be the redeem rate of the PyroToken multiplied by the redeem rate of the proxy. What this means is that the CliffFace contract inadvertantly accelerates PyroToken performance whenever it enters into red light territory. So a secondary incentive for dumpers will be to dump into the PyroToken in anticipation of super charged redeem rate growth instead of dumping into Behodler. Imagine holding PyroFlan and knowing that everytime the Flan price drops below \$1, the PyroFlan redeem rate suddenly starts ticking up faster. Then when the price returns to \$1, you have that much more Flan. So PyroFlan therefore acts as yet another mechanism protecting the 1 Dai price floor of Flan by sucking up dumping trades instead of releasing them into other AMMs. 
9. What happens when the price of a CliffFace token exceeds the price floor? 
Trading continues as before. This mechanism only kicks in to prevent death spirals, not to interfere with regular trade. 
10. Is the 1 Dai floor necessary?
Just as Dai is not absolute, so the 1 Dai floor is not absolute. In the Flan example, we may decide to make the floor 0.75 to give the token a bit of breathing room in the first few weeks of existence. We may list a token that's only worth 30 cents at listing and so make the floor 5 cents.
11. Wen?
Code is being completed in tandem with this document. I decided to submit the document first to make sure all the high level concepts were in place before completing the code and testing.

# Beyond Behodler
This example outlines an important fact about DeFi: tokens with different logic pose a threat to the stability of protocols. The token proxy route might be a necessary standard all protocols adopt. To this end, it might be worth pursuing an ERC number for it. In any event, the interface will be standardized across the Behodler ecosystem so that the UI devs know how to handle proxy tokens.

More specifically, CliffFace can be used to protect any AMM from IL death spirals. Suppose we create a pair on Uniswap of two CliffFace versions of WBTC and WETH. We'd have a wrapper for two of the best tokens but with a floor on impermanent loss. At worst it performs like a stablecoin pair and at best, it's WBTC and WETH, for goodness sake. 
If we have the time and resources, I'd like to create a trading window to Uniswap and Sushiswap on the Behodler site but with only CliffFace tokens visible. 

Liquidity providers make everything possible in DeFi and yet AMMs don't do enough to protect those who provide liquidity to volatile pools. Say no to bottomless impermanent loss and let the waves of dumping MEV arb bots crash against the impenetrable cliff face of token proxies.
