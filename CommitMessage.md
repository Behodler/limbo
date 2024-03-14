# CliffFace readiness

## Refresher on cliff face

### Impermanent Loss Death Spiral

Suppose a scam team creates a token called scamX and pairs it to Eth, gathers liquidity and then rugs, driving the price of scamX to zero. The result will be all holders of scamX sell into the pair, draining it of Eth. The pair then just becomes a wrapper token for scamX. We can call this situation the impermanent loss death spiral.

The spiral is only isolated to pairs that contain scamX. So the rest of Uniswap is largely unaffected. This is why listing LP tokens is open and unpermissioned.

### Extending to Balancer

Some AMMs like Balancer have more than one token. In this case, a Balancer pair with scamX, Dai, Eth, WBTC and Uni is created. When scamX crashes, all the remaining tokens are driven to almost zero balance, similar to a pair AMM. The risk for balancer LPs is higher because more tokens are exposed to the rot.


### Extending Balancer to Behodler

Behodler has all its tokens on one so, to speak. It's an n-dimensional AMM. This means that scamX would allow the scammers to drain the whole of Behodler and SCX would become a 1:1 wrapper of scamX.


### Solution 1: permissioned Limbo listing

The first solution is to use governance mechanisms to prevent bad tokens from listing. This is the primary purpose of LimboDAO. To block bad token listing and to offer Limbo emergency protections. For instance, anyone can trigger an emergency shutdown of Limbo. All that is required is to lock a big chunk of EYE. The community can then vote if the shutdown was a grief attack and burn the locked EYE. If it was a legitimate shutdown, the locked EYE is released.

#### Problems with Solution 1:

1. Good tokens can go bad. Even Dai can go into terminal decline. No matter how well vetted the governance procedures are, even honest tokens can fail
2. Seemingly bad tokens can turn out to be legitimate or can become good later, costing the Behodler community in lost opportunities.
3. Too much governance. If every token has to be audited and vetted, it could take very long to get anything listed and reduce the utility of Limbo.
4. Some tokens are good but have unusual properties such as rebasing that make them unsuitable for listing.

### Solution 2: Proxies

We introduced a proxy mechanism whereby tokens could be wrapped in protective proxy tokens. The main proxy on Behodler is the CliffFace token. This token is designed to detect sudden dumping into Behodler. It responds by providing sellers with super high slippage. However, if all liquidity is rising on Behodler because of good market conditions, CliffFace doesn't penalize sellers who may just be minting SCX rather than dumping.

Proxies allow the listing of any token on Limbo and Behodler without safety concerns, potentially opening it up to be as open as traditional open AMMs like Uniswap and Balancer, but without the risk to liquidity providers of scams.

In short, proxies make Behodler permissionless.

## UI upgrades


### LimboUI 

LimboUI needs a bit of refitting for both the new oracle code post audit and for Limbo proxies. The purpose of Limbo proxies is to allow users to stake rebase tokens and tokens that receive secondary rewards without causing loss to users or broken, reverting logic.

### Behodler Swap

Behodler swap needs to accomodate cliff face tokens under the hood so that users aren't aware they're even using a proxy. So for instance, if we list Uni in a cliff face wrapper, the Behodler UI will just show UNI in the token lists.
The only giveaway that it's in a cliffFace proxy is a higher gas cost for swapping.

### Behodler PyroTokens

A PyroToken of CliffFace of Uni will technically be a PyroCliffFace token. There will be 2 redeem rates. First the redeem rate of the PyroToken in terms of CliffFace tokens and then the CliffFace token in terms of Uni. 

Suppose PyroUni redeem rate is 2. This means 1 PyroUni can be redeemed for 2 CliffFace wrappers of Uni. Now suppose the CliffFace redeem rate for UNI is 1.5. Ultimately, redeeming 1 unit of PyroUni will produce 2x1.5 = 3 units of UNI.

What we want in the PyroToken UI is for the redeem rate the end user sees to be this composed redeem rate, 3. We also want minting and redeeming to go straight from UNI to PyroUNI on the UI. Once again, the end user should not be aware that proxies exist, except for evidence on the blockchain.

All of the above has been produced and audited on the contract level. It's just a matter of catchup for the PyroUI.

## This commit

For this commit, we needed to list a bunch of cliffFace tokens on the testnets so that a front end dev (note I didn't necessarily say I) can make the necessary adjustments to Pyro and Swap on Behodeler.

There was code in place on the contract level but Morgoth DAO was not aware of this. So those i's and t's were dotted (and tested).

### Future

As promised, we will be providing an updated roadmap but this commit and a negotiation needed to conclude. Said negotiations are nearing their final stages.

### Bonus

We've ironed out a tentatively simplified GUL model that allows for rapid deployment to L2s without contract level changes. We want to colonize as many low gas cost, high TVL L2 chains as possible and govern them all with an ever declining supply of EYE, spead out over many chains. We also want to make sure that SCX and Flan benefit from every new chain conquered. More on that in the future.