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
9. <PyroV3>
10. Angband.mapDomain (<PyroV3>)
11. <Limbo>
12. Angband.mapDomain (<Limbo>)

Note: on every powerInvoker, remember to call changePower after deploy

## PyroTokens (V3)
*TODO: Create a snufferCap that's controlled by LimboProposals*
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
**Dependencies: Limbo**

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
**Dependencies: limboDAO, whitelistngProposal, soulUpdateProposal**
### LimboDAO
Important calibration: voting proposal times, approved assets for staking
Important post deployment calibration: DAO.setGoverned over all governable contracts. This must be the very last step before ending config Lord's dominion
**Dependencies:**
### FlashGovernanceArbiter
Imporant calibration: lock time must be greater than voting proposal times in limboDAO. (Enforced in code)
Default lock time 6 days.
### Limbo
### Flan
### BigConstants
### TokenProxyRegistry
### UniswapHelper

## Limbo Proposals
### ToggleWhiteListProposalProposal (not typo)
### UpdateSoulConfigProposal
**Dependencies: MorgothTokenApprover**
### UpdateMultipleSoulConfigProposal
**Dependencies: MorgothTokenApprover**
### BurnFlashStakeDeposit
### ApproveFlanMintintProposal
### ConfigureFlashGovernanceProposal
### SetFateSpendersProposal
### SetAssetApprovalProposal

### Order of Deployment
1. DAO
2. WhiteListProposal
3. Create MorgothTokenApprover
3. SoulConfigUpdateProposal (with tokenApprover)
4. ProposalFactory
5. Morgoth.mapDomain SoulConfigUpdateProposal
....

TODO: make limbo a morgoth minion so that it can migrate