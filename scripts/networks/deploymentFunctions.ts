import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { BigNumber, BigNumberish, Contract, ContractTransaction } from "ethers";
import {
  OutputAddress, deploymentFactory, OutputAddressAdder,
  Sections, AddressFileStructure, contractNames, sectionName,
  stringToBytes32, criticalPairNames, tokenNames,
  behodlerTokenNames, ITokenConfig
} from "./common";
import * as Types from "../../typechain";
import shell from "shelljs"


interface IDeploymentFunction {
  (params: IDeploymentParams): Promise<OutputAddress>
}

enum FeeExemption {
  NO_EXEMPTIONS,

  SENDER_EXEMPT,
  SENDER_EXEMPT_AND_RECEIVER_EXEMPT,
  REDEEM_EXEMPT_AND_SENDER_EXEMPT,

  REDEEM_EXEMPT_AND_SENDER_EXEMPT_AND_RECEIVER_EXEMPT,

  RECEIVER_EXEMPT,
  REDEEM_EXEMPT_AND_RECEIVER_EXEMPT,
  REDEEM_EXEMPT_ONLY
}

export function sectionChooser(section: Sections): IDeploymentFunction {

  switch (section) {
    case Sections.PreChecks: return prechecks
    case Sections.PreCheckMelkor: return precheckMelkor
    //Behodler v2
    case Sections.Weth: return deployWeth
    case Sections.Behodler: return deployBehodler
    case Sections.UniswapV2Clones: return deployUniclones
    case Sections.BehodlerTokens: return deployBehodlerTokens
    case Sections.AddInitialLiquidityToBehodler: return addInitialLiquidityToBehodler
    case Sections.Lachesis: return deployLachesis
    case Sections.LiquidityReceiverOld: return deployOldLiquidityReceiver
    case Sections.PyroWeth10Proxy: return deployPyroWeth10ProxyOld //remember to use deployOldPyro
    case Sections.MultiCall: return deployMultiCall

    //Morgoth
    case Sections.Powers: return deployPowers
    case Sections.Angband: return deployAngband
    case Sections.BigConstants: return deployBigConstants
    case Sections.ConfigureScarcityPower: return deployConfigureScarcityPower

    //Pyrotokens3:
    case Sections.LiquidityReceiverNew: return deployNewLiquidityReceiver
    case Sections.BehodlerSeedNew: return reseedBehodler
    case Sections.RefreshTokensOnBehodler: return refreshTokensOnBehodler
    case Sections.ConfigureIronCrown: return async (params: IDeploymentParams) => { params.logger("deliberately not implemented"); return {} as OutputAddress }
    case Sections.MorgothMapLiquidityReceiver: return mapLiquidityReceiver
    case Sections.MorgothMapPyroWeth10Proxy: return async (params: IDeploymentParams) => { params.logger("deliberately not implemented"); return {} as OutputAddress }
    case Sections.DeployerSnufferCap: return deployDeployerSnufferCap
    case Sections.PyroWethProxy: return deployPyroWethProxy
    case Sections.SnuffPyroWethProxy: return snuffPyroWethProxy
    case Sections.ProxyHandler: return deployProxyHandler
    case Sections.V2Migrator: return deployV2Migrator

    //LIMBO

    //Proposal subsection
    case Sections.LimboDAO: return deployLimboDAO
    case Sections.WhiteListProposal: return deployWhiteListProposal
    case Sections.MorgothTokenApprover: return deployMorgothTokenApprover
    case Sections.MultiSoulConfigUpdateProposal: return deployMultiSoulConfigUpdateProposal
    case Sections.ProposalFactory: return deployProposalFactory;
    case Sections.TokenProxyRegistry: return deployTokenProxyRegistry
    case Sections.SoulReader: return deploySoulReader
    case Sections.FlashGovernanceArbiter: return deployFlashGovernanceArbiter

    case Sections.Morgoth_LimboAddTokenToBehodler: return deployLimboAddTokenToBehodlerPower

    //Limbo subsection
    case Sections.UniswapHelper: return deployUniswapHelper;
    case Sections.Limbo: return deployLimbo
    case Sections.MorgothTokenApproverUpdateConfig: return morgothTokenAppoverUpdateConfig

    //FLAN Genesis
    case Sections.Flan: return deployFlan
    case Sections.RegisterFlanAndPyroOnBehodlerViaCliffFace: return registerFlanOnBehodlerViaCliffFace
    case Sections.FlanSetMintConfig: return flanSetConfig
    case Sections.FlanGenesis: return flanGenesis
    // case Sections.PyroFlanBooster: return deployPyroFlanBooster
    //FLAN Genesis END

    //Oracle subsection
    case Sections.LimboOracle: return deployLimboOracle
    case Sections.TradeOraclePairs: return tradeOraclePairs
    case Sections.RegisterOraclePairs: return registerOraclePairs

    //Seed, configure and finalize subsection
    case Sections.UniswapHelperConfigure: return configureUniswapHelper
    case Sections.LimboTokens: return deployLimboTokens
    case Sections.LimboDAOSeed: return limboDAOSeed
    case Sections.LimboConfigureCrossingConfig: return limboConfigureCrossingConfig

    case Sections.MorgothMapApprover: return morgothMapApprover
    case Sections.ConfigureTokenApproverPower: return deployConfigureTokenApproverPower
    case Sections.TPR_setApprover_setPower: return configureTPR
    case Sections.LimboDAOProposals: return deployAllLimboDAOProposals
    case Sections.FlashgovSetAllToGovernable: return setAllGovernable
    case Sections.EndConfigForAll: return endConfigForAllGovernables
    case Sections.MorgothLimboMinionAndPower: return morgothMapLimboMinionAndPower
    case Sections.MorgothMapLimboDAO: return mapLimboDAO

    case Sections.DisableDeployerSnufferCap: return disabledDeploymentSnufferCap
    default:
      throw "invalid Section enum selection"
  }
}

interface ethersLib {
  [key: string]: string
}

export const getContractFromSection = (existing: AddressFileStructure, debugLabel?: string) =>
  async function <T extends Contract>(section: Sections,
    contractName: contractNames,
    factoryName?: string,
    libraries?: ethersLib) {

    const loadName = factoryName || contractName
    let factory = await (
      libraries ? ethers.getContractFactory(loadName, {
        libraries
      }) : ethers.getContractFactory(loadName))

    const address = existing[sectionName(section)][contractName]
    if (!address || address.startsWith("0x00000000000000000000000000"))
      throw debugLabel || "" + contractName + " has not been deployed yet"
    return factory.attach(address) as T
  }

export interface IDeploymentParams {
  deployer: SignerWithAddress,
  existing: AddressFileStructure,
  logger: (message: string) => void,
  broadcast: (name: string, transaction: Promise<ContractTransaction>) => Promise<ContractTransaction>
}


const deploySoulReader: IDeploymentFunction = async function (params: IDeploymentParams): Promise<OutputAddress> {
  let deploy = deploymentFactory(Sections.LimboDAOProposals, params.existing)

  const SoulReader = await ethers.getContractFactory("SoulReader");
  const soulReader = await deploy<Types.SoulReader>("SoulReader", SoulReader);
  return OutputAddressAdder<Types.SoulReader>({}, "SoulReader", soulReader);
}

const getBehodler = async (existing: AddressFileStructure): Promise<Types.Behodler> => {
  const getContract = await getContractFromSection(existing)

  const addressBalanceCheck = await getContract(Sections.Behodler, "AddressBalanceCheck")

  const behodlerLib: ethersLib = {
    AddressBalanceCheck: addressBalanceCheck.address
  }
  return await getContract<Types.Behodler>(Sections.Behodler, "Behodler", "Behodler", behodlerLib)
}

const configureUniswapHelper: IDeploymentFunction = async function (params: IDeploymentParams): Promise<OutputAddress> {
  const getContract = await getContractFromSection(params.existing)

  const limbo = await getLimbo(params.existing)
  const behodler = await getBehodler(params.existing)
  const flan = await getContract<Types.Flan>(Sections.Flan, "Flan")
  const limboOracle = await getContract<Types.LimboOracle>(Sections.LimboOracle, "LimboOracle")

  const uniswapHelper = await getContract<Types.UniswapHelper>(Sections.UniswapHelper, "UniswapHelper")
  await uniswapHelper.configure(limbo.address, behodler.address, flan.address, 20, limboOracle.address)
  return {}
}

const getOrCreateUniPairFactory = (uniswapFactory: Types.UniswapV2Factory, logger: (message: string) => void, broadcast: (name: string, transaction: Promise<ContractTransaction>) => Promise<ContractTransaction>) => {
  return async (token0: Types.ERC20, token1: Types.ERC20): Promise<Types.UniswapV2Pair> => {
    let pairAddress = await uniswapFactory.getPair(token0.address, token1.address)
    logger(`pair for  <${token0.address}, ${token1.address}>...`)
    if (pairAddress == ethers.constants.AddressZero) {
      logger(`not found. Creating...`)
      await broadcast("Creating Uniswap pair", uniswapFactory.createPair(token0.address, token1.address))
    }
    else logger('found')
    pairAddress = await uniswapFactory.getPair(token0.address, token1.address)
    logger('pair address: ' + pairAddress)
    const UniswapV2PairFactory = await ethers.getContractFactory("UniswapV2Pair")
    return UniswapV2PairFactory.attach(pairAddress) as Types.UniswapV2Pair
  }
}

interface proposalListItem {
  name: contractNames,
  contract: Contract
}

const mapLimboDAO: IDeploymentFunction = async function (params: IDeploymentParams): Promise<OutputAddress> {
  const getContract = await getContractFromSection(params.existing)
  const angband = await getContract<Types.Angband>(Sections.Angband, "Angband")
  const limboDAO = await getContract<Types.LimboDAO>(Sections.LimboDAO, "LimboDAO")

  await limboDAO.makeLive()
  await limboDAO.transferOwnership(angband.address)
  const domain = stringToBytes32("LIMBODAO")
  await angband.mapDomain(limboDAO.address, domain)
  return {}
}


const disabledDeploymentSnufferCap: IDeploymentFunction = async function (params: IDeploymentParams): Promise<OutputAddress> {
  const getContract = await getContractFromSection(params.existing)
  const deployerSnufferCap = await getContract<Types.DeployerSnufferCap>(Sections.DeployerSnufferCap, "DeployerSnufferCap")
  await params.broadcast("ending deployer snuffer cap", deployerSnufferCap.disable())
  return {}
}

//create minion for limbo, pour power into minion and bond limbo to minion
const morgothMapLimboMinionAndPower: IDeploymentFunction = async function (params: IDeploymentParams): Promise<OutputAddress> {
  const getContract = await getContractFromSection(params.existing)
  const powersRegistry = await getContract<Types.PowersRegistry>(Sections.Powers, "PowersRegistry")

  const limbo = await getLimbo(params.existing)

  const minion = stringToBytes32("Smaug")
  const addTokenPower = stringToBytes32("ADD_TOKEN_TO_BEHODLER")

  await params.broadcast("pour add token to limbo power invoker", powersRegistry.pour(addTokenPower, minion))
  await params.broadcast("bond limbo power invoker to Smaug", powersRegistry.bondUserToMinion(limbo.address, minion))

  const limboAddTokenToBehodlerPower = await getContract<Types.LimboAddTokenToBehodler>(Sections.Morgoth_LimboAddTokenToBehodler, "LimboAddTokenToBehodler")
  const configureScarcityPower = stringToBytes32("CONFIGURE_SCARCITY")
  const powerMinion = stringToBytes32("Celebrimbor") //not technically a minion but mislead by Sauron
  await params.broadcast("bond limbo powerInvoker to Celebrimbor", powersRegistry.bondUserToMinion(limboAddTokenToBehodlerPower.address, powerMinion))
  await params.broadcast("pour configure scarcity to limbo add token power invoker", powersRegistry.pour(configureScarcityPower, powerMinion))
  return {}
}

const endConfigForAllGovernables: IDeploymentFunction = async function (params: IDeploymentParams): Promise<OutputAddress> {
  const getContract = await getContractFromSection(params.existing)
  const daoAddress = (await getContract<Types.LimboDAO>(Sections.LimboDAO, "LimboDAO")).address
  const governables = ["Limbo",
    "TokenProxyRegistry",
    "UniswapHelper",
    "FlashGovernanceArbiter",
    "ProposalFactory",
    "LimboOracle",
    "Flan"]
  for (let i = 0; i < governables.length; i++) {
    const gov = governables[i]

    const contract = i == 0 ? await getLimbo(params.existing) :
      await getContract<Types.Governable>(Sections[gov], gov as contractNames)
    await contract.endConfiguration(daoAddress)
  }
  return {}
}

//currently only Limbo
const setAllGovernable: IDeploymentFunction = async function (params: IDeploymentParams): Promise<OutputAddress> {
  const getContract = await getContractFromSection(params.existing)
  const limbo = await getLimbo(params.existing)
  const flashGovArb = await getContract<Types.FlashGovernanceArbiter>(Sections.FlashGovernanceArbiter, "FlashGovernanceArbiter")

  await flashGovArb.setGoverned([limbo.address], [true])
  return {}
}

const deployAllLimboDAOProposals: IDeploymentFunction = async function (params: IDeploymentParams): Promise<OutputAddress> {
  let deploy = deploymentFactory(Sections.LimboDAOProposals, params.existing)
  const getContract = await getContractFromSection(params.existing)

  const proposalFactory = await getContract<Types.ProposalFactory>(Sections.ProposalFactory, "ProposalFactory")
  const dao = await getContract<Types.LimboDAO>(Sections.LimboDAO, "LimboDAO")

  const names: contractNames[] = ['AdjustFlanFeeOnTransferProposal',
    'ApproveFlanMintingProposal',
    'BurnFlashStakeDeposit',
    'ConfigureFlashGovernanceProposal',
    'SetAssetApprovalProposal',
    'SetFateSpendersProposal',
    'ToggleFlashGovernanceProposal',
    'UpdateProposalConfigProposal'];

  let list = [] as { name: contractNames, contract: Contract }[]
  for (let i = 0; i < names.length; i++) {
    const name = names[i]
    const factory = await ethers.getContractFactory(name)
    const contract = await deploy(name, factory, dao.address, name)
    await proposalFactory.toggleWhitelistProposal(contract.address)
    list.push({ name, contract })
  }


  let addresses: OutputAddress = {}
  list.forEach(item => {
    addresses = OutputAddressAdder(addresses, item.name, item.contract)
  })
  return addresses
}

const configureTPR: IDeploymentFunction = async function (params: IDeploymentParams): Promise<OutputAddress> {
  const getContract = await getContractFromSection(params.existing)

  const tokenProxyRegistry = await getContract<Types.TokenProxyRegistry>(Sections.TokenProxyRegistry, "TokenProxyRegistry")
  const morgothTokenApprover = await getMorgothTokenApprover(params.existing)
  const limboAddTokenToBehodlerPower = await getContract<Types.LimboAddTokenToBehodler>(Sections.Morgoth_LimboAddTokenToBehodler, "LimboAddTokenToBehodler")

  await tokenProxyRegistry.setPower(limboAddTokenToBehodlerPower.address)
  await tokenProxyRegistry.setTokenApprover(morgothTokenApprover.address)
  return {}
}

const deployConfigureTokenApproverPower: IDeploymentFunction = async function (params: IDeploymentParams): Promise<OutputAddress> {
  let deploy = deploymentFactory(Sections.ConfigureTokenApproverPower, params.existing)
  const getContract = await getContractFromSection(params.existing)

  const angband = await getContract<Types.Angband>(Sections.Angband, "Angband")
  const powersRegistry = await getContract<Types.PowersRegistry>(Sections.Powers, "PowersRegistry")

  const powerFactory = await ethers.getContractFactory("ConfigureTokenApproverPower")
  const power = await deploy<Types.ConfigureTokenApproverPower>("ConfigureTokenApproverPower", powerFactory, angband.address, powersRegistry.address)
  await angband.authorizeInvoker(power.address, true)
  return OutputAddressAdder<Types.ConfigureTokenApproverPower>({}, "ConfigureTokenApproverPower", power)
}

const morgothMapApprover: IDeploymentFunction = async function (params: IDeploymentParams): Promise<OutputAddress> {
  const getContract = await getContractFromSection(params.existing)
  const morgothTokenApprover = await getMorgothTokenApprover(params.existing)

  const angband = await getContract<Types.Angband>(Sections.Angband, "Angband")
  const powersRegistry = await getContract<Types.PowersRegistry>(Sections.Powers, "PowersRegistry")
  const domain = stringToBytes32("MorgothTokenApprover")
  const power = stringToBytes32("CONFIG_TOKEN_APPROVER")
  const melkor = stringToBytes32("Melkor")

  await powersRegistry.create(power, domain, true, false)
  await powersRegistry.pour(power, melkor)

  await morgothTokenApprover.transferOwnership(angband.address)
  await angband.mapDomain(morgothTokenApprover.address, domain)
  return {}
}

const morgothTokenAppoverUpdateConfig: IDeploymentFunction = async function (params: IDeploymentParams): Promise<OutputAddress> {
  const getContract = await getContractFromSection(params.existing)
  const morgothTokenApprover = await getMorgothTokenApprover(params.existing)

  const tokenProxyRegistry = await getContract<Types.TokenProxyRegistry>(Sections.TokenProxyRegistry, "TokenProxyRegistry")
  const referenceToken = await getContract<Types.ERC20>(Sections.BehodlerTokens, "DAI", "ERC677")
  const behodler = await getBehodler(params.existing)
  const limbo = await getLimbo(params.existing)
  const flan = await getContract<Types.Flan>(Sections.Flan, "Flan")

  await params.broadcast("Morgoth token update", morgothTokenApprover.updateConfig(tokenProxyRegistry.address, referenceToken.address, behodler.address, limbo.address, flan.address))
  return {}
}

const limboConfigureCrossingConfig: IDeploymentFunction = async function (params: IDeploymentParams): Promise<OutputAddress> {
  const getContract = await getContractFromSection(params.existing)
  const behodler = await getBehodler(params.existing)
  const angband = await getContract(Sections.Angband, "Angband")
  const ammHelper = await getContract(Sections.UniswapHelper, "UniswapHelper")
  const morgothPower = await getContract(Sections.Morgoth_LimboAddTokenToBehodler, "LimboAddTokenToBehodler")
  const HOUR = 3600

  const limbo = await getLimbo(params.existing)

  await limbo.configureCrossingConfig(behodler.address, angband.address,
    ammHelper.address, morgothPower.address, 200, HOUR)

  return {}
}

const limboDAOSeed: IDeploymentFunction = async function (params: IDeploymentParams): Promise<OutputAddress> {
  const getContract = await getContractFromSection(params.existing)

  const limboDAO = await getContract<Types.LimboDAO>(Sections.LimboDAO, "LimboDAO")

  const limbo = await getLimbo(params.existing)
  const flan = await getContract(Sections.Flan, "Flan")
  const fetchToken = async (contract: contractNames, section: Sections) =>
    await getContract(section, contract, "ERC677")

  const eye = await fetchToken("EYE", Sections.BehodlerTokens)
  const proposalFactory = await getContract(Sections.ProposalFactory, "ProposalFactory")

  //Use uni oracle for both uni and sushi. Can update later.
  const oracle = await getContract(Sections.LimboOracle, "LimboOracle")
  params.logger('about to retrieve limbodao owner for limboDAO with address ' + limboDAO.address)
  const ownerOfDao = await limboDAO.owner()
  params.logger(`about to call limboDAO seed: owner ${ownerOfDao}, deployer ${params.deployer.address}`)
  await limboDAO.seed(
    limbo.address,
    flan.address,
    eye.address,
    proposalFactory.address,
    oracle.address,
    oracle.address,
    [], //to be safe, start with only EYE stakeable
    []
  ).catch(err => {
    params.logger('seed error ' + err)
  })

  const flashGov = await getContract(Sections.FlashGovernanceArbiter, "FlashGovernanceArbiter") as Types.FlashGovernanceArbiter
  await params.broadcast("set flash gov on limboDAO", limboDAO.setFlashGoverner(flashGov.address))
  const limboDAOFlashGov = await limboDAO.getFlashGoverner()
  params.logger(`actual flashGov ${flashGov.address}. LimboDAO's flashGov ${limboDAOFlashGov}`)
  params.logger('limboDAO seed called')
  return {}
}

const deployLimboTokens: IDeploymentFunction = async function (params: IDeploymentParams): Promise<OutputAddress> {
  let deploy = deploymentFactory(Sections.LimboTokens, params.existing)

  const deployMockToken = async (name: contractNames, symbol: string) => {
    const MockTokenFactory = await ethers.getContractFactory("MockToken")
    return deploy<Types.MockToken>(name, MockTokenFactory, name, symbol, [], [])
  }

  const aave = await deployMockToken("Aave", "AVE")
  const curve = await deployMockToken("Curve", "CRV")
  const convex = await deployMockToken("Convex", "CVX")
  const mim = await deployMockToken("MIM", "MIM")
  const uni = await deployMockToken("Uni", "UNI")
  const sushi = await deployMockToken("Sushi", "SUSHI")

  //deploy an 8 decimal place token
  const MockWBTC = await ethers.getContractFactory("MockWBTC")
  const wbtc = await deploy<Types.MockWBTC>("WBTC", MockWBTC)

  let addresses = await OutputAddressAdder<Types.MockToken>({}, "Aave", aave)
  addresses = await OutputAddressAdder<Types.MockToken>(addresses, "Curve", curve)
  addresses = await OutputAddressAdder<Types.MockToken>(addresses, "Convex", convex)
  addresses = await OutputAddressAdder<Types.MockToken>(addresses, "MIM", mim)
  addresses = await OutputAddressAdder<Types.MockToken>(addresses, "Uni", uni)
  addresses = await OutputAddressAdder<Types.MockToken>(addresses, "Sushi", sushi)
  addresses = await OutputAddressAdder<Types.MockWBTC>(addresses, "WBTC", wbtc)
  return addresses;
}

const deployLimboOracle: IDeploymentFunction = async function (params: IDeploymentParams): Promise<OutputAddress> {
  let deploy = deploymentFactory(Sections.LimboOracle, params.existing)
  const getContract = await getContractFromSection(params.existing)

  const uniswapFactory = await getContract<Types.UniswapV2Factory>(Sections.UniswapV2Clones, "UniswapV2Factory")
  const dao = await getContract<Types.LimboDAO>(Sections.LimboDAO, "LimboDAO")

  const limboOracleFactory = await ethers.getContractFactory("LimboOracle")
  const limboOracle = await deploy<Types.LimboOracle>("LimboOracle", limboOracleFactory, uniswapFactory.address, dao.address)

  return OutputAddressAdder<Types.LimboOracle>({}, "LimboOracle", limboOracle)
}

const tradeOraclePairs: IDeploymentFunction = async function (params: IDeploymentParams): Promise<OutputAddress> {
  const getContract = await getContractFromSection(params.existing)

  const fetchOraclePair = async (contract: criticalPairNames) =>
    await getContract<Types.UniswapV2Pair>(Sections.FlanGenesis, contract, "UniswapV2Pair")


  const fetchToken = async (contract: tokenNames, section: Sections) =>
    await getContract<Types.ERC677>(section, contract, "ERC677")


  const fln_scx = await fetchOraclePair("FLN_SCX UniV2")
  const dai_scx = await fetchOraclePair("DAI_SCX UniV2")
  const scx__fln_scx = await fetchOraclePair("SCX__FLN_SCX UniV2")

  const flan = await fetchToken("Flan", Sections.Flan)
  const dai = await fetchToken("DAI", Sections.BehodlerTokens)
  const scx = await getBehodler(params.existing)

  //assert that the pairs have liquidity
  let supplies = (await Promise.all(
    [fln_scx, dai_scx, scx__fln_scx]
      .map(async pair => {
        return {
          name: await pair.name(),
          supply: await pair.totalSupply()
        }
      }
      )))

  if (
    supplies.filter(s => s.supply.eq(0)).length > 0
  ) {
    throw "TradeOraclePairs: not all pairs have liquidity"
  }


  //assert deployer has balances of scx and flan
  const balances = (await Promise.all(
    [flan, scx]
      .map(async token => {
        return [token as Contract, (await token.balanceOf(params.deployer.address))]
      })))

  if (
    balances.filter(s => s[1].isZero()).length > 0
  ) {
    throw "TradeOraclePairs: zero balances for either flan or scx"
  }


  //trade flan and scx into all 3
  const scxBalance = balances.filter(b => (b[0] as Contract).address === scx.address)[0][1] as BigNumber
  const flanBalance = balances.filter(b => (b[0] as Contract).address === flan.address)[0][1] as BigNumber

  const uniswapV2Router = await getContract<Types.UniswapV2Router02>(Sections.UniswapV2Clones, "UniswapV2Router", "UniswapV2Router02")


  await params.broadcast("approve flan on router", flan.approve(uniswapV2Router.address, ethers.constants.MaxUint256))
  await params.broadcast("approve scx on routee", scx.approve(uniswapV2Router.address, ethers.constants.MaxUint256))


  await params.broadcast("sending flan to fln_scx pair", flan.transfer(fln_scx.address, flanBalance.div(10)))
  await params.broadcast("sending scx to scx__fln_scx pair", scx.transfer(scx__fln_scx.address, scxBalance.div(10)))
  await params.broadcast("sending scx to dai_scx pair", scx.transfer(dai_scx.address, scxBalance.div(10)))

  const blockNumber = await ethers.provider.getBlockNumber()
  const timestamp = (await ethers.provider.getBlock(blockNumber - 1)).timestamp
  const deadline = ethers.constants.MaxUint256

  const tradeOnUni = async (inputToken: Contract, outputToken: Contract, inputAmount: BigNumberish): Promise<BigNumber> => {
    const balanceOfOutputtBefore = await (outputToken as Types.ERC20).balanceOf(params.deployer.address)
    await params.broadcast("swaping through Uniswap router", uniswapV2Router.swapExactTokensForTokens(inputAmount, 1000, [inputToken.address, outputToken.address], params.deployer.address, deadline))
    const balanceOfOutputAfter = await (outputToken as Types.ERC20).balanceOf(params.deployer.address)
    return balanceOfOutputAfter.sub(balanceOfOutputtBefore)
  }

  const scxBought = await tradeOnUni(flan, scx, flanBalance.div(100))
  const daiBought = await tradeOnUni(scx, dai, scxBalance.div(100))
  const fln_scxBought = await tradeOnUni(scx, fln_scx, scxBalance.div(100))

  params.logger('scx bought ' + scxBought.toString())
  params.logger('dai bought ' + daiBought.toString())
  params.logger('fln_scx bought ' + fln_scxBought.toString())

  if ([scxBought, daiBought, fln_scxBought].filter(b => b.isZero()).length > 0)
    throw "Trade failed"

  return {}
}

const registerOraclePairs: IDeploymentFunction = async function (params: IDeploymentParams): Promise<OutputAddress> {
  const getContract = await getContractFromSection(params.existing)
  const samplePeriod = 12//hours

  const limboOracle = await getContract<Types.LimboOracle>(Sections.LimboOracle, "LimboOracle")

  const getPair = async (name: criticalPairNames): Promise<Types.UniswapV2Pair> =>
    getContract<Types.UniswapV2Pair>(Sections.FlanGenesis, name, "UniswapV2Pair")

  const fln_scx = await getPair("FLN_SCX UniV2")
  const dai_scx = await getPair("DAI_SCX UniV2")
  const scx__fln_scx = await getPair("SCX__FLN_SCX UniV2")

  await params.broadcast(`register pair ${fln_scx.address}`, limboOracle.RegisterPair(fln_scx.address, samplePeriod))
  await params.broadcast(`register pair ${dai_scx.address}`, limboOracle.RegisterPair(dai_scx.address, samplePeriod))
  await params.broadcast(`register pair ${scx__fln_scx.address}`, limboOracle.RegisterPair(scx__fln_scx.address, samplePeriod))
  return {}
}

const deployLimbo: IDeploymentFunction = async function (params: IDeploymentParams): Promise<OutputAddress> {

  let deploy = deploymentFactory(Sections.Limbo, params.existing)
  const getContract = await getContractFromSection(params.existing)

  const dao = await getContract<Types.LimboDAO>(Sections.LimboDAO, "LimboDAO")
  const flan = await getContract<Types.Flan>(Sections.Flan, "Flan")

  const CrossingLibFactory = await ethers.getContractFactory("CrossingLib")
  const MigrationLibFactory = await ethers.getContractFactory("MigrationLib")
  const SoulLibFactory = await ethers.getContractFactory("SoulLib")

  const crossingLib = await CrossingLibFactory.deploy()
  const migrationLib = await MigrationLibFactory.deploy()
  const soulLib = await SoulLibFactory.deploy()
  const LimboFactory = await ethers.getContractFactory("Limbo", {
    libraries: {
      CrossingLib: crossingLib.address,
      MigrationLib: migrationLib.address,
      SoulLib: soulLib.address
    }
  })
  const limbo = await deploy<Types.Limbo>("Limbo", LimboFactory,
    flan.address, dao.address)

  await params.broadcast("whitelist flan minting for Limbo", flan.whiteListMinting(limbo.address, true))

  let addresses = OutputAddressAdder<Types.Limbo>({}, "Limbo", limbo)
  addresses = OutputAddressAdder(addresses, "CrossingLib", crossingLib)
  addresses = OutputAddressAdder(addresses, "MigrationLib", migrationLib)
  addresses = OutputAddressAdder(addresses, "SoulLib", soulLib)
  return addresses
}

const getLimbo = async (existing: AddressFileStructure) => {
  const getContract = await getContractFromSection(existing)
  const crossingLib = await getContract(Sections.Limbo, "CrossingLib")
  const migrationLib = await getContract(Sections.Limbo, "MigrationLib")
  const soulLib = await getContract(Sections.Limbo, "SoulLib")

  const limboLib: ethersLib = {
    CrossingLib: crossingLib.address,
    MigrationLib: migrationLib.address,
    SoulLib: soulLib.address
  }

  return getContract<Types.Limbo>(Sections.Limbo, "Limbo", "Limbo", limboLib)
}


const deployUniswapHelper: IDeploymentFunction = async function (params: IDeploymentParams): Promise<OutputAddress> {
  let deploy = deploymentFactory(Sections.UniswapHelper, params.existing)
  const getContract = await getContractFromSection(params.existing)

  const dao = await getContract<Types.LimboDAO>(Sections.LimboDAO, "LimboDAO")
  const limbo = await getLimbo(params.existing)

  const uniswapHelperFactory = await ethers.getContractFactory("UniswapHelper")
  const uniswapHelper = await deploy<Types.UniswapHelper>("UniswapHelper", uniswapHelperFactory, limbo.address, dao.address)

  const fetchTokenAddress = fetchTokenAddressFactory(params.existing)
  const dai = await fetchTokenAddress("DAI")
  await uniswapHelper.setDAI(dai)

  const flan = await getContract(Sections.Flan, "Flan")
  await params.broadcast("whitelist flan minting for uniswapHelper", flan.whiteListMinting(uniswapHelper.address, true))

  return OutputAddressAdder<Types.UniswapHelper>({}, "UniswapHelper", uniswapHelper)
}

const deployLimboAddTokenToBehodlerPower: IDeploymentFunction = async function (params: IDeploymentParams): Promise<OutputAddress> {
  let deploy = deploymentFactory(Sections.Morgoth_LimboAddTokenToBehodler, params.existing)
  const getContract = await getContractFromSection(params.existing)

  const angband = await getContract<Types.Angband>(Sections.Angband, "Angband")
  const limbo = await getLimbo(params.existing)
  const configScarcityPower = await getContract<Types.ConfigureScarcityPower>(Sections.ConfigureScarcityPower, "ConfigureScarcityPower")

  const powerFactory = await ethers.getContractFactory("LimboAddTokenToBehodler")
  const power = await deploy<Types.LimboAddTokenToBehodler>("LimboAddTokenToBehodler", powerFactory, angband.address, limbo.address, configScarcityPower.address)
  await angband.authorizeInvoker(power.address, true)

  const tokenProxyRegistry = await getContract<Types.TokenProxyRegistry>(Sections.TokenProxyRegistry, "TokenProxyRegistry")
  await tokenProxyRegistry.setPower(power.address)

  return OutputAddressAdder<Types.LimboAddTokenToBehodler>({}, "LimboAddTokenToBehodler", power)
}

// const deployPyroFlanBooster: IDeploymentFunction = async function (params: IDeploymentParams): Promise<OutputAddress> {
//   let deploy = deploymentFactory(Sections.PyroFlanBooster, params.existing)
//   const getContract = await getContractFromSection(params.existing)

//   const dao = await getContract<Types.LimboDAO>(Sections.LimboDAO, "LimboDAO")

//   const flan = await getContract<Types.Flan>(Sections.Flan, "Flan")
//   const liquidityReceiver = await getContract<Types.LiquidityReceiver>(Sections.LiquidityReceiverNew, "LiquidityReceiver")

//   const pyroFlan = await liquidityReceiver.getPyroToken(flan.address)

//   const pyroFlanBoosterFactory = await ethers.getContractFactory("PyroFlanBooster")
//   const pyroFlanBooster = await deploy<Types.PyroFlanBooster>("PyroFlanBooster", pyroFlanBoosterFactory, dao.address)
//   await pyroFlanBooster.configure(
//     ethers.constants.WeiPerEther,
//     flan.address,
//     pyroFlan,
//     liquidityReceiver.address
//   )

//   return OutputAddressAdder<Types.PyroFlanBooster>({}, "PyroFlanBooster", pyroFlanBooster)
// }

const flanSetConfig: IDeploymentFunction = async function (params: IDeploymentParams): Promise<OutputAddress> {
  const getContract = await getContractFromSection(params.existing)
  const flan = await getContract<Types.Flan>(Sections.Flan, "Flan")

  await flan.setMintConfig(ethers.constants.WeiPerEther.mul(500000), 86400)
  return {}
}

const addTokenToBehodlerFactory = async (params: IDeploymentParams) => {
  let deploy = deploymentFactory(Sections.Flan, params.existing)
  const getContract = await getContractFromSection(params.existing)

  const angband = await getContract<Types.Angband>(Sections.Angband, "Angband")
  const powersRegistry = await getContract<Types.PowersRegistry>(Sections.Powers, "PowersRegistry")

  const addTokenAndValuePowerFactory = await ethers.getContractFactory("AddTokenAndValueToBehodlerPower")

  const registerPyroTokenPowerFactory = await ethers.getContractFactory("RegisterPyroTokenV3Power")

  const registerPyroTokenPower = stringToBytes32("REGISTER_PYRO_V3")

  await params.broadcast("create power Register PyroToken", powersRegistry.create(registerPyroTokenPower, stringToBytes32("LIQUIDITY_RECEIVER"), true, false))

  const addTokenToBehodlerPower = stringToBytes32("ADD_TOKEN_TO_BEHODLER")
  const powerMinion = stringToBytes32("Witchking")
  await params.broadcast("create power add token to behodler", powersRegistry.create(addTokenToBehodlerPower, stringToBytes32("LACHESIS"), true, false))

  await params.broadcast("pour 'add token to behodler' power to Melkor", powersRegistry.pour(addTokenToBehodlerPower, stringToBytes32("Melkor")))
  await params.broadcast("pour 'register pyro' power into minion", powersRegistry.pour(registerPyroTokenPower, powerMinion))
  //create permissions etc
  return async function (
    tokenToRegister: Types.ERC20,
    amountToTransfer: BigNumber,
    cliffFace: boolean
  ): Promise<BigNumber> {
    const registerPyroTokenPowerInvoker = await deploy<Types.RegisterPyroTokenV3Power>("RegisterPyroTokenV3Power", registerPyroTokenPowerFactory,
      tokenToRegister.address,
      false,
      angband.address,
      powersRegistry.address
    )

    const addTokenAndValuePowerInvoker = await deploy<Types.AddTokenAndValueToBehodlerPower>("AddTokenAndValueToBehodlerPower"
      , addTokenAndValuePowerFactory,
      tokenToRegister.address,
      false,
      angband.address,
      params.deployer.address, //scx generated is given to deployer.
      registerPyroTokenPowerInvoker.address
    )

    if (cliffFace) {
      const CliffFaceFactory = await ethers.getContractFactory("CliffFace")
      const cliffFace = await CliffFaceFactory.attach(tokenToRegister.address) as Types.CliffFace
      const proxyHandler = await getContract<Types.ProxyHandler>(Sections.ProxyHandler, "ProxyHandler")
      await cliffFace.setApprovedTransferers([proxyHandler.address, addTokenAndValuePowerInvoker.address])
    }

    params.logger(`tokenToRegister address ${tokenToRegister.address}, balance ${(await tokenToRegister.balanceOf(params.deployer.address)).toString()}`)
    await params.broadcast("transferring token to Behodler power", tokenToRegister.transfer(addTokenAndValuePowerInvoker.address, amountToTransfer))

    await params.broadcast("bond power invoker to minion", powersRegistry.bondUserToMinion(addTokenAndValuePowerInvoker.address, powerMinion))

    await params.broadcast("Angband authorise invoker addTokenPower", angband.authorizeInvoker(addTokenAndValuePowerInvoker.address, true))
    await params.broadcast("Angband authorise invoker RegisterPyro", angband.authorizeInvoker(registerPyroTokenPowerInvoker.address, true))

    const behodler = await getBehodler(params.existing)

    const scxBalanceOfDeployerBefore = await behodler.balanceOf(params.deployer.address)
    await params.broadcast("angband execute addReference Pair power", angband.executePower(addTokenAndValuePowerInvoker.address))
    const increaseInSCX = (await behodler.balanceOf(params.deployer.address)).sub(scxBalanceOfDeployerBefore)

    params.logger('increase in scx balance from addition ' + increaseInSCX.toString())
    //repetitive stuff

    return increaseInSCX
  }
}

//NOTE: keep in mind that Flan interacts with Behodler via CliffFace.
const flanGenesis: IDeploymentFunction = async function (params: IDeploymentParams): Promise<OutputAddress> {

  const getContract = await getContractFromSection(params.existing)

  const uniswapV2Factory = await getContract<Types.UniswapV2Factory>(Sections.UniswapV2Clones, "UniswapV2Factory")

  const flan = await getContract<Types.Flan>(Sections.Flan, "Flan")
  const fetchBehodlerToken = fetchTokenFactory(params.existing, Sections.BehodlerTokens)
  const dai = await fetchBehodlerToken("DAI") as Types.ERC20
  const behodler = await getBehodler(params.existing)
  // 1. Mint Flan equal to Dai balance on Behodler. --DONE
  // 2. TokenProxy.createCliffFace (protectLimbo:false) for Flan
  //     * reference Dai, reference multiple 0.7 --DONE
  // 3. Lachesis.measure(flanCliff, true,false) --DONE
  // 4. Deposit minted Flan into Behodler via cliffFace. --DONE
  // 5. Collect SCX generated. --DONE

  // 6. Mint Flan equal in value (assuming $1) to SCX minted.
  const daiBalanceOnBehodler = await dai.balanceOf(behodler.address)
  await params.broadcast("minting flan to deployer", flan.mint(params.deployer.address, daiBalanceOnBehodler.mul(5)))


  // 7. Pair with SCX in UniV2 -> generates SCX/FLN LP token: LP_1
  const uniswapFactory = await getContract<Types.UniswapV2Factory>(Sections.UniswapV2Clones, "UniswapV2Factory")
  params.logger('about to create reference pair')
  const uniGetOrCreate = await getOrCreateUniPairFactory(uniswapFactory, params.logger, params.broadcast)
  const referencePair = await uniGetOrCreate(flan, behodler as Types.ERC20)
  params.logger('reference pair ' + referencePair.address)
  let addresses = OutputAddressAdder<Types.UniswapV2Pair>({}, "FLN_SCX UniV2", referencePair)

  const estimatedSCXPrice = ethers.constants.WeiPerEther.mul(500)

  const tokenProxyRegistry = await getContract<Types.TokenProxyRegistry>(Sections.TokenProxyRegistry, "TokenProxyRegistry")
  const CliffFaceFactory = await ethers.getContractFactory("CliffFace")
  const flanCliffFaceAddress = (await tokenProxyRegistry.tokenProxy(flan.address)).behodlerProxy

  params.logger('cliffFace address of Flan: ' + flanCliffFaceAddress)
  const flanCliffFace = await CliffFaceFactory.attach(flanCliffFaceAddress) as Types.CliffFace

  const flanBalanceOnBehodler = await flanCliffFace.balanceOf(behodler.address)
  params.logger('flan balance in behodler: ' + flanBalanceOnBehodler)
  const scxPrice = await behodler.withdrawLiquidityFindSCX(flanCliffFace.address, estimatedSCXPrice, ethers.constants.WeiPerEther, 15)
  params.logger('scx price in flan on Behodler is ' + scxPrice)

  const router = await getContract<Types.UniswapV2Router02>(Sections.UniswapV2Clones, "UniswapV2Router", "UniswapV2Router02")

  const scxToTransferToRP = flanBalanceOnBehodler.mul(ethers.constants.WeiPerEther).div(scxPrice)
  await params.broadcast("SCX approve of router", behodler.approve(router.address, ethers.constants.MaxUint256))
  await params.broadcast("Flan approve of router", flan.approve(router.address, ethers.constants.MaxUint256))
  await params.broadcast("router mint RP", router.addLiquidity(behodler.address, flan.address, scxToTransferToRP, daiBalanceOnBehodler, 0, 0, params.deployer.address, ethers.constants.MaxUint256))

  // 8. Lachesis.measure (SCX/FLN LP, true, false) -> mints SCX_2. Need a power to do this as might be lieve behodler
  //Remember to verify it is legit on Behodler.

  const totalSupplyOfReferencePair = await referencePair.totalSupply()
  const priceOfReferencePair = (flanBalanceOnBehodler.mul(2)).div(totalSupplyOfReferencePair)
  const quantityOfReferencePairToTransferToBehodler = flanBalanceOnBehodler.div(priceOfReferencePair)
  let balanceOfRP = await referencePair.balanceOf(params.deployer.address)
  params.logger('Initial balance of RP: ' + balanceOfRP.toString())
  if (quantityOfReferencePairToTransferToBehodler.gt(balanceOfRP))
    throw "not enough reference pair"


  const addTokenToBehodler = await addTokenToBehodlerFactory(params)
  const increaseInSCXFromRPAdd = await addTokenToBehodler(referencePair, quantityOfReferencePairToTransferToBehodler, false)

  // 9. Pair SCX_2 with equivalent LP_1 to create scx__fln_scx -> mints LP_2
  balanceOfRP = await referencePair.balanceOf(params.deployer.address)
  const scarcityPriceOfFln_SCX = scxToTransferToRP.mul(ethers.constants.WeiPerEther).div(totalSupplyOfReferencePair)
  params.logger('scarcityPriceOfFln_SCX ' + scarcityPriceOfFln_SCX.toString())
  const quantityOfSCXToTransferToOraclePair = scarcityPriceOfFln_SCX.mul(balanceOfRP).div(ethers.constants.WeiPerEther)
  const scx__fln_scx = await uniGetOrCreate(behodler, referencePair)
  addresses = OutputAddressAdder<Types.UniswapV2Pair>(addresses, "SCX__FLN_SCX UniV2", scx__fln_scx)
  params.logger('scx__fln_scx address: ' + scx__fln_scx.address)

  const balanceOfOraclePairBefore = await scx__fln_scx.balanceOf(params.deployer.address)
  await params.broadcast("approving router for RP", referencePair.approve(router.address, ethers.constants.MaxUint256))
  await params.broadcast("approving router for SCX", behodler.approve(router.address, ethers.constants.MaxUint256))

  params.logger(`balanceOfRP ${balanceOfRP.toString()}, quantityOfSCXToTransferToOraclePair ${quantityOfSCXToTransferToOraclePair.toString()}`)
  await params.broadcast("router minting of scx__fln_scx",
    router.addLiquidity(referencePair.address, behodler.address, balanceOfRP, quantityOfSCXToTransferToOraclePair,
      0, 0, params.deployer.address, ethers.constants.MaxUint256)
  )

  const increaseInOraclePair = (await scx__fln_scx.balanceOf(params.deployer.address)).sub(balanceOfOraclePairBefore)
  if (increaseInOraclePair.isZero()) {
    throw "Oracle pair minting failed"
  }
  params.logger("Oracle pair minted " + increaseInOraclePair.toString())

  // 10. Lachesis.measure LP_2 and mint SCX.
  const increaseInSCXFromAddingSCX__FLN_SCX = await addTokenToBehodler(scx__fln_scx, increaseInOraclePair, false)

  // 11. On Uni, create dai_scx and seed with as much Dai as possible.
  const daiBalance = await dai.balanceOf(params.deployer.address)
  const scxToPairWithDai = daiBalance.mul(ethers.constants.WeiPerEther).div(scxPrice)
  const scxBalance = (await behodler.balanceOf(params.deployer.address)).toString()
  params.logger(`dai address ${dai.address}, scx address ${behodler.address}`)
  params.logger(`pair balances of Dai and SCX dai_scx: dai ${daiBalance.toString()},  scx ${scxToPairWithDai.toString()}. Actual SCX ${scxBalance}`)

  await params.broadcast("approving dai on router", dai.approve(router.address, ethers.constants.MaxUint256))
  await params.broadcast("approving scx on router", behodler.approve(router.address, ethers.constants.MaxUint256))
  await params.broadcast("router mint of dai/scx", router.addLiquidity(dai.address, behodler.address, daiBalance, scxToPairWithDai, 0, 0, params.deployer.address, ethers.constants.MaxUint256))

  // 12. TokenProxyRegistry.createCliffFace (dai_scx)
  const dai_scx = await uniGetOrCreate(dai, behodler)
  params.logger('DAI_SCX address: ' + dai_scx.address)
  addresses = OutputAddressAdder<Types.UniswapV2Pair>(addresses, "DAI_SCX UniV2", dai_scx)
  const daiValueOfScx_Dai = daiBalance.mul(2)
  const daiPriceOfSCX_Dai = daiValueOfScx_Dai.div((await dai_scx.totalSupply()))
  const referenceMultiple = ethers.constants.WeiPerEther.mul(ethers.constants.WeiPerEther).div(daiPriceOfSCX_Dai)
  params.logger("referenceMultiple of scx_dai proxy" + referenceMultiple)

  const morgothTokenApprover = await getMorgothTokenApprover(params.existing)
  await params.broadcast("generate dai_scx cliff face", morgothTokenApprover.generateCliffFaceProxy(dai_scx.address, referenceMultiple, false))

  // 13. Lachesis.measure(dai_scx cliff, true, false) and deposit to mint SCX
  const dai_scxBalance = await dai_scx.balanceOf(params.deployer.address)
  params.logger("dai_scx balance of deployer " + dai_scxBalance)

  const dai_scx_cliffFace = (await tokenProxyRegistry.tokenProxy(dai_scx.address)).behodlerProxy
  params.logger('dai_scx_cliff face ' + dai_scx_cliffFace)

  const ERC20Factory = await ethers.getContractFactory("CliffFace")
  const daiSCXCliffToken = await ERC20Factory.attach(dai_scx_cliffFace) as Types.CliffFace

  await params.broadcast("Approve dai_scx cliff on behodler", daiSCXCliffToken.approveBehodlerFor(behodler.address))
  await params.broadcast("Approve dai_scx on its cliff", dai_scx.approve(daiSCXCliffToken.address, ethers.constants.MaxUint256))
  await params.broadcast("mint dai_scx cliffFace", daiSCXCliffToken.mint(params.deployer.address, params.deployer.address, dai_scxBalance))

  const dai_scxCliffBalance = await daiSCXCliffToken.balanceOf(params.deployer.address)
  params.logger("dai_scx cliff balance " + dai_scxCliffBalance.toString())
  const daiBalanceOnBehoder = await dai.balanceOf(behodler.address)
  const unitsOfDai_SCXToAdd = daiBalanceOnBehoder.div(daiPriceOfSCX_Dai)
  const increaseInSCXFromAddingDai_SCX = await addTokenToBehodler(daiSCXCliffToken, unitsOfDai_SCXToAdd, true)

  // 14. Create and seed Flan/EYE UniV2 LP
  const eye = await getContract<Types.ERC20>(Sections.BehodlerTokens, "EYE", "ERC20")
  await params.broadcast('Flan approve router', flan.approve(router.address, ethers.constants.MaxUint256))
  await params.broadcast('EYE approve router', eye.approve(router.address, ethers.constants.MaxUint256))
  const eyeInBehodler = await eye.balanceOf(behodler.address)

  const flanBalance = await flan.balanceOf(params.deployer.address)
  const eyeBalance = await eye.balanceOf(params.deployer.address)

  params.logger(`eye balance ${eyeBalance}, flan balance ${flanBalance}`)
  const eyePerFlan = eyeBalance.mul(1000).div(flanBalance)
    // .div(ethers.constants.WeiPerEther.div(1000))
    .toNumber() //step this down by million

  const flanToAdd = daiBalanceOnBehoder
  const eyeToAdd = flanToAdd.mul(eyePerFlan).div(1000)

  params.logger('EYE per Flan' + eyePerFlan.toString())
  params.logger(`flan ${flanToAdd.toString()} and eye ${eyeToAdd} to FLAN/EYE.`)

  await params.broadcast("creating FLAN/EYE LP", router.addLiquidity(flan.address, eye.address, flanToAdd, eyeToAdd, 0, 0, params.deployer.address, ethers.constants.MaxUint256))
  const flanEYE = await uniGetOrCreate(flan, eye)
  // 15. Lachesis.measure (Flan/EYE LP, true, false) and mint SCX
  const totalSupply = await flanEYE.totalSupply()
  const priceOfFlanEYE = flanBalance.div(totalSupply)
  const flanEYETOAddTOBehodler = flanBalanceOnBehodler.div(priceOfFlanEYE)
  params.logger('flan_eye to add to behodler ' + flanEYETOAddTOBehodler.toString())
  await addTokenToBehodler(flanEYE, flanEYETOAddTOBehodler,false)

  // 16. Create PyroFlan/SCX LP
  const liquidityReceiver = await getContract<Types.LiquidityReceiver>(Sections.LiquidityReceiverNew, "LiquidityReceiver")

  const pyroFlanAddress = await liquidityReceiver.getPyroToken(flanCliffFace.address)
  const proxyHandler = await getContract<Types.ProxyHandler>(Sections.ProxyHandler, "ProxyHandler")
  const pyroFlan = (await ethers.getContractFactory("PyroToken")).attach(pyroFlanAddress) as Types.PyroToken
  await params.broadcast("approve flanCliffFace for flan", flan.approve(flanCliffFace.address, ethers.constants.MaxUint256))
  await params.broadcast("approve pyroFlan for flanCliffFace", proxyHandler.approvePyroTokenForProxy(pyroFlan.address))
  const flanBalanceBeforePyroMint = await flan.balanceOf(params.deployer.address)
  params.logger(`flan balance ${flanBalanceBeforePyroMint} just before minting PyroFlan using ${daiBalanceOnBehoder}`)
  await params.broadcast("mint pyroFlan", proxyHandler.mintPyroFromBase(pyroFlanAddress, daiBalanceOnBehoder))
  const pyroFlanBalance = await pyroFlan.balanceOf(params.deployer.address)
  params.logger('pyroFlan minted ' + pyroFlanBalance)
  const pyroFlanRedeemRate = await proxyHandler.redeemRate(pyroFlanAddress)
  const flanEquivalent = pyroFlanBalance.mul(pyroFlanRedeemRate).div(ethers.constants.WeiPerEther)
  const scxToPairOnPyroFlanSCXLP = flanEquivalent.mul(ethers.constants.WeiPerEther).div(scxPrice)

  params.logger(`pairing ${pyroFlanBalance} PyroFlan with ${scxToPairOnPyroFlanSCXLP} SCX remaining balance ${(await behodler.balanceOf(params.deployer.address))}`)

  await params.broadcast("approving router for PyroFlan", pyroFlan.approve(router.address, ethers.constants.MaxUint256))
  await params.broadcast("minting pyroFlan/SCX LP", router.addLiquidity(pyroFlanAddress, behodler.address, pyroFlanBalance, scxToPairOnPyroFlanSCXLP, 0, 0, params.deployer.address, ethers.constants.MaxUint256))

  // 17. Lachesis.measure (PyroFlan/SCX LP, true, false), mint
  const pyroFlan_SCX = await uniGetOrCreate(pyroFlan, behodler)
  const behodlerToPersonalRatio = flanBalanceOnBehodler.mul(1000_000).div(daiBalanceOnBehoder)

  const balanceOfPair = await pyroFlan_SCX.balanceOf(params.deployer.address)
  const quantityToAdd = balanceOfPair.mul(behodlerToPersonalRatio).div(2000_000)

  params.logger('quantity of pyroFlan_SCX to behodler ' + quantityToAdd)
  await addTokenToBehodler(pyroFlan_SCX, quantityToAdd, false)
  // 18. Burn all remaining SCX
  const SCXLeftOverFromFlanGenesis = await behodler.balanceOf(params.deployer.address)
  const remainingFlan = await flan.balanceOf(params.deployer.address)
  params.logger(`About to burn most of ${SCXLeftOverFromFlanGenesis} SCX and ${remainingFlan} Flan`)
  //burn leftover generated token from flanGenesis
  await behodler.burn(SCXLeftOverFromFlanGenesis.sub(ethers.constants.WeiPerEther.mul(2)))
  await flan.burn(remainingFlan.sub(ethers.constants.WeiPerEther.mul(20)))
  return addresses
}

const deployFlan: IDeploymentFunction = async function (params: IDeploymentParams): Promise<OutputAddress> {
  let deploy = deploymentFactory(Sections.Flan, params.existing)
  const getContract = await getContractFromSection(params.existing)

  const dao = await getContract<Types.LimboDAO>(Sections.LimboDAO, "LimboDAO")

  const flanFactory = await ethers.getContractFactory("Flan")
  const flan = await deploy<Types.Flan>("Flan", flanFactory, dao.address)
  await flan.mint(params.deployer.address, ethers.constants.WeiPerEther.mul(10_000))

  return OutputAddressAdder<Types.Flan>({}, "Flan", flan)
}


const registerFlanOnBehodlerViaCliffFace: IDeploymentFunction = async function (params: IDeploymentParams): Promise<OutputAddress> {
  let deploy = deploymentFactory(Sections.Flan, params.existing)
  const getContract = await getContractFromSection(params.existing)

  const morgothTokenApprover = await getMorgothTokenApprover(params.existing)
  const flan = await getContract<Types.Flan>(Sections.Flan, "Flan")

  const seventy_percent = ethers.constants.WeiPerEther.mul(1428571429)
    .div(1000000000)

  await params.broadcast("Cliff face for Flan", morgothTokenApprover.generateCliffFaceProxy(flan.address, seventy_percent, false))

  const tokenProxyRegistry = await getContract<Types.TokenProxyRegistry>(Sections.TokenProxyRegistry, "TokenProxyRegistry")

  const proxyMappingForFlan = await tokenProxyRegistry.tokenProxy(flan.address)
  const behodlerToken = await proxyMappingForFlan.behodlerProxy;

  params.logger('clff face of Flan address ' + behodlerToken)

  const angband = await getContract<Types.Angband>(Sections.Angband, "Angband")
  const powersRegistry = await getContract<Types.PowersRegistry>(Sections.Powers, "PowersRegistry")

  const addTokenAndValuePowerFactory = await ethers.getContractFactory("AddTokenAndValueToBehodlerPower")
  params.logger('about to exeucte line 977. powers: ' + powersRegistry.address);
  const registerPyroTokenPower = stringToBytes32("REGISTER_PYRO_V3")
  await params.broadcast("create power Register PyroToken", powersRegistry.create(registerPyroTokenPower, stringToBytes32("LIQUIDITY_RECEIVER"), true, false))

  const registerPyroTokenPowerFactory = await ethers.getContractFactory("RegisterPyroTokenV3Power")

  const registerPyroPower = await deploy<Types.RegisterPyroTokenV3Power>("RegisterPyroTokenV3Power", registerPyroTokenPowerFactory,
    behodlerToken,
    false,
    angband.address,
    powersRegistry.address
  )

  params.logger('Behodler token ' + behodlerToken)

  const addTokenAndValuePower = await deploy<Types.AddTokenAndValueToBehodlerPower>("AddTokenAndValueToBehodlerPower"
    , addTokenAndValuePowerFactory,
    behodlerToken,
    false,
    angband.address,
    params.deployer.address, //scx generated is given to deployer.
    registerPyroPower.address
  )
  const proxyHandler = await getContract<Types.ProxyHandler>(Sections.ProxyHandler, "ProxyHandler")
  const CliffFaceFactory = await ethers.getContractFactory("CliffFace")
  const cliffFace = await CliffFaceFactory.attach(behodlerToken) as Types.CliffFace
  await cliffFace.setApprovedTransferers([proxyHandler.address, addTokenAndValuePower.address]);

  params.logger('addToken address' + addTokenAndValuePower.address)
  const dai = await getContract<Types.ERC20>(Sections.BehodlerTokens, "DAI", "ERC677")
  const behodler = await getBehodler(params.existing)
  const daiBalanceOnBehoder = await dai.balanceOf(behodler.address)
  await flan.mint(params.deployer.address, daiBalanceOnBehoder)


  const cliffFaceBalanceOnPowerBefore = await cliffFace.balanceOf(addTokenAndValuePower.address)
  await params.broadcast("approving flan transfer into cliff face", flan.approve(cliffFace.address, ethers.constants.MaxUint256))

  await params.broadcast(`mint ${daiBalanceOnBehoder} flan cliffFace into addtokenpower`, cliffFace.mint(addTokenAndValuePower.address, params.deployer.address, daiBalanceOnBehoder))

  await params.broadcast("approve flan on behodler for cliffface", cliffFace.approveBehodlerFor(flan.address))
  const cliffFaceBalanceOnPowerrAfter = await cliffFace.balanceOf(addTokenAndValuePower.address)

  await params.broadcast("addTokenPower.setPyroDetais", registerPyroPower.setPyroDetails("PyroFlan", "PyroFLN"))

  /*
  Create a power for registering a pyroToken
  Create an executing minion for the addTokenValue power and bond
  Pour power into above minion
  authorize both powers
  Execute top level minion
  */

  const addTokenToBehodlerPower = stringToBytes32("ADD_TOKEN_TO_BEHODLER")

  const powerMinion = stringToBytes32("Witchking")
  await params.broadcast("bond power invoker to minion", powersRegistry.bondUserToMinion(addTokenAndValuePower.address, powerMinion))

  await params.broadcast("create power add token to behodler", powersRegistry.create(addTokenToBehodlerPower, stringToBytes32("LACHESIS"), true, false))

  await params.broadcast("pour 'add token to behodler' power to Melkor", powersRegistry.pour(addTokenToBehodlerPower, stringToBytes32("Melkor")))
  await params.broadcast("pour 'register pyro' power into minion", powersRegistry.pour(registerPyroTokenPower, powerMinion))
  await params.broadcast("Angband authorise invoker addTokenPower", angband.authorizeInvoker(addTokenAndValuePower.address, true))
  await params.broadcast("Angband authorise invoker RegisterPyro", angband.authorizeInvoker(registerPyroPower.address, true))

  const scxBalanceOfDeployerBefore = await behodler.balanceOf(params.deployer.address)

  params.logger('addToken address' + addTokenAndValuePower.address)
  await params.broadcast("angband execute addToken power", angband.executePower(addTokenAndValuePower.address))
  const increaseInSCX = (await behodler.balanceOf(params.deployer.address)).sub(scxBalanceOfDeployerBefore)

  params.logger(`SCX generated from Flan listing: ${increaseInSCX.div(ethers.constants.WeiPerEther.div(10000)).toNumber() / 10000}`)
  const liquidityReceiver = await getContract<Types.LiquidityReceiver>(Sections.LiquidityReceiverNew, "LiquidityReceiver")

  const pyroTokenFactory = await ethers.getContractFactory("PyroToken")
  const pyroFlanAddress = await liquidityReceiver.getPyroToken(behodlerToken)

  const pyroFlan = await pyroTokenFactory.attach(pyroFlanAddress) as Types.PyroToken

  const deployerSnufferCap = await getContract<Types.DeployerSnufferCap>(Sections.DeployerSnufferCap, "DeployerSnufferCap")

  params.logger(`pyroFlan ${pyroFlan.address}, proxyHandler ${proxyHandler.address}`);
  await params.broadcast("snuffing fees for pyroFlan on ProxyHandler", deployerSnufferCap.snuff(pyroFlan.address, proxyHandler.address, FeeExemption.RECEIVER_EXEMPT))

  const baseToken = (await pyroFlan.config()).baseToken
  if (baseToken !== behodlerToken)
    throw "PyroFlan deploy failure"

  return {}
}

const deployFlashGovernanceArbiter: IDeploymentFunction = async function (params: IDeploymentParams): Promise<OutputAddress> {
  let deploy = deploymentFactory(Sections.BehodlerSeedNew, params.existing)
  const getContract = await getContractFromSection(params.existing)
  const fetchTokenAddress = fetchTokenAddressFactory(params.existing)
  const dao = await getContract<Types.LimboDAO>(Sections.LimboDAO, "LimboDAO")
  const eye = await fetchTokenAddress("EYE")

  const flashGovernanceArbFactory = await ethers.getContractFactory("FlashGovernanceArbiter")
  const flashGovArb = await deploy<Types.FlashGovernanceArbiter>("FlashGovernanceArbiter", flashGovernanceArbFactory, dao.address)
  await params.broadcast("flashGov configure security", flashGovArb.configureSecurityParameters(10, 86400, 5))
  await params.broadcast("flashGov configure gov", flashGovArb.configureFlashGovernance(eye, ethers.constants.One.mul(1000), "518400", true))
  await params.broadcast("dao setFlashGov", dao.setFlashGoverner(flashGovArb.address))

  return OutputAddressAdder<Types.FlashGovernanceArbiter>({}, "FlashGovernanceArbiter", flashGovArb)
}

const deployTokenProxyRegistry: IDeploymentFunction = async function (params: IDeploymentParams): Promise<OutputAddress> {
  let deploy = deploymentFactory(Sections.TokenProxyRegistry, params.existing)
  const getContract = await getContractFromSection(params.existing)

  const dao = await getContract<Types.LimboDAO>(Sections.LimboDAO, "LimboDAO")
  const behodler = await getBehodler(params.existing)
  const TokenProxyRegistryFactory = await ethers.getContractFactory("TokenProxyRegistry")
  const tokenProxyRegistry = await deploy<Types.TokenProxyRegistry>("TokenProxyRegistry", TokenProxyRegistryFactory, dao.address, behodler.address)
  let addresses = OutputAddressAdder<Types.TokenProxyRegistry>({}, "TokenProxyRegistry", tokenProxyRegistry)

  const morgothTokenApprover = await getMorgothTokenApprover(params.existing)
  await tokenProxyRegistry.setTokenApprover(morgothTokenApprover.address)
  return addresses
}

const deployProposalFactory: IDeploymentFunction = async function (params: IDeploymentParams): Promise<OutputAddress> {
  let deploy = deploymentFactory(Sections.ProposalFactory, params.existing)
  const getContract = await getContractFromSection(params.existing)

  const dao = await getContract<Types.LimboDAO>(Sections.LimboDAO, "LimboDAO")
  const whiteListProposal = await getContract<Types.ToggleWhitelistProposalProposal>(Sections.WhiteListProposal, "ToggleWhitelistProposalProposal")
  const updateProposal = await getContract<Types.UpdateMultipleSoulConfigProposal>(Sections.MultiSoulConfigUpdateProposal, "UpdateMultipleSoulConfigProposal")

  const proposalFactoryFactory = await ethers.getContractFactory("ProposalFactory")
  const proposalFactory = await deploy<Types.ProposalFactory>("ProposalFactory", proposalFactoryFactory,
    dao.address, whiteListProposal.address, updateProposal.address)
  return OutputAddressAdder<Types.ProposalFactory>({}, "ProposalFactory", proposalFactory)
}

const deployMultiSoulConfigUpdateProposal: IDeploymentFunction = async function (params: IDeploymentParams): Promise<OutputAddress> {
  let deploy = deploymentFactory(Sections.MultiSoulConfigUpdateProposal, params.existing)
  const getContract = await getContractFromSection(params.existing)

  const dao = await getContract<Types.LimboDAO>(Sections.LimboDAO, "LimboDAO")
  const limbo = await getLimbo(params.existing)
  const morgothTokenApprover = await getMorgothTokenApprover(params.existing)
  const tokenProxyRegistry = await getContract<Types.TokenProxyRegistry>(Sections.TokenProxyRegistry, "TokenProxyRegistry")

  const updateProposalFactory = await ethers.getContractFactory("UpdateMultipleSoulConfigProposal")

  const proposal = await deploy<Types.UpdateMultipleSoulConfigProposal>(
    "UpdateMultipleSoulConfigProposal"
    , updateProposalFactory,
    dao.address,
    "ListTokens",
    limbo.address,
    morgothTokenApprover.address,
    tokenProxyRegistry.address)

  return OutputAddressAdder<Types.UpdateMultipleSoulConfigProposal>({}, "UpdateMultipleSoulConfigProposal", proposal)
}

const deployMorgothTokenApprover: IDeploymentFunction = async function (params: IDeploymentParams): Promise<OutputAddress> {
  let deploy = deploymentFactory(Sections.MorgothTokenApprover, params.existing)
  const getContract = await getContractFromSection(params.existing)

  const addressToStringFactory = await ethers.getContractFactory("AddressToString")
  const proxyDeployerFactory = await ethers.getContractFactory("ProxyDeployer")
  const addressToString = await deploy<Types.AddressToString>("AddressToString", addressToStringFactory)

  const proxyDeployer = await deploy("ProxyDeployer", proxyDeployerFactory)

  let libraries: ethersLib = {
    AddressToString: addressToString.address,
    ProxyDeployer: proxyDeployer.address
  }

  const approverFactory = await ethers.getContractFactory("MorgothTokenApprover", { libraries })
  const MTA = await deploy<Types.MorgothTokenApprover>("MorgothTokenApprover", approverFactory)
  let addresses = OutputAddressAdder<Types.AddressToString>({}, "AddressToString", addressToString)
  addresses = OutputAddressAdder(addresses, "ProxyDeployer", proxyDeployer)

  const powers = await getContract<Types.PowersRegistry>(Sections.Powers, "PowersRegistry")
  await params.broadcast("creating approver power", powers.create(stringToBytes32("CONFIGURE_TOKEN_APPROVER"), stringToBytes32("MorgothTokenApprover"), true, false))
  await params.broadcast("pouring approver power into Melkor", powers.pour(stringToBytes32("CONFIGURE_TOKEN_APPROVER"), stringToBytes32("Melkor")))

  const angband = await getContract<Types.Angband>(Sections.Angband, "Angband")
  await params.broadcast("authorizing approver power", angband.authorizeInvoker(MTA.address, true))
  return OutputAddressAdder<Types.MorgothTokenApprover>(addresses, "MorgothTokenApprover", MTA)
}

const getMorgothTokenApprover = async (existing: AddressFileStructure): Promise<Types.MorgothTokenApprover> => {
  const getContract = await getContractFromSection(existing)

  const proxyDeployer = await getContract(Sections.MorgothTokenApprover, "ProxyDeployer")
  const addressToString = await getContract(Sections.MorgothTokenApprover, "AddressToString")
  let libraries: ethersLib = {
    AddressToString: addressToString.address,
    ProxyDeployer: proxyDeployer.address
  }

  return await getContract(Sections.MorgothTokenApprover, "MorgothTokenApprover", "MorgothTokenApprover", libraries)
}

const deployWhiteListProposal: IDeploymentFunction = async function (params: IDeploymentParams): Promise<OutputAddress> {
  let deploy = deploymentFactory(Sections.WhiteListProposal, params.existing)
  const getContract = await getContractFromSection(params.existing)

  const dao = await getContract<Types.LimboDAO>(Sections.LimboDAO, "LimboDAO")

  const ToggleWhitelistProposalProposalFactory = await ethers.getContractFactory("ToggleWhitelistProposalProposal")
  const proposal = await deploy<Types.ToggleWhitelistProposalProposal>("ToggleWhitelistProposalProposal", ToggleWhitelistProposalProposalFactory, dao.address, "WhiteLister")
  return OutputAddressAdder<Types.ToggleWhitelistProposalProposal>({}, "ToggleWhitelistProposalProposal", proposal)
}

const deployLimboDAO: IDeploymentFunction = async function (params: IDeploymentParams): Promise<OutputAddress> {
  let deploy = deploymentFactory(Sections.LimboDAO, params.existing)
  const LimboDAOFactory = await ethers.getContractFactory("LimboDAO")
  const limboDAO = await deploy<Types.LimboDAO>("LimboDAO", LimboDAOFactory)
  return OutputAddressAdder<Types.LimboDAO>({}, "LimboDAO", limboDAO)
}

const deployV2Migrator: IDeploymentFunction = async function (params: IDeploymentParams): Promise<OutputAddress> {
  let deploy = deploymentFactory(Sections.V2Migrator, params.existing)
  const getContract = await getContractFromSection(params.existing)
  const liquidityReceiver = await getContract(Sections.LiquidityReceiverNew, "LiquidityReceiver")
  const lachesis = await getContract(Sections.Lachesis, "Lachesis")

  const V2MigratorFactory = await ethers.getContractFactory("V2Migrator")
  const V2Migrator = await deploy<Types.V2Migrator>("V2Migrator", V2MigratorFactory, liquidityReceiver.address, lachesis.address)
  return OutputAddressAdder<Types.V2Migrator>({}, "V2Migrator", V2Migrator)
}

const deployProxyHandler: IDeploymentFunction = async function (params: IDeploymentParams): Promise<OutputAddress> {
  let deploy = deploymentFactory(Sections.ProxyHandler, params.existing)
  const ProxyHandlerFactory = await ethers.getContractFactory("ProxyHandler")
  const proxyHandler = await deploy<Types.ProxyHandler>("ProxyHandler", ProxyHandlerFactory)
  return OutputAddressAdder<Types.ProxyHandler>({}, "ProxyHandler", proxyHandler)
}

const snuffPyroWethProxy: IDeploymentFunction = async function (params: IDeploymentParams): Promise<OutputAddress> {
  const getContract = await getContractFromSection(params.existing)
  const snufferCap = await getContract<Types.DeployerSnufferCap>(Sections.DeployerSnufferCap, "DeployerSnufferCap")
  const pyroWethProxy = await getContract<Types.PyroWethProxy>(Sections.PyroWethProxy, "PyroWethProxy")
  const weth = await getContract<Types.WETH10>(Sections.Weth, "Weth", "WETH10")
  const liquidityReceiver = await getContract<Types.LiquidityReceiver>(Sections.LiquidityReceiverNew, "LiquidityReceiver")
  const pyroWethAddress = await liquidityReceiver.getPyroToken(weth.address)
  const PyroWethFactory = await ethers.getContractFactory("PyroToken")
  const pyroWeth = await PyroWethFactory.attach(pyroWethAddress) as Types.PyroToken
  const currentExemption = await pyroWeth.feeExemptionStatus(pyroWethProxy.address)
  if (currentExemption !== FeeExemption.REDEEM_EXEMPT_AND_SENDER_EXEMPT_AND_RECEIVER_EXEMPT)
    await params.broadcast("Snuffing fees on PyroWethProxy", snufferCap.snuff(pyroWethAddress, pyroWethProxy.address, FeeExemption.REDEEM_EXEMPT_AND_SENDER_EXEMPT_AND_RECEIVER_EXEMPT))
  else
    params.logger("PyroWethProxy already exempt. Skipping...")
  return {}
}

const deployPyroWethProxy: IDeploymentFunction = async function (params: IDeploymentParams): Promise<OutputAddress> {
  let deploy = deploymentFactory(Sections.PyroWethProxy, params.existing)
  const getContract = await getContractFromSection(params.existing)

  const weth = await getContract(Sections.Weth, "Weth", "WETH10")
  const liquidityReceiver = await getContract<Types.LiquidityReceiver>(Sections.LiquidityReceiverNew, "LiquidityReceiver")
  const pyroWethAddress = await liquidityReceiver.getPyroToken(weth.address)
  const pyroWethProxyFactory = await ethers.getContractFactory("PyroWethProxy")
  const pyroWethProxy = await deploy<Types.PyroWethProxy>("PyroWethProxy", pyroWethProxyFactory, pyroWethAddress)
  return OutputAddressAdder<Types.PyroWethProxy>({}, "PyroWethProxy", pyroWethProxy)
}

const deployDeployerSnufferCap: IDeploymentFunction = async function (params: IDeploymentParams): Promise<OutputAddress> {
  let deploy = deploymentFactory(Sections.DeployerSnufferCap, params.existing)
  const getContract = await getContractFromSection(params.existing)
  const liquidityReceiver = await getContract<Types.LiquidityReceiver>(Sections.LiquidityReceiverNew, "LiquidityReceiver")

  const DeployerSnufferCapFactory = await ethers.getContractFactory("DeployerSnufferCap")
  const deployerSnufferCap = await deploy<Types.DeployerSnufferCap>("DeployerSnufferCap", DeployerSnufferCapFactory, liquidityReceiver.address)

  const pyroWethProxy = await getContract<Types.PyroWethProxy>(Sections.PyroWethProxy, "PyroWethProxy")
  const weth = await getContract(Sections.Weth, "Weth", "WETH10")
  const pyroWethAddress = await liquidityReceiver.getPyroToken(weth.address)
  const liquidityREceiverOwner = (await liquidityReceiver.owner()).toString()
  params.logger("LR owner: " + liquidityREceiverOwner + ", deployer " + params.deployer.address)
  //TODO: set snuffer cap power
  //BUG:
  await params.broadcast("setting snuffer cap", liquidityReceiver.setSnufferCap(deployerSnufferCap.address))
  await params.broadcast("Set pyroweth proxy fee exemption", deployerSnufferCap.snuff(pyroWethAddress, pyroWethProxy.address, FeeExemption.REDEEM_EXEMPT_AND_SENDER_EXEMPT_AND_RECEIVER_EXEMPT))

  return OutputAddressAdder<Types.DeployerSnufferCap>({}, "DeployerSnufferCap", deployerSnufferCap)
}

const mapLiquidityReceiver: IDeploymentFunction = async function (params: IDeploymentParams): Promise<OutputAddress> {
  const getContract = await getContractFromSection(params.existing)

  const liquidityReceiver = await getContract<Types.Ownable>(Sections.LiquidityReceiverNew, "LiquidityReceiver")
  const angband = await getContract<Types.Angband>(Sections.Angband, "Angband")

  await liquidityReceiver.transferOwnership(angband.address)
  await angband.mapDomain(liquidityReceiver.address, stringToBytes32("LIQUIDITY_RECEIVER"))
  return {}
}

const refreshTokensOnBehodler: IDeploymentFunction = async function (params: IDeploymentParams): Promise<OutputAddress> {
  let deploy = deploymentFactory(Sections.BehodlerSeedNew, params.existing)
  const getContract = await getContractFromSection(params.existing)
  const fetchTokenAddress = fetchTokenAddressFactory(params.existing)

  const angband = await getContract<Types.Angband>(Sections.Angband, "Angband")
  const refreshPowerInvokerFactory = await ethers.getContractFactory("RefreshTokenOnBehodler")
  const tokens = params.existing["BehodlerTokens"]
  let keys = Object.keys(tokens)
  let addresses = keys.map(k => tokens[k])

  const refreshPowerInvoker = await deploy<Types.RefreshTokenOnBehodler>("RefreshTokenOnBehodler", refreshPowerInvokerFactory, angband.address)
  for (let i = 0; i < addresses.length; i++) {
    params.logger('adding address to power: ' + addresses[i])
    await params.broadcast(`Adding token ${addresses[i]} to power invoker`, refreshPowerInvoker.addToken(addresses[i]))
  }

  await params.broadcast("angbad authorizing refresh power", angband.authorizeInvoker(refreshPowerInvoker.address, true))
  await params.broadcast("executing power invoker", angband.executePower(refreshPowerInvoker.address))

  const behodler = await getBehodler(params.existing)
  let invalidSet: string[] = []
  for (let i = 0; i < addresses.length; i++) {
    const address = addresses[i]
    params.logger('about to check address ' + address)
    const valid = await behodler.validTokens(address)
    if (!valid)
      invalidSet.push(address)
  }
  if (invalidSet.length > 0) {
    throw "some tokens not valid" + JSON.stringify(invalidSet)
  }
  return {}
}

const reseedBehodler: IDeploymentFunction = async function (params: IDeploymentParams): Promise<OutputAddress> {
  let deploy = deploymentFactory(Sections.BehodlerSeedNew, params.existing)
  const getContract = await getContractFromSection(params.existing)
  const fetchTokenAddress = fetchTokenAddressFactory(params.existing)

  const weth = await getContract(Sections.Weth, "Weth", "WETH10")
  const flashLoanArbiter = params.deployer.address
  const liquidityReceiver = await getContract(Sections.LiquidityReceiverNew, "LiquidityReceiver")
  const weidaiReserve = flashLoanArbiter
  const dai = await fetchTokenAddress("DAI")
  const weiDai = await fetchTokenAddress("WEIDAI")
  const lachesis = await getContract(Sections.Lachesis, "Lachesis")
  //instantiate and seed morgoth power to seed
  const powersRegistry = await getContract<Types.PowersRegistry>(Sections.Powers, "PowersRegistry")
  let scarcityPower = stringToBytes32("CONFIGURE_SCARCITY")

  const angband = await getContract<Types.Angband>(Sections.Angband, "Angband")

  //approve power on morgoth
  await params.broadcast("create power configure scarcity", powersRegistry.create(scarcityPower, stringToBytes32("BEHODLER"), true, false))
  await params.broadcast("pour power", powersRegistry.pour(scarcityPower, stringToBytes32("Melkor")))

  const melkorIsDeployer = await powersRegistry.isUserMinion(params.deployer.address, stringToBytes32("Melkor"))
  params.logger('Melkor is deployer: ' + melkorIsDeployer)
  params.logger('deployer ' + params.deployer.address)
  const userHasPower = await powersRegistry.userHasPower(scarcityPower, params.deployer.address)
  params.logger('User has power ' + userHasPower)
  params.logger('powers registry in deployment: ' + powersRegistry.address)

  const SeedBehodlerFactory = await ethers.getContractFactory("SeedBehodlerPower")
  const seedBehodler = await deploy<Types.SeedBehodlerPower>("SeedBehodlerPower", SeedBehodlerFactory, angband.address)

  //execute power
  await params.broadcast("parameterize seedBehodler power", seedBehodler.parameterize(weth.address, lachesis.address, flashLoanArbiter, liquidityReceiver.address, weidaiReserve, dai, weiDai))
  await params.broadcast("angband authorize power", angband.authorizeInvoker(seedBehodler.address, true))
  await params.broadcast("angband execute power", angband.executePower(seedBehodler.address))
  return OutputAddressAdder<Types.SeedBehodlerPower>({}, "SeedBehodlerPower", seedBehodler)
}

const deployNewLiquidityReceiver: IDeploymentFunction = async function (params: IDeploymentParams): Promise<OutputAddress> {
  let deploy = deploymentFactory(Sections.LiquidityReceiverNew, params.existing)
  const getContract = await getContractFromSection(params.existing)

  const lachesis = await getContract(Sections.Lachesis, "Lachesis")
  const bigConstants = await getContract(Sections.BigConstants, "BigConstants")

  const liquidityReceiverFactory = await ethers.getContractFactory("LiquidityReceiver")

  const liquidityReceiver = await deploy<Types.LiquidityReceiver>("LiquidityReceiver", liquidityReceiverFactory,
    lachesis.address, bigConstants.address)

  let addresses = OutputAddressAdder<Types.LiquidityReceiver>({}, "LiquidityReceiver", liquidityReceiver)

  const weth = await getContract(Sections.Weth, "Weth", "WETH10")
  const fetchTokenAddress = fetchTokenAddressFactory(params.existing)

  const mkr = await fetchTokenAddress("MKR")
  const oxt = await fetchTokenAddress("OXT")
  const pnk = await fetchTokenAddress("PNK")
  const lnk = await fetchTokenAddress("LINK")
  const loom = await fetchTokenAddress("LOOM")

  const eyedai = await fetchTokenAddress("EYE_DAI UniV2")
  const scxeth = await fetchTokenAddress("SCX_ETH UniV2")
  const scxeye = await fetchTokenAddress("SCX_EYE UniV2")

  await liquidityReceiver.registerPyroToken(mkr, "PyroMKR", "PMKR", 18)
  await liquidityReceiver.registerPyroToken(oxt, "PyroOXT", "POXT", 18)
  await liquidityReceiver.registerPyroToken(pnk, "PyroPNK", "PPNK", 18)
  await liquidityReceiver.registerPyroToken(lnk, "PyroLINK", "PLNK", 18)
  await liquidityReceiver.registerPyroToken(loom, "PyroLOOM", "PLOOM", 18)
  await liquidityReceiver.registerPyroToken(eyedai, "PyroEYE_DAI UniV2", "PEYE_DAI UniV2", 18)
  await liquidityReceiver.registerPyroToken(scxeth, "PyroSCX_ETH UniV2", "PSCX_ETH UniV2", 18)
  await liquidityReceiver.registerPyroToken(scxeye, "PyroSCX_EYE UniV2", "PSCX_EYE UniV2", 18)
  await liquidityReceiver.registerPyroToken(weth.address, "PyroWETH", "PWETH", 18) //pyroWeth10
  return addresses
}


const deployBigConstants: IDeploymentFunction = async function (params: IDeploymentParams): Promise<OutputAddress> {
  let deploy = deploymentFactory(Sections.BigConstants, params.existing)
  const BCFactory = await ethers.getContractFactory("BigConstants")
  const bigConstants = await deploy<Types.BigConstants>("BigConstants", BCFactory)
  return OutputAddressAdder({}, "BigConstants", bigConstants)
}

const deployAngband: IDeploymentFunction = async function (params: IDeploymentParams): Promise<OutputAddress> {
  let deploy = deploymentFactory(Sections.Powers, params.existing)
  const getContract = await getContractFromSection(params.existing)

  const powersRegistry = await getContract(Sections.Powers, "PowersRegistry")

  //deploy angband
  const angbandFactory = await ethers.getContractFactory("Angband")
  const angband = await deploy<Types.Angband>("Angband", angbandFactory, powersRegistry.address)
  let addresses = await OutputAddressAdder<Types.Angband>({}, "Angband", angband)

  //finalizeSetup
  await params.broadcast("angband finalize", angband.finalizeSetup())

  //transfer behodler, lachesis, LR_old and PyroWeth10Proxy to angband
  const behodler = await getBehodler(params.existing)
  const lachesis = await getContract<Types.Ownable>(Sections.Lachesis, "Lachesis")
  const LR_old = await getContract<Types.Ownable>(Sections.LiquidityReceiverOld, "LiquidityReceiverV1")
  const pyroWeth10Proxy = await getContract<Types.Ownable>(Sections.PyroWeth10Proxy, "PyroWeth10Proxy")

  await params.broadcast("transfer behodler to angband", behodler.transferOwnership(angband.address))
  await params.broadcast("transfer lachesis to angband", lachesis.transferOwnership(angband.address))
  await params.broadcast("transfer LR to angband", LR_old.transferOwnership(angband.address))
  await params.broadcast("transfer pyroWeth10Proxy to angband", pyroWeth10Proxy.transferOwnership(angband.address))

  //setBehodler
  await params.broadcast("angband set behodler", angband.setBehodler(behodler.address, lachesis.address))

  //map domains for proxies
  await params.broadcast("angband map LR_OLD", angband.mapDomain(LR_old.address, stringToBytes32("LR_OLD")))
  await params.broadcast("angband map pyroweth10", angband.mapDomain(pyroWeth10Proxy.address, stringToBytes32("PyroWeth10Proxy")))
  return addresses
}

const deployPowers: IDeploymentFunction = async function (params: IDeploymentParams): Promise<OutputAddress> {
  let deploy = deploymentFactory(Sections.Powers, params.existing)
  const powersFactory = await ethers.getContractFactory("PowersRegistry")
  const powers = await deploy<Types.PowersRegistry>("PowersRegistry", powersFactory)
  await powers.seed()
  return OutputAddressAdder<Types.PowersRegistry>({}, "PowersRegistry", powers)
}

const deployConfigureScarcityPower: IDeploymentFunction = async function (params: IDeploymentParams): Promise<OutputAddress> {
  let deploy = deploymentFactory(Sections.LiquidityReceiverOld, params.existing)
  const getContract = await getContractFromSection(params.existing)

  const powersRegistry = await getContract(Sections.Powers, "PowersRegistry")
  const power = "CONFIGURE_SCARCITY"

  const ConfigureScarcityPowerFactory = await ethers.getContractFactory("ConfigureScarcityPower")
  const angband = await getContract<Types.Angband>(Sections.Angband, "Angband")
  const configureScarcityPower = await deploy<Types.ConfigureScarcityPower>("ConfigureScarcityPower", ConfigureScarcityPowerFactory, angband.address)
  await angband.authorizeInvoker(configureScarcityPower.address, true)
  return OutputAddressAdder<Types.ConfigureScarcityPower>({}, "ConfigureScarcityPower", configureScarcityPower)
}
const deployMultiCall: IDeploymentFunction = async function (params: IDeploymentParams): Promise<OutputAddress> {
  let deploy = deploymentFactory(Sections.MultiCall, params.existing)

  const Multicall = await ethers.getContractFactory("Multicall3");
  const multicall = await deploy<Types.Multicall3>("Multicall3", Multicall);
  return OutputAddressAdder<Types.Multicall3>({} as OutputAddress, "Multicall3", multicall)
}

const deployPyroWeth10ProxyOld: IDeploymentFunction = async function (params: IDeploymentParams): Promise<OutputAddress> {
  let deploy = deploymentFactory(Sections.RegisterPyroWeth10, params.existing)

  const fetchPyro = fetchOldPyroToken(params.existing)
  const pyroWeth = await fetchPyro("Weth", params.logger)
  const pyroWeth10ProxyV1Factory = await ethers.getContractFactory("PyroWeth10Proxy")
  const pyroWeth10Proxy = await deploy<Types.PyroWeth10Proxy>("PyroWeth10Proxy", pyroWeth10ProxyV1Factory, pyroWeth.address)

  return OutputAddressAdder<Types.PyroWeth10Proxy>({}, "PyroWeth10Proxy", pyroWeth10Proxy)
}

const fetchOldPyroToken = (existing: AddressFileStructure) => async (contract: contractNames, logger: (message: string) => void): Promise<Types.PyroTokenV2> => {
  const getContract = await getContractFromSection(existing)
  const token = contract === "Weth" ? await getContract(Sections.Weth, "Weth", "WETH10") :
    await getContract(Sections.BehodlerTokens, contract)
  const baseTokenAddress = token.address

  const LR = await getContract<Types.LiquidityReceiverV1>(Sections.LiquidityReceiverOld, "LiquidityReceiverV1");

  const pyroAddress = await LR.baseTokenMapping(baseTokenAddress)
  logger('pyro address: ' + pyroAddress)
  const pyroFactory = await ethers.getContractFactory("PyroToken_V2")
  return pyroFactory.attach(pyroAddress) as Types.PyroTokenV2
}

const fetchTokenAddressFactory = (existing: AddressFileStructure) => async (contract: contractNames) => {
  const getContract = await getContractFromSection(existing)
  const token = await getContract(Sections.BehodlerTokens, contract, "ERC677")
  return token.address
}

const fetchTokenFactory = (existing: AddressFileStructure, section: Sections) => async (tokenName: tokenNames) => {
  const getContract = await getContractFromSection(existing)
  const token = await getContract(section, tokenName, "ERC20")
  return token
}

const deployOldLiquidityReceiver: IDeploymentFunction = async function (params: IDeploymentParams): Promise<OutputAddress> {
  let deploy = deploymentFactory(Sections.LiquidityReceiverOld, params.existing)
  const getContract = await getContractFromSection(params.existing)

  const lachesis = await getContract<Types.Lachesis>(Sections.Lachesis, "Lachesis")
  const LRFactory = await ethers.getContractFactory("LiquidityReceiverV1")
  const LR1 = await deploy<Types.LiquidityReceiverV1>("LiquidityReceiverV1", LRFactory, lachesis.address)

  const behodler = await getBehodler(params.existing)
  const weth = await getContract(Sections.Weth, "Weth", "WETH10")
  const fetchTokenAddress = fetchTokenAddressFactory(params.existing)

  const weiDai = await fetchTokenAddress("WEIDAI")
  const dai = await fetchTokenAddress("DAI")
  await behodler.seed(weth.address, lachesis.address,
    params.deployer.address,
    LR1.address, params.deployer.address,
    dai, weiDai)

  const mkr = await fetchTokenAddress("MKR")
  const oxt = await fetchTokenAddress("OXT")
  const pnk = await fetchTokenAddress("PNK")
  const lnk = await fetchTokenAddress("LINK")
  const loom = await fetchTokenAddress("LOOM")

  const eyedai = await fetchTokenAddress("EYE_DAI UniV2")
  const scxeth = await fetchTokenAddress("SCX_ETH UniV2")
  const scxeye = await fetchTokenAddress("SCX_EYE UniV2")

  await params.broadcast("LR1 registerMKR", LR1.registerPyroToken(mkr))
  await params.broadcast("LR1 registerOXT", LR1.registerPyroToken(oxt))
  await params.broadcast("LR1 registerPNK", LR1.registerPyroToken(pnk))
  await params.broadcast("LR1 registerLNK", LR1.registerPyroToken(lnk))
  await params.broadcast("LR1 registerLOOM", LR1.registerPyroToken(loom))
  await params.broadcast("LR1 registerEYEDAI", LR1.registerPyroToken(eyedai))
  await params.broadcast("LR1 registerSCXETH", LR1.registerPyroToken(scxeth))
  await params.broadcast("LR1 registerSCXEYE", LR1.registerPyroToken(scxeye))
  await params.broadcast("LR1 registerWETH", LR1.registerPyroToken(weth.address))

  return OutputAddressAdder<Types.LiquidityReceiverV1>({}, "LiquidityReceiverV1", LR1)
}

const deployLachesis: IDeploymentFunction = async function (params: IDeploymentParams): Promise<OutputAddress> {
  let deploy = deploymentFactory(Sections.Lachesis, params.existing)
  const getContract = await getContractFromSection(params.existing)

  const uniswap = await getContract<Types.UniswapV2Router02>(Sections.UniswapV2Clones, "UniswapV2Factory", "UniswapV2Factory")
  const sushiswap = await getContract<Types.UniswapV2Router02>(Sections.UniswapV2Clones, "SushiswapV2Factory", "UniswapV2Factory")
  const behodler = await getBehodler(params.existing)
  const LachesisFactory = await ethers.getContractFactory("Lachesis")
  const lachesis = await deploy<Types.Lachesis>("Lachesis", LachesisFactory, uniswap.address, sushiswap.address)
  await params.broadcast("Lachesis set behodler", lachesis.setBehodler(behodler.address))

  const fetchToken = async (contract: contractNames) =>
    await getContract(Sections.BehodlerTokens, contract, "ERC677")

  const eye = await fetchToken("EYE")
  const mkr = await fetchToken("MKR")
  const oxt = await fetchToken("OXT")
  const pnk = await fetchToken("PNK")
  const lnk = await fetchToken("LINK")
  const loom = await fetchToken("LOOM")
  const dai = await fetchToken("DAI")
  const weiDai = await fetchToken("WEIDAI")
  const eyedai = await fetchToken("EYE_DAI UniV2")
  const scxeth = await fetchToken("SCX_ETH UniV2")
  const scxeye = await fetchToken("SCX_EYE UniV2")
  const weth = await getContract(Sections.Weth, "Weth", "WETH10")

  await params.broadcast("Lachesis approve eye", lachesis.measure(eye.address, true, true))
  await params.broadcast("Lachesis approve mkr", lachesis.measure(mkr.address, true, false))
  await params.broadcast("Lachesis approve oxt", lachesis.measure(oxt.address, true, false))
  await params.broadcast("Lachesis approve pnk", lachesis.measure(pnk.address, true, false))
  await params.broadcast("Lachesis approve lnk", lachesis.measure(lnk.address, true, false))
  await params.broadcast("Lachesis approve loom", lachesis.measure(loom.address, true, false))
  await params.broadcast("Lachesis approve dai", lachesis.measure(dai.address, true, false))
  await params.broadcast("Lachesis approve weiDai", lachesis.measure(weiDai.address, true, true))

  await params.broadcast("Lachesis approve eyeDai", lachesis.measure(eyedai.address, true, false))
  await params.broadcast("Lachesis approve scxEth", lachesis.measure(scxeth.address, true, false))
  await params.broadcast("Lachesis approve scxEye", lachesis.measure(scxeye.address, true, false))
  await params.broadcast("Lachesis approve weth", lachesis.measure(weth.address, true, false))

  return OutputAddressAdder<Types.Lachesis>({} as OutputAddress, "Lachesis", lachesis)
}

const deployBehodlerTokens: IDeploymentFunction = async function (params: IDeploymentParams): Promise<OutputAddress> {
  let deploy = deploymentFactory(Sections.BehodlerTokens, params.existing)
  const uniswapName: contractNames = "UniswapV2Factory"
  const uniswapAddress = params.existing[sectionName(Sections.UniswapV2Clones)][uniswapName]
  const UniswapV2FactoryFactory = await ethers.getContractFactory("UniswapV2Factory")
  const uniswapContract = await UniswapV2FactoryFactory.attach(uniswapAddress) as Types.UniswapV2Factory

  const Token = await ethers.getContractFactory("MockToken");
  const eye = await deploy<Types.MockToken>("EYE", Token, "EYE", "EYE", [], []);
  await params.broadcast("minting eye to deployer", eye.mint(ethers.constants.WeiPerEther.mul(500_000)))

  const maker = await deploy<Types.MockToken>("MKR", Token, "MAKER", "MKR", [], []);
  const oxt = await deploy<Types.MockToken>("OXT", Token, "OXT", "OXT", [], []);
  const pnk = await deploy<Types.MockToken>("PNK", Token, "PNK", "PNK", [], []);
  const link = await deploy<Types.MockToken>("LINK", Token, "LINK", "LINK", [], []);
  const loom = await deploy<Types.MockToken>("LOOM", Token, "LOOM", "LOOM", [], []);
  const dai = await deploy<Types.MockToken>("DAI", Token, "DAI", "DAI", [], []);
  const weidai = await deploy<Types.MockToken>("WEIDAI", Token, "WEIDAI", "WEIDAI", [], []);
  const scarcity = await getBehodler(params.existing)

  const UniswapPairFactory = await ethers.getContractFactory("UniswapV2Pair")
  const pairDeployer = (token0: string, token1: string) => async (): Promise<Contract> => {
    await params.broadcast("creating pair", uniswapContract.createPair(token0, token1))
    const result = await uniswapContract.getPair(token0, token1)
    return UniswapPairFactory.attach(result)
  }
  let uniswapDeployer = deploymentFactory(Sections.BehodlerTokens, params.existing, pairDeployer(eye.address, dai.address))
  const getContract = getContractFromSection(params.existing)

  const UniswapV2Pair = await ethers.getContractFactory("UniswapV2Pair")

  const eyeDai = await uniswapDeployer<Types.UniswapV2Pair>("EYE_DAI UniV2", UniswapV2Pair)
  const uniswapRouter = await getContract<Types.UniswapV2Router02>(Sections.UniswapV2Clones, "UniswapV2Router", "UniswapV2Router02")
  const uniWeth = await uniswapRouter.WETH()


  uniswapDeployer = deploymentFactory(Sections.BehodlerTokens, params.existing, pairDeployer(scarcity.address, uniWeth))
  const scxEth = await uniswapDeployer<Types.UniswapV2Pair>("SCX_ETH UniV2", UniswapV2Pair)

  uniswapDeployer = deploymentFactory(Sections.BehodlerTokens, params.existing, pairDeployer(scarcity.address, eye.address))
  const scxEYE = await uniswapDeployer<Types.UniswapV2Pair>("SCX_EYE UniV2", UniswapV2Pair)

  let tokens: OutputAddress = OutputAddressAdder<Types.MockToken>({}, "EYE", eye);
  tokens = OutputAddressAdder<Types.MockToken>(tokens, "MKR", maker);
  tokens = OutputAddressAdder<Types.MockToken>(tokens, "OXT", oxt);
  tokens = OutputAddressAdder<Types.MockToken>(tokens, "PNK", pnk);
  tokens = OutputAddressAdder<Types.MockToken>(tokens, "LINK", link);
  tokens = OutputAddressAdder<Types.MockToken>(tokens, "LOOM", loom);
  tokens = OutputAddressAdder<Types.MockToken>(tokens, "DAI", dai);
  tokens = OutputAddressAdder<Types.MockToken>(tokens, "WEIDAI", weidai);
  tokens = OutputAddressAdder<Types.UniswapV2Pair>(tokens, "EYE_DAI UniV2", eyeDai)
  tokens = OutputAddressAdder<Types.UniswapV2Pair>(tokens, "SCX_ETH UniV2", scxEth)
  tokens = OutputAddressAdder<Types.UniswapV2Pair>(tokens, "SCX_EYE UniV2", scxEYE)
  return tokens;
}

const addInitialLiquidityToBehodler: IDeploymentFunction = async function (params: IDeploymentParams): Promise<OutputAddress> {
  const getContract = await getContractFromSection(params.existing)

  const fetchToken = async (contract: tokenNames, section: Sections) =>
    await getContract<Types.MockToken>(section, contract, "MockToken")

  const dai = await fetchToken("DAI", Sections.BehodlerTokens)
  const eye = await fetchToken("EYE", Sections.BehodlerTokens)
  const lnk = await fetchToken("LINK", Sections.BehodlerTokens)
  const loom = await fetchToken("LOOM", Sections.BehodlerTokens)
  const mkr = await fetchToken("MKR", Sections.BehodlerTokens)
  const oxt = await fetchToken("OXT", Sections.BehodlerTokens)
  const pnk = await fetchToken("PNK", Sections.BehodlerTokens)
  const weiDai = await fetchToken("WEIDAI", Sections.BehodlerTokens)

  const behodler = await getBehodler(params.existing)

  interface tokenAmount {
    token: Types.MockToken
    amount: number
  }

  const fetchUniPai = async (pair: behodlerTokenNames) => getContract<Types.UniswapV2Pair>(Sections.BehodlerTokens, pair, "UniswapV2Pair")
  const EYE_DAI = await fetchUniPai("EYE_DAI UniV2")
  const SCX_ETH = await fetchUniPai("SCX_ETH UniV2")
  const SCX_EYE = await fetchUniPai("SCX_EYE UniV2")

  const balanceOfEyeDai = await EYE_DAI.balanceOf(params.deployer.address)
  const balanceOfScxWeth = await SCX_ETH.balanceOf(params.deployer.address)
  const balanceOfScXEye = await SCX_EYE.balanceOf(params.deployer.address)

  // await params.broadcast("mint flan into behodler", flan.mint(behodler.address,ethers.constants.WeiPerEther.mul(10_000)),params.pauser)

  const liquidity: tokenAmount[] = [
    { token: dai, amount: 10_000 },
    { token: eye, amount: 5000 },
    { token: lnk, amount: 1890 },
    { token: mkr, amount: 900 },
    { token: oxt, amount: 40_000 },
    { token: loom, amount: 90_000 },
    { token: pnk, amount: 100_000 },
    { token: weiDai, amount: 82_000 },
  ]

  for (let i = 0; i < liquidity.length; i++) {
    let item = liquidity[i]
    const amount = ethers.constants.WeiPerEther.mul(item.amount)
    //if token is Dai, we need extra for Flan Genesis
    const mintAmount = item.token.address == dai.address ? amount.mul(2) : amount
    await params.broadcast(`minting token ${item.token.address}`, item.token.mint(mintAmount))
    await params.broadcast('transferring to behodler', item.token.transfer(behodler.address, amount))
  }

  const pairLiquidity = [
    [SCX_ETH, balanceOfScxWeth],
    [SCX_EYE, balanceOfScXEye],
    [EYE_DAI, balanceOfEyeDai]
  ]

  for (let i = 0; i < pairLiquidity.length; i++) {
    const pair = pairLiquidity[i]
    const token = pair[0] as Types.UniswapV2Pair
    const amount = pair[1] as BigNumber
    await params.broadcast("transferring liquidity to behodler", token.transfer(behodler.address, amount))
  }

  return {}
}

export async function deployWeth(
  params: IDeploymentParams
): Promise<OutputAddress> {
  const deploy = deploymentFactory(Sections.Weth, params.existing)

  const Weth = await ethers.getContractFactory("WETH10");
  const weth = await deploy<Types.WETH10>("Weth", Weth);

  return OutputAddressAdder<Types.WETH10>({}, "Weth", weth);
}

export async function deployBehodler(params: IDeploymentParams): Promise<OutputAddress> {
  const deploy = deploymentFactory(Sections.Behodler, params.existing)

  const AddressBalanceCheck = await ethers.getContractFactory("AddressBalanceCheck");
  // const ABDK = await ethers.getContractFactory("ABDK");
  const addressBalanceCheck = await deploy<Types.AddressBalanceCheck>("AddressBalanceCheck", AddressBalanceCheck)
  const BehodlerFactory = await ethers.getContractFactory("Behodler",
    {
      libraries: {
        AddressBalanceCheck: addressBalanceCheck.address
        // ABDK: (await ABDK.deploy()).address
      }
    })

  const behodler = await deploy<Types.Behodler>("Behodler", BehodlerFactory)

  await behodler.setSafetParameters(30, 60);
  await behodler.configureScarcity(20, 5, params.deployer.address) //this must be changed before end of script
  let addresses: OutputAddress = OutputAddressAdder({}, "AddressBalanceCheck", addressBalanceCheck)
  return OutputAddressAdder<Types.Behodler>(addresses, "Behodler", behodler)
}

const deployUniclones: IDeploymentFunction = async function uniclone(
  params: IDeploymentParams
): Promise<OutputAddress> {
  let deploy = deploymentFactory(Sections.UniswapV2Clones, params.existing)

  let addresses = {} as OutputAddress

  const UniswapV2RouterFactory = await ethers.getContractFactory("UniswapV2Router02")
  const UniswapV2Factory = await ethers.getContractFactory("UniswapV2Factory");

  let uniswapRouter: Types.UniswapV2Router02
  let uniswapFactory: Types.UniswapV2Factory
  let sushiswapRouter: Types.UniswapV2Router02
  let sushiswapFactory: Types.UniswapV2Factory
  let wethContractName: contractNames = "Weth"
  let wethAddress = params.existing[sectionName(Sections.Weth)][wethContractName]

  params.logger("router and factory deploys...")
  uniswapFactory = await deploy<Types.UniswapV2Factory>("UniswapV2Factory", UniswapV2Factory, params.deployer.address);
  uniswapRouter = await deploy<Types.UniswapV2Router02>("UniswapV2Router", UniswapV2RouterFactory, uniswapFactory.address, wethAddress)
  sushiswapFactory = await deploy<Types.UniswapV2Factory>("SushiswapV2Factory", UniswapV2Factory, params.deployer.address);
  sushiswapRouter = await deploy<Types.UniswapV2Router02>("SushiswapV2Router", UniswapV2RouterFactory, uniswapFactory.address, wethAddress)

  addresses = OutputAddressAdder<Types.UniswapV2Factory>(addresses, "UniswapV2Factory", uniswapFactory)
  addresses = OutputAddressAdder<Types.UniswapV2Router02>(addresses, "UniswapV2Router", uniswapRouter)
  addresses = OutputAddressAdder<Types.UniswapV2Factory>(addresses, "SushiswapV2Factory", sushiswapFactory)
  addresses = OutputAddressAdder<Types.UniswapV2Router02>(addresses, "SushiswapV2Router", sushiswapRouter)

  return addresses
}

export const precheckMelkor: IDeploymentFunction = async function (params: IDeploymentParams): Promise<OutputAddress> {
  const getContract = await getContractFromSection(params.existing)
  const powers = await getContract<Types.PowersRegistry>(Sections.Powers, "PowersRegistry")
  const isMelkor = await powers.isUserMinion(params.deployer.address, stringToBytes32("Melkor"))
  if (!isMelkor)
    throw "PyroV3 can only be deployed by Melkor"
  return {}
}

export const prechecks: IDeploymentFunction = async function (params: IDeploymentParams): Promise<OutputAddress> {
  const getContract = await getContractFromSection(params.existing)

  params.logger("Precheck: testing if Deployer has enough Dai.")
  //Flan genesis requires deployer have a big Dai balance
  let sufficientDai = true
  let sufficientEYE = true
  try {
    const dai = await getContract(Sections.BehodlerTokens, "DAI", "ERC20") as Types.ERC20
    const daiBalance = await dai.balanceOf(params.deployer.address)
    sufficientDai = (daiBalance.gt(ethers.constants.WeiPerEther.mul(1000)))
    const eye = await getContract(Sections.BehodlerTokens, "EYE", "ERC20") as Types.ERC20
    const eyeBalance = await eye.balanceOf(params.deployer.address)
    sufficientEYE = eyeBalance.gt(daiBalance)
  } catch {
    //testnet
  }
  let successfulMint = false;
  if (!sufficientDai) {

    try {
      const dai = await getContract<Types.MockToken>(Sections.BehodlerTokens, "DAI", "MockToken")
      await dai.mint(ethers.constants.WeiPerEther.mul(10000))
      const eye = await getContract<Types.MockToken>(Sections.BehodlerTokens, "EYE", "MockToken")
      await eye.mint(ethers.constants.WeiPerEther.mul(50000))
      successfulMint = true
    } catch { }
    if (!successfulMint)
      throw "Error: Seed deployer with lots of Dai"
  }

  if (!sufficientEYE && !successfulMint) {
    throw "Error: Seed deployer with lots of EYE"
  }

  try {
    if (shell.ls("./contracts/DAO/Proposals").length == 8)
      throw 'mismatched contract list length'
  } catch (err) {
    params.logger(err as string)
    if (err === 'mismatched contract list length')
      throw err
  }
  return {}
}

export const extractTokenConfig = async function (params: IDeploymentParams): Promise<ITokenConfig[]> {
  const getContract = await getContractFromSection(params.existing, "extract")
  const LR_old = await getContract<Types.LiquidityReceiverV1>(Sections.LiquidityReceiverOld, "LiquidityReceiverV1");
  const LR_new = await getContract<Types.LiquidityReceiver>(Sections.LiquidityReceiverNew, "LiquidityReceiver");
  let tokenConfigs = [] as ITokenConfig[]

  const pyroTokenFactory = await ethers.getContractFactory("PyroToken")
  const behodlerTokenSection = params.existing[sectionName(Sections.BehodlerTokens)]
  let weth: Contract = await getContract(Sections.Weth, "Weth", "WETH10")

  const behodlerTokenNames = [...Object.keys(behodlerTokenSection), "Weth"]
  for (let index = 0; index < behodlerTokenNames.length; index++) {
    const tokenName = behodlerTokenNames[index] as contractNames
    const token = tokenName == "Weth" ? weth :
      await getContract<Types.ERC20>(Sections.BehodlerTokens, tokenName, "ERC20")

    let displayName: string = tokenName
    let pyroDisplayName = 'pyro(' + tokenName + ')'
    if (tokenName.includes('_')) {
      const slashed = [displayName, pyroDisplayName]
        .map(tokenName => tokenName.split('_')[0] + '/' + tokenName.split('_')[1])
      displayName = slashed[0]
      pyroDisplayName = slashed[1]
    } else {
      pyroDisplayName = pyroDisplayName.substring(0, pyroDisplayName.indexOf('('))
        + pyroDisplayName.substring(pyroDisplayName.indexOf('(') + 1, pyroDisplayName.indexOf(')'))
    }
    const pyroV2Address = await LR_old.baseTokenMapping(token.address)
    const pyroV3Address = await LR_new.getPyroToken(token.address)
    const v3Deployed = await pyroTokenFactory.attach(pyroV3Address).deployed().catch(() => { params.logger('v3 deployment not found for ' + tokenName) })

    const tokenConfig = {
      name: tokenName,
      displayName: displayName,
      pyroDisplayName: v3Deployed ? pyroDisplayName : '',
      address: token.address,
      pyroV2Address: pyroV2Address,
      pyroV3Address: v3Deployed ? pyroV3Address : ethers.constants.AddressZero
    } as ITokenConfig
    tokenConfigs.push(tokenConfig)
  }
  return tokenConfigs
}

