# Purpose

In order to safely deploy the Behodler Ecosystem, either partially or fully, it is important to understand the various dependencies so that scripts can be written and json files populated appropriately

# High Level Order of Instantiation

## Behodler

### Behodler (is Scarcity)

**Dependencies: weth,lachesis,flashloanArb,liquidityReceiver,weidaireserve,dai,weidai**
Initializers:
    1. seed(weth, lachesis, flashloanArb,liquidityReceiver, weidaiReserve, dai,WeiDai)
        ->flashLoanArb can be null
    2. configureScarcity (t-fee,b-fee,treasury)

### Lachesis

**Dependencies: uniswapFactory,sushiSwapFactory, Behodler**
Initializers: setBehodler

### LiquidityReciever

**Dependencies: lachesis**
Initializers: setLachesis

### Pyrotoken (v2)

**Dependencies: baseToken, liquidityReceiver**

### PyroWeth10Proxy

**Dependecies: PyroWeth**

### Order of Deployment

1. Weth
2. Behodler
3. Lachesis
4. LiquidityReceiver (lachesis)
5. Behodler.seed
6. Lachesis.setBehodler
7. LiquidityReceiver.RegisterPyroWeth
8. PyroWeth10Proxy (pyroweth)

## Morgoth

### Powers

**Dependencies: none**
Establishes deployer as Melkor (admin)
Initializer: seed()
    -> creates crucial bootstrapper minions

### Angband

**Dependencies: powers, behodler, lachesis**
Instantiates IronCrown. Angband maps all addresses in DAO and oversees the execution of proposals
Initializers:
    1. finalizeSetup()
    2. setBehodler (behodler,lachesis)
        -> ironCrown has SCX address initialized

### IronCrown

Auto instantiated by Angband
**Dependencies: Behodler**

### Order of Deployment

1. Powers
2. Powers.seed()
3. Angband
4. Angband.finalizeSetup()
5. Transfer Lachesis and Behodler to Angband
6. Angband.setBehodler()
7. Angband.mapDomain (liquidityReceiver)
8. Angband.mapDomain (PyroWeth10Proxy)

Note: on every powerInvoker, remember to call changePower after deploy

## PyroTokens (V3)

### BigConstants

Storing the creation code in liquidity receiver violates EIP-170. BigConstants is a way of getting around that limitation.
**Dependencies: none**

### LiquidityReceiver (Ownable)

**Dependencies: lachesis, bigConstants, snufferCap (optional), loanOfficer(optional)**
Initializers:
    1. setSnufferCap
    2. setDefaultLoanOfficer

### PyroToken

**Dependencies: LiquidityReceiver, baseToken, rebase wrapper, bigConstants**
Initializers:
    1. initialize(baseToken, name,symbol,decimals, bigConstants)

### PyroWeth10Proxy

**Dependencies: pyroWeth**

### RebaseWrapper

**Dependencies: PyroTokens, liquidityReceiver**

### ProxyHandler

Must be exempt from Pyro transfer and redeem fees

### V2Migrator

**Dependencies:LiquidityReceiver(V3), Lachesis**

## DeployerSnufferCap

**Dependencies: Limbo, liquidityReceiver**
**Dependants: LiquidityReceiver**

### Order of Deployment

1. BigConstants
2. LiquidityReceiver
3. DeployerSnufferCap
4. LiquidityReceiver.setSnufferCap(DeployerSnufferCap)
5. LiquidityReceiver.registerPyroTokens
6. LiquidityReceiver.registerPyroToken (PyroWeth)
7. PyroWeth10Proxy
8. DeployerSnufferCap -> exempt PyroWeth10RPoxy and proxyHandler
7. ProxyHandler
8. V2Migrator

## Limbo

### ProposalFactory

**Dependencies: limboDAO, whitelistngProposal, soulUpdateProposal,behodler, angband, uniswapHelper, morgothPower**
Initializers: COnfigureCrossingCOnfig

### LimboDAO

Important calibration: voting proposal times, approved assets for staking
Important post deployment calibration: DAO.setGoverned over all governable contracts. This must be the very last step before ending config Lord's dominion
**Dependencies: Limbo, Flan, EYE, flashGoverner, sushiOracle, uniOracle**
Initializers:
    1. setFlashGoverner
    2. seed
    3. SetFateSpender

### FlashGovernanceArbiter

**Dependencies: limboDAO, EYE**
Imporant calibration: lock time must be greater than voting proposal times in limboDAO. (Enforced in code)
Default lock time 6 days.
Initializers:
    1. SetGoverned
    2. configureFlashGovernance
    3. configureSecurityParameters

### MorgothTokenApprover

**Dependencies: ProxyDeployer (lib), TokenProxyRegistry, Reference Token, Behodler, Limbo, Flan**
Initializers:
    1. updateConfig. Callable by Morgoth only

### Limbo

**Dependencies: flan, limboDAO, uniswapHelper, morgothMigrationPower, behodler, angband**
Initializers:
    1.configureCrossingConfig

### Flan

**Dependencies: limboDAO**
Initializers: setMintConfig

### TokenProxyRegistry

**Dependencies: limboDAO, limboAddTokenToBehodler, behodler, morgothTokenApprover**
Initializers:
    1. setPower
    2. setTokenApprover

### UniswapHelper

**Dependencies: limbo, limboDAO,UniswapV2Factory,Dai, Behodler, Flan, LimboOracle, UniV2 LP tokens: FLN/SCX, DAI/SCX, SCX/(FLN/SCX)**
Initializers:
    1. SetDai (only for non mainnet)
    2. configure

### LimboOracle

**Dependencies: UniswapV2Factory**

## Limbo Proposals

**Dependencies: LimboDAO**
Initializers: parameterize.
Important info: Locking modifier so that parameters can't be changed once a proposal has been lodged. Proposals that don't implement the locking mechanism will fail on execution.

### ToggleWhiteListProposalProposal (not typo)

**Dependencies: ProposalFactory**
Note: deploying this proposal is mandatory and is enforced by the ProposalFactory constructor.

### UpdateMultipleSoulConfigProposal

**Depedencies: Limbo, MorgothTokenApprover, TokenProxyRegistry, baseTokens, limboProxyTokens, behodlerProxyTokens**
Additional Intilialzer: setProxy

### BurnFlashStakeDeposit

**Dependencies: flashGoverner, targetContract (that is flash governed)**

### ApproveFlanMintintProposal

**Dependencies: Flan must exist on LimboDAO during execution**

### ConfigureFlashGovernanceProposal

**Dependencies: none but FlashGovernanceArb must exist on LimboDAO**

### SetFateSpendersProposal

**Dependencies: None**

### SetAssetApprovalProposal

#### Dependencies: None

### Order of Deployment

1. LimboDAO
2. WhiteListProposal
3. MorgothTokenApprover
4. MultiSoulConfigUpdateProposal (with tokenApprover)
5. ProposalFactory
6. FlashGovernanceAbrbiter and initializers
7. Flan and setMintConfig
8. Morgoth.LimboAddTokenToBehodler
9. UniswapHelper
10. LimboOracle
11. Limbo
12. UniswapHelper.configure
13. LimboDAO.seed
14. Limbo.configureCrossingConfig
15. MorgothTokenApprover.updateConfig
16. Morgoth: Transfer and Map domain for MorgothTokenApprover
17. ConfigureTokenApprover and whitelisting on Morgoth
18. TokenProxyRegistry and set Approver and set Power
19. All the proposals
20. Whitelist all the proposals
21. Assign Power to Limbo minion and make Limbo that minion
22. Transfer LimboDAO to Morgoth and map domain

## Total Deployment Prior to Genesis

* Weth
* Behodler
* UniswapFactory,
* BehodlerTokens,
* Lachesis
* LiquidityReceiver (lachesis)
* Behodler.seed
* Lachesis.setBehodler
* LiquidityReceiver.RegisterPyroWeth
* PyroWeth10Proxy (pyroweth)
* Powers
* Powers.seed()
* Angband
* Angband.finalizeSetup()
* Transfer Lachesis and Behodler to Angband (scx point to ironcrown)
* Angband.setBehodler()
* Angband.mapDomain (liquidityReceiver)
* Angband.mapDomain (PyroWeth10Proxy)
* BigConstants
* LiquidityReceiver
* DeployerSnufferCap
* LiquidityReceiver.setSnufferCap(DeployerSnufferCap)
* LiquidityReceiver.registerPyroTokens
* LiquidityReceiver.registerPyroToken (PyroWeth)
* PyroWeth10Proxy
* DeployerSnufferCap -> exempt PyroWeth10RPoxy and proxyHandler
* ProxyHandler
* V2Migrator
* LimboDAO
* WhiteListProposal
* MorgothTokenApprover
* MultiSoulConfigUpdateProposal (with tokenApprover)
* ProposalFactory
* FlashGovernanceAbrbiter and initializers
* Flan and setMintConfig
* Morgoth.LimboAddTokenToBehodler
* UniswapHelper
* LimboOracle
* Limbo
* UniswapHelper.configure
* LimboDAO.seed
* Limbo.configureCrossingConfig
* MorgothTokenApprover.updateConfig
* Morgoth: Transfer and Map domain for MorgothTokenApprover
* ConfigureTokenApprover and whitelisting on Morgoth
* TokenProxyRegistry and set Approver and set Power
* All the proposals
* Whitelist all the proposals
* Assign Power to Limbo minion and make Limbo that minion
* Transfer LimboDAO to Morgoth and map domain
* Flan Genesis
Important to note: we can get above script ready before completing genesis event so that PyroTokens3 can proceeed.

Current thinking of Flan Genesis:

1. Mint Flan equal to Dai balance on Behodler.
2. TokenProxy.createCliffFace (protectLimbo:false) for Flan
    * reference Dai, reference multiple 0.7
3. Lachesis.measure(flanCliff, true,false)
4. Deposit minted Flan into Behodler via cliffFace.
5. Collect SCX generated.
6. Mint Flan equal in value (assuming $1) to SCX minted.
7. Pair with SCX in UniV2 -> generates SCX/FLN LP token: LP_1
8. Lachesis.measure (SCX/FLN LP, true, false) -> mints SCX_2
9. Pair SCX_2 with equivalent LP_1 to create scx__fln_scx -> mints LP_2
10. Lachesis.measure LP_2 and mint SCX.
11. On Uni, create dai_scx and seed with as much Dai as possible.
12. TokenProxyRegistry.createCliffFace (dai_scx)
13. Lachesis.measure(dai_scx cliff, true, false) and deposit to mint SCX
14. Create and seed Flan/EYE UniV2 LP
15. Lachesis.measure (Flan/EYE LP, true, false) and mint SCX
16. Create PyroFlan/SCX LP
17. Lachesis.measure (PyroFlan/SCX LP, true, false), mint
18. Burn all remaining SCX
