import { ethers, network } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { Contract, ContractFactory } from "ethers";
import * as Web3 from 'web3'
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

function pauserFactory(duration: number, network: string, confirmations: number) {
  const networkToUse = network == "hardhat" ? "localhost" : network;
  let provider = ethers.provider; //ethers.getDefaultProvider(networkToUse);

  return async function () {
    const initialBlock = await provider.getBlockNumber();

    let currentBlock = await provider.getBlockNumber();

    while (currentBlock - initialBlock < confirmations) {
      //logger(`current block ${currentBlock}, initial block ${initialBlock}`);
      const remaining = confirmations - (currentBlock - initialBlock);
      //  logger(`${remaining} blocks remaining. Pausing for ${duration / 1000} seconds`);
      // logger("                                                       ");
      await pause(duration);
      const current = await provider.getBlockNumber();
      //logger("new current block " + current);
      currentBlock = current;
    }
  };
}

export function getPauser(blockTime: number, network: string, confirmations: number) {
  return pauserFactory(blockTime, network, confirmations);
}

function pause(duration: number) {
  return new Promise(function (resolve, error) {
    setTimeout(() => {
      return resolve(duration);
    }, duration);
  });
}

export async function broadcast(name: string, transaction: Promise<any>, pauser: Function) {
  logger("*****************TX:  " + name + "*****************");
  logger("                                                         ");
  const result = await transaction;
  await pauser();
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

    gasArgs.push(await getNonce());
    logger('args ' + JSON.stringify(gasArgs))
    let existingAddress: string | undefined = undefined
    if (sectionAddresses && sectionAddresses[name]) {
      existingAddress = sectionAddresses[name]
    }

    let contract: T
    logger('deploy tx for ' + name)
    if (existingAddress && isContractAddress(existingAddress)) {
      contract = await factory.attach(existingAddress) as T
    } else if (customDeploymentCode) {
      logger('      deploy tx: custom')
      contract = await customDeploymentCode() as T
      logger('      custom address ' + contract.address)
    }
    else {
      logger('      deploy tx: standard')
      contract = await factory.deploy(...gasArgs) as T;
    }
    logger('     ----->deployment complete')
    try {
      let real = await (contract as any).REAL()
      if (!real)
        throw "Test Contract detected."
    } catch { }
    logger("pausing for deployment of " + name + " at " + new Date().toTimeString());
    await pauser();
    //await contract.deployed();
    return contract;
  }
}
export const stringToBytes32 = (s: string): string => {
  let padded = s.padEnd(32, "\0")
  return ethers.utils.hexlify(ethers.utils.arrayify(Web3.default.utils.fromAscii(padded)))
}

export function nameNetwork(networkId: number): string {
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
  BigConstants,
  LiquidityReceiverNew,
  BehodlerSeedNew,
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
  FlanSetMintConfig,
  PyroFlanBooster,
  Limbo,
  UniswapHelper,
  LimboOracle,
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
  MorgothTokenApproverUpdateConfig,
  MorgothMapApprover,
  ConfigureTokenApproverPower, // white list on angband
  TPR_setApprover_setPower,
  LimboDAOProposals, //white list
  FlashgovSetAllToGovernable,
  EndConfigForAll,
  MorgothLimboMinionAndPower,
  MorgothMapLimboDAO//end config and makeLive first
}

export const SectionsToList: Sections[] = [
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
  Sections.ConfigureIronCrown,
  Sections.MorgothMapLiquidityReceiver,
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
  Sections.FlanSetMintConfig,
  Sections.PyroFlanBooster,
  Sections.Limbo,
  Sections.UniswapHelper,
  Sections.LimboOracle,
  Sections.Morgoth_LimboAddTokenToBehodler,
  Sections.MultiSoulConfigUpdateProposal,
  Sections.ProposalFactory,
  Sections.DeployerSnufferCap,
  Sections.SnuffPyroWethProxy,
  Sections.UniswapHelperConfigure,
  Sections.LimboTokens,
  Sections.LimboDAOSeed,
  Sections.LimboConfigureCrossingConfig,
  Sections.MorgothTokenApproverUpdateConfig,
  Sections.MorgothMapApprover,
  Sections.ConfigureTokenApproverPower,
  Sections.TPR_setApprover_setPower,
  Sections.LimboDAOProposals,
  Sections.FlashgovSetAllToGovernable,
  Sections.EndConfigForAll,
  Sections.MorgothLimboMinionAndPower,
  Sections.MorgothMapLimboDAO
]

//TODO: broken
export const sectionName = (section: Sections): string => Sections[section]

export type contractNames =
  "Weth"
  | "UniswapV2Router"
  | "UniswapV2Factory"
  | "SushiswapV2Router"
  | "SushiswapV2Factory"
  | "Behodler"
  | "Multicall"
  | "Lachesis"
  | "AddressBalanceCheck"
  | "EYE"
  | "MKR"
  | "OXT"
  | "PNK"
  | "LNK"
  | "LOOM"
  | "DAI"
  | "WEIDAI"
  | "EYE_DAI"
  | "SCX_ETH"
  | "SCX_EYE"
  | "LiquidityReceiverV1"
  | "LiquidityReceiver"
  | "PyroWeth10Proxy"
  | "PowersRegistry"
  | "Angband"
  | "BigConstants"
  | "SeedBehodlerPower"
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
  | "Flan"
  | "PyroFlanBooster"
  | "UniswapHelper"
  | "LimboOracle"
  | "LimboAddTokenToBehodler"
  | "UpdateMultipleSoulConfigProposal"
  | "ProposalFactory"
  | "DeployerSnufferCap"
  | "Aave" | "Curve" | "Convex" | "MIM" | "Uni" | "WBTC" | "Sushi"
  | "ConfigureTokenApproverPower"
  | "UpdateSoulConfigProposal"
  | "SoulReader"
  | "AddTokenAndValueToBehodlerPower" //deprecated: not through limbo
  | "RegisterPyroTokenV3Power"
  | "CrossingLib"
  | "MigrationLib"
  | "SoulLib"