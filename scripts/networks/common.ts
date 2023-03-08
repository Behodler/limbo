import { ethers, network } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { Contract, ContractFactory, ContractTransaction } from "ethers";
import * as Web3 from 'web3'
import { time, mine } from "@nomicfoundation/hardhat-network-helpers";

type address = string;


export const OutputAddressAdder = <T extends Contract>(store: OutputAddress, name: contractNames, contract: T) => {
  store[name] = contract.address
  return store
}

export interface OutputAddress {
  [key: string]: address;
}

export interface AddressFileStructure {
  [key: string]: OutputAddress;
}

export function logFactory(visible: boolean) {
  return function (message: any) {
    if (visible) console.log(message);
  };
}

const logger = logFactory(true);

export async function getNonce() {
  const [deployer] = await ethers.getSigners();
  const latestNonce = await getTXCount(deployer);
  return { nonce: latestNonce, gasLimit: 9000000 };
}

export async function getTXCount(deployer: SignerWithAddress) {
  return await network.provider.send("eth_getTransactionCount", [deployer.address, "latest"]);
}

//note:duration is milliseconds 
function pauserFactory(duration: number, network: string, confirmations: number) {
  const networkToUse = network == "hardhat" ? "localhost" : network;
  let provider = ethers.provider; //ethers.getDefaultProvider(networkToUse);

  return async function () {
    const initialBlock = await provider.getBlockNumber();
    console.log('PAUSE FACTORY')
    let currentBlock = await provider.getBlockNumber();

    while (currentBlock - initialBlock < confirmations) {
      //logger(`current block ${currentBlock}, initial block ${initialBlock}`);
      const remaining = confirmations - (currentBlock - initialBlock);
      //  logger(`${remaining} blocks remaining. Pausing for ${duration / 1000} seconds`);
      // logger("                                                       ");
      await pause(confirmations);
      const current = await provider.getBlockNumber();
      //logger("new current block " + current);
      currentBlock = current;
    }
  };
}

export function getPauser(blockTime: number, network: string, confirmations: number) {
  return pauserFactory(blockTime, network, confirmations);
}
//Three options: either actually pause for block time, try time increasing only or just mine
async function pause(confirmations: number) {
  console.log(`PAUSING FOR ${confirmations} blocks`)
  // await time.increase(duration)
  await mine(confirmations)
}

async function syncPause(milliseconds: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, milliseconds);
  });
}

export function broadcastFactory(confirmations: number) {
  return async function broadcast(name: string, transaction: Promise<ContractTransaction>) {
    logger("*****************TX:  " + name + "*****************");
    logger("                                                         ");
    const result = await transaction;
    try {
      logger(`            waiting ${confirmations} blocks to confirm`)
      const receipt = await result.wait(confirmations)

    } catch {
      logger('wait not found')
    }
    return result
  }
}

export interface IDeployer<T extends Contract> {
  (name: string, factory: ContractFactory, pauser: Function, ...args: Array<any>): Promise<T>
}

export function isContractAddress(address: string): boolean {
  if (address && typeof (address) == "string") {
    const matches = address.match("^0x[a-fA-F0-9]{40}$")//contract address regex
    return !!matches && matches.length > 0;
  }
  return false;
}

export function deploymentFactory(
  section: Sections,
  existing: AddressFileStructure,
  pauser: Function,
  customDeploymentCode?: () => Promise<Contract>
) {
  const sectionAddresses = existing[sectionName(section)]
  return async function <T extends Contract>(
    name: contractNames,
    factory: ContractFactory,
    pauser: Function,
    ...args: Array<any>
  ): Promise<T> {


    let gasArgs = args || [];
    //if (gasOverride) gasArgs.push({ gasLimit: 2000000, maxFeePerGas: "0x17D78400", maxPriorityFeePerGas: "0x17D78400" });
    // gasArgs.push({ gasLimit: 2000000, maxFeePerGas: "0x17D78400", maxPriorityFeePerGas: "0x17D78400" });

    // gasArgs.push(await getNonce());
    logger('args ' + JSON.stringify(gasArgs))
    let existingAddress: string | undefined = undefined
    if (sectionAddresses && sectionAddresses[name]) {
      existingAddress = sectionAddresses[name]
    }

    let contract: T
    logger('deploy tx for ' + name)
    // await pauser()
    if (existingAddress && isContractAddress(existingAddress)) {
      contract = await factory.attach(existingAddress) as T
    } else if (customDeploymentCode) {
      logger('      deploy tx: custom')
      contract = await customDeploymentCode() as T;
      logger('      custom address ' + contract.address)
    }
    else {
      logger('      deploy tx: standard')
      contract = await factory.deploy(...gasArgs) as T
    }
    logger('     ----->deployment complete: ' + contract.address)
    try {
      let real = await (contract as any).REAL()
      if (!real)
        throw "Test Contract detected."
    } catch { }
    logger("pausing for deployment of " + name + " at " + new Date().toTimeString());
    // await pauser();
    await contract.deployed();
    return contract;
  }
}
export const stringToBytes32 = (s: string): string => {
  let padded = s.padEnd(32, "\0")
  return ethers.utils.hexlify(ethers.utils.arrayify(Web3.default.utils.fromAscii(padded)))
}
export type networks = "mainnet" | "goerli" | "optimism" | "kovan" | "polygon" | "hardhat" | "arbitrum one" | "sepolia"
export function nameNetwork(networkId: number): networks {
  switch (networkId) {
    case 1: return "mainnet"
    case 5: return "goerli"
    case 10: return "optimism"
    case 42: return "kovan"
    case 137: return "polygon"
    case 1337: return "hardhat"
    case 42161: return "arbitrum one"
    case 11155111: return "sepolia"
    default:
      throw "unknown network";
  }
}



//Note: not all sections deploy contracts.
export enum Sections {
  PreChecks,
  PreCheckMelkor,
  Weth,
  Behodler,
  UniswapV2Clones,
  BehodlerTokens, //create pairs
  Lachesis,
  LiquidityReceiverOld,//SeedBehodler and register all pyrotokens
  RegisterPyroWeth10,
  PyroWeth10Proxy,
  MultiCall,
  Powers,
  PowersSeed,
  Angband,
  AngbandFinalize,
  ConfigureScarcityPower,
  BigConstants,
  LiquidityReceiverNew,
  BehodlerSeedNew,
  RefreshTokensOnBehodler,
  ConfigureIronCrown,//not necessary in testnet but good to keep in mind
  MorgothMapLiquidityReceiver,
  MorgothMapPyroWeth10Proxy,
  PyroWethProxy,
  ProxyHandler,
  V2Migrator,
  LimboDAO,
  WhiteListProposal,
  MorgothTokenApprover,
  TokenProxyRegistry,
  SoulReader,
  FlashGovernanceArbiter,
  Flan,
  AddInitialLiquidityToBehodler,
  FlanSetMintConfig,
  FlanGenesis,
  // PyroFlanBooster,
  Limbo,
  MorgothTokenApproverUpdateConfig,
  RegisterFlanAndPyroOnBehodlerViaCliffFace,
  UniswapHelper,
  LimboOracle,
  TradeOraclePairs,
  RegisterOraclePairs,
  Morgoth_LimboAddTokenToBehodler, //TokenProxyRegistrySetPower
  MultiSoulConfigUpdateProposal,
  ProposalFactory,
  DeployerSnufferCap,
  SnuffPyroWethProxy,
  LR_setDeployerSnuffer,
  UniswapHelperConfigure,
  LimboTokens,//Pick up from here
  LimboDAOSeed,
  LimboConfigureCrossingConfig,
  MorgothMapApprover,
  ConfigureTokenApproverPower, // white list on angband
  TPR_setApprover_setPower,
  LimboDAOProposals, //white list
  FlashgovSetAllToGovernable,
  EndConfigForAll,
  MorgothLimboMinionAndPower,
  MorgothMapLimboDAO,//end config and makeLive first
  DisableDeployerSnufferCap
}

export type recipeNames = 'testnet' | 'statusquo' | 'onlyPyroV3' | 'onlyLimbo'

let testnetRecipe = [
  Sections.PreChecks,
  Sections.Weth,
  Sections.Behodler,
  Sections.UniswapV2Clones,
  Sections.BehodlerTokens,
  Sections.Lachesis,
  Sections.LiquidityReceiverOld,
  // Sections.RegisterPyroWeth10,
  Sections.PyroWeth10Proxy,
  Sections.MultiCall,
  Sections.Powers,
  Sections.Angband,
  Sections.BigConstants,
  Sections.LiquidityReceiverNew,
  Sections.BehodlerSeedNew,
  Sections.RefreshTokensOnBehodler,
  Sections.ConfigureScarcityPower,
  Sections.ConfigureIronCrown,

  Sections.MorgothMapPyroWeth10Proxy,
  Sections.PyroWethProxy,
  Sections.ProxyHandler,
  Sections.V2Migrator,
  Sections.LimboDAO,
  Sections.WhiteListProposal,
  Sections.MorgothTokenApprover,
  Sections.TokenProxyRegistry,
  Sections.SoulReader,
  Sections.FlashGovernanceArbiter,
  Sections.Flan,
  Sections.AddInitialLiquidityToBehodler,
  Sections.FlanSetMintConfig,

  // Sections.PyroFlanBooster, -> Currently incompatible with CliffFace. CliffFace is more helpful for a young stablish coin whereas booster is more for a deep reference pair. Perhaps it should be unleashed in the next bear market.
  Sections.Limbo,
  Sections.DeployerSnufferCap,
  Sections.MorgothMapLiquidityReceiver,
  Sections.MorgothTokenApproverUpdateConfig,
  Sections.RegisterFlanAndPyroOnBehodlerViaCliffFace,
  Sections.FlanGenesis,
  Sections.UniswapHelper,
  Sections.LimboOracle,
  Sections.TradeOraclePairs,
  Sections.RegisterOraclePairs,
  Sections.TradeOraclePairs,
  Sections.Morgoth_LimboAddTokenToBehodler,
  Sections.MultiSoulConfigUpdateProposal,
  Sections.ProposalFactory,

  Sections.SnuffPyroWethProxy,
  Sections.UniswapHelperConfigure,
  Sections.LimboTokens,
  Sections.LimboDAOSeed,
  Sections.LimboConfigureCrossingConfig,

  Sections.MorgothMapApprover,
  Sections.ConfigureTokenApproverPower,
  Sections.TPR_setApprover_setPower,
  Sections.LimboDAOProposals,
  Sections.FlashgovSetAllToGovernable,
  Sections.EndConfigForAll,
  Sections.MorgothLimboMinionAndPower,
  Sections.MorgothMapLimboDAO,
  Sections.DisableDeployerSnufferCap
]

interface RecipeTypes {
  name: recipeNames
  recipe: Sections[]
}

let deploymentRecipes: RecipeTypes[] = []
deploymentRecipes.push({ name: "testnet", recipe: testnetRecipe })
deploymentRecipes.push({
  name: "statusquo", recipe: [
    Sections.PreChecks,
    Sections.Weth,
    Sections.Behodler,
    Sections.UniswapV2Clones,
    Sections.BehodlerTokens,
    Sections.Lachesis,
    Sections.LiquidityReceiverOld,
    // Sections.RegisterPyroWeth10,
    Sections.PyroWeth10Proxy,
    Sections.MultiCall,
    Sections.Powers,
    Sections.Angband,
    Sections.ConfigureScarcityPower,
    Sections.ConfigureIronCrown,
    Sections.RefreshTokensOnBehodler,
    Sections.AddInitialLiquidityToBehodler
  ]
})

deploymentRecipes.push({
  name: "onlyPyroV3", recipe: [
    Sections.PreCheckMelkor,
    Sections.BigConstants,
    Sections.LiquidityReceiverNew,
    Sections.BehodlerSeedNew,
    Sections.RefreshTokensOnBehodler,
    Sections.ConfigureIronCrown,
  
    Sections.PyroWethProxy,
    Sections.MorgothMapPyroWeth10Proxy,
    Sections.DeployerSnufferCap,
    Sections.MorgothMapLiquidityReceiver,
    
    Sections.SnuffPyroWethProxy,
    Sections.ProxyHandler,
    Sections.V2Migrator,
    Sections.DisableDeployerSnufferCap
  ]
})
export const fetchDeploymentRecipe = (name: recipeNames) => {
  const found = deploymentRecipes.filter(r => r.name == name)
  if (found.length === 0)
    throw `Recipe '${name}' not defined yet`
  return found[0].recipe
}

export const sectionName = (section: Sections): string => Sections[section]

export type behodlerTokenNames = "EYE" | "MKR" | "OXT" | "PNK" | "LNK" | "LOOM" | "DAI" | "WEIDAI" | "EYE_DAI" | "SCX_ETH" | "SCX_EYE"

export type criticalPairNames = "FLN_SCX" | "DAI_SCX" | "SCX__FLN_SCX"

export type limboTokenNames = "Aave" | "Curve" | "Convex" | "MIM" | "Uni" | "WBTC" | "Sushi"

export type tokenNames = behodlerTokenNames | limboTokenNames | criticalPairNames | "Flan"


export type proposalNames = "AdjustFlanFeeOnTransferProposal" |
  "ApproveFlanMintingProposal" |
  "BurnFlashStakeDeposit" |
  "ConfigureFlashGovernanceProposal" |
  "SetAssetApprovalProposal" |
  "SetFateSpendersProposal" |
  "ToggleFlashGovernanceProposal" |
  "UpdateProposalConfigProposal"

export type contractNames =
  tokenNames
  | proposalNames
  | "Weth"
  | "UniswapV2Router"
  | "UniswapV2Factory"
  | "SushiswapV2Router"
  | "SushiswapV2Factory"
  | "Behodler"
  | "Multicall"
  | "Lachesis"
  | "AddressBalanceCheck"
  | "LiquidityReceiverV1"
  | "LiquidityReceiver"
  | "PyroWeth10Proxy"
  | "PowersRegistry"
  | "Angband"
  | "BigConstants"
  | "SeedBehodlerPower"
  | "ConfigureScarcityPower"
  | "PyroWethProxy"
  | "ProxyHandler"
  | "V2Migrator"
  | "LimboDAO"
  | "Limbo"
  | "ToggleWhitelistProposalProposal"
  | "MorgothTokenApprover"
  | "ProxyDeployer"
  | "AddressToString"
  | "TokenProxyRegistry"
  | "FlashGovernanceArbiter"
  // | "PyroFlanBooster"
  | "UniswapHelper"
  | "LimboOracle"
  | "LimboAddTokenToBehodler"
  | "UpdateMultipleSoulConfigProposal"
  | "ProposalFactory"
  | "DeployerSnufferCap"
  | "ConfigureTokenApproverPower"
  | "UpdateSoulConfigProposal"
  | "SoulReader"
  | "AddTokenAndValueToBehodlerPower" //deprecated: not through limbo
  | "RegisterPyroTokenV3Power"
  | "CrossingLib"
  | "MigrationLib"
  | "SoulLib"
  | "RefreshTokenOnBehodler"