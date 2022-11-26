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

## Limbo Proposals. 
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
**Dependencies:: None**

### SetAssetApprovalProposal
**Dependencies:: None**

### Order of Deployment
1. LimboDAO
2. WhiteListProposal
3. MorgothTokenApprover
3. MultiSoulConfigUpdateProposal (with tokenApprover)
4. ProposalFactory
5. FlashGovernanceAbrbiter and initializers
6. Flan and setMintConfig
7. Morgoth.LimboAddTokenToBehodler
8. UniswapHelper
9. LimboOracle
10. Limbo
11. UniswapHelper.configure
12. LimboDAO.seed
13. Limbo.configureCrossingConfig
14. MorgothTokenApprover.updateConfig
15. Morgoth: Transfer and Map domain for MorgothTokenApprover
16. ConfigureTokenApprover and whitelisting on Morgoth
17. TokenProxyRegistry and set Approver and set Power
18. All the proposals
19. Whitelist all the proposals
20. Assign Power to Limbo minion and make Limbo that minion
21. Transfer LimboDAO to Morgoth and map domain

# Total Deployment Prior to Genesis
1. Weth
2. Behodler
3. Lachesis
4. LiquidityReceiver (lachesis)
5. Behodler.seed
6. Lachesis.setBehodler 
7. LiquidityReceiver.RegisterPyroWeth
8. PyroWeth10Proxy (pyroweth)
9. Powers
10. Powers.seed()
11. Angband
12. Angband.finalizeSetup()
13. Transfer Lachesis and Behodler to Angband
14. Angband.setBehodler()
15. Angband.mapDomain (liquidityReceiver)
16. Angband.mapDomain (PyroWeth10Proxy)
17. BigConstants
18. LiquidityReceiver
19. DeployerSnufferCap
20. LiquidityReceiver.setSnufferCap(DeployerSnufferCap)
21. LiquidityReceiver.registerPyroTokens
22. LiquidityReceiver.registerPyroToken (PyroWeth)
23. PyroWeth10Proxy
24. DeployerSnufferCap -> exempt PyroWeth10RPoxy and proxyHandler
25. ProxyHandler
26. V2Migrator
27. LimboDAO
28. WhiteListProposal
29. MorgothTokenApprover
30. MultiSoulConfigUpdateProposal (with tokenApprover)
31. ProposalFactory
32. FlashGovernanceAbrbiter and initializers
33. Flan and setMintConfig
34. Morgoth.LimboAddTokenToBehodler
35. UniswapHelper
36. LimboOracle
37. Limbo
38. UniswapHelper.configure
39. LimboDAO.seed
40. Limbo.configureCrossingConfig
41. MorgothTokenApprover.updateConfig
42. Morgoth: Transfer and Map domain for MorgothTokenApprover
43. ConfigureTokenApprover and whitelisting on Morgoth
44. TokenProxyRegistry and set Approver and set Power
45. All the proposals
46. Whitelist all the proposals
47. Assign Power to Limbo minion and make Limbo that minion
48. Transfer LimboDAO to Morgoth and map domain


# Flan Genesis
Important to note: we can get above script ready before completing genesis event so that PyroTokens3 can proceeed.

Current thinking of Flan Genesis:
1. Mint Flan equal to Dai balance on Behodler.
2. TokenProxy.createCliffFace (protectLimbo:false) for Flan
    - reference Dai, reference multiple 0.7
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
