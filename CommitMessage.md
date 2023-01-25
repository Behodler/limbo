# Jan 25

## Governable

Proposals which execute important functions via the DAO need to work. For instance, suppose contract X is a subcontract (ie. subclass) of Governable.sol and it has a function DoSomething which has the modifier onlySuccessfulProposal. Now suppose LimboDAO wants to call that function. It should be able to as though it's a proposal since it is the source of governance.
LimboDAO is therefore considere a "successful proposal"

## CliffFace

Logic bug fix

## Common.ts

Order of deployments changed because of dependency issues. The web of dependencies is pretty intense. If I didn't write this deployment script and just tried to deploy by hand, I'd have to change the project name from Limbo to Purgatory.

## Deployment Script and Orchestrate

- Sections which do not deploy but which just configure are now recorded as empty blocks in the json file. This is to provide a mechanism to skip these sections on mainnet.

- Behodler the AMM is now prejuiced with liquidity. By adding this section in the mainnet file with an empty block, it will be skipped. But in testnets, it can be run.

- CliffFace proxy is employed on Flan. So PyroFlan wraps CliffFaceFlan which wraps Flan. This requires proxyHandler to be exempt of pyroFlan transfer to fees. This is where deployerSnufferCap comes in. DeployerSnufferCap is a snufferCap that only has admin powers in the deployment script and immediately after, becomes inert.

### TODO on Deployment Script

Flan Genesis logic. Mostly to get the reference pair up and running, filled with liquidity so as to ease the fears of Womble. This can happen in parallel to the UI work.

## Wargame Ropsten.ts (probably should be renamed)

- Added a test to test behodler trading of a cliffFace proxy as well as the effects on the respective pyroToken. The token in question is Flan.

### TODO on ropsten.ts: gas benchmarks

This can actually be in other tests. But we need to benchmark the gas usage of CliffFace. I suspect it will be high. It may be that trading a cliffFace token is more gassy than Uniswap but that may be acceptable for 3 reasons:

1. The benefit of CliffFace proxies to SCX can't be understated.
2. Flan Cliff Face would go a long way in preventing Flan's price from crashing, giving us the power to mint more for rewards and adding stability to Flan.
3. Gas prices on mainnet will probably never reach absurd levels again because of all the L2 and sidechains and because Eth architecure is becoming increasingly higher throughput. If we list Behodler and LPs on L2s then when presented with a high gas cost of using cliff face to sell Flan, users may opt to rather bridge the Flan to say Optimism and sell on Optimism Behodler or Optimism Uniswap. Gas arbitrage is becoming increasingly easy with the fee charging instant bridges. This natural tendency of mainnet to only accept large transactions is a consequence of L2s that hasn't really even begun.