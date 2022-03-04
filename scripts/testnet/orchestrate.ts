import { parseEther } from "ethers/lib/utils";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { BigNumber, Contract, ContractFactory } from "ethers";
import { fstat, write, writeFileSync, existsSync, readFileSync } from "fs";
import * as deployments from "./deploymentFunctions";
import { OutputAddress, AddressFileStructure } from "./common";
const hre = require("hardhat");

const nullAddress = "0x0000000000000000000000000000000000000000";

async function main() {
  /*
    Steps:
    1. load addresses for group by testnet id. 
        1.1 If missing or empty, load deployment script and run
        1.2 else loop back to 1.
    2. combine all addresses into one object
    3. print object to root with filename == network name;
    */
  const [deployer] = await ethers.getSigners();
  const chainId = (await deployer.provider?.getNetwork())?.chainId;
  if (!chainId) {
    throw "unknown chain";
  }

  const networkName = nameNetwork(chainId);
  const recognizedTestNet = networkName !== "hardhat";
  const networkLoader = (network: string) => (domain: string) => loadAddresses(network, domain);
  const addressLoader = networkLoader(networkName);
  const domainUpdater = (network: string) => (domain: string, newAddresses: OutputAddress) =>
    updateDomain(network, domain, newAddresses);
  const updater = domainUpdater(networkName);

  let behodler = addressLoader("deployBehodler");
  if (!behodler) {
    behodler = await deployments.deployBehodler(deployer);
    updater("deployBehodler", behodler);
  }
  let tokens = addressLoader("deployTokens");
  if (!tokens) {
    tokens = await deployments.deployTokens(deployer);
  }
  tokens["SCX"] = behodler["behodler"];
  updater("deployTokens", tokens);

  let liquidityReceiverAddresses = addressLoader("deployLiquidityReceiver");
  if (!liquidityReceiverAddresses) {
    liquidityReceiverAddresses = await deployments.deployLiquidityReceiver(
      deployer,
      tokens,
    );
    updater("deployLiquidityReceiver", liquidityReceiverAddresses);
  }

  let wethAddresses = addressLoader("deployWeth");
  if (!wethAddresses) {
    wethAddresses = await deployments.deployWeth(
      deployer,
      liquidityReceiverAddresses["liquidityReceiver"],
      liquidityReceiverAddresses["lachesis"]
    );
    updater("deployWeth", wethAddresses);
  }
  tokens["WETH"] = wethAddresses["WETH"];
  updater("deployTokens", tokens);
  await deployments.mintOnBehodler(
    deployer,
    tokens,
    behodler["addressBalanceCheck"],
    liquidityReceiverAddresses["lachesis"]
  );

  let uniswapAddresses = addressLoader("deployUniswap");
  if (!uniswapAddresses) {
    uniswapAddresses = await deployments.deployUniswap(deployer, tokens, recognizedTestNet);
    updater("deployUniswap", uniswapAddresses);
  }

  let sushiAddresses = addressLoader("deploySushiswap");
  if (!sushiAddresses) {
    sushiAddresses = await deployments.deploySushiswap(deployer, tokens, recognizedTestNet);
    updater("deploySushiswap", sushiAddresses);
  }

  await deployments.seedUniswap(
    deployer,
    tokens["EYE"],
    tokens["DAI"],
    tokens["SCX"],
    wethAddresses["WETH"],
    uniswapAddresses["EYEDAI"],
    uniswapAddresses["SCXWETH"],
    uniswapAddresses["EYESCX"]
  );

  await deployments.seedUniswap(
    deployer,
    tokens["EYE"],
    tokens["DAI"],
    tokens["SCX"],
    wethAddresses["WETH"],
    sushiAddresses["EYEDAISLP"],
    sushiAddresses["SCXWETHSLP"],
    sushiAddresses["EYESCXSLP"]
  );

  let limboDaoAddresses = addressLoader("deployLimboDAO");
  if (!limboDaoAddresses) {
    limboDaoAddresses = await deployments.deployLimboDAO(deployer, tokens["EYE"]);
    updater("deployLimboDAO", limboDaoAddresses);
  }

  let flanAddresses = addressLoader("deployFlan");
  if (!flanAddresses) {
    flanAddresses = await deployments.deployFlan(
      deployer,
      limboDaoAddresses["dao"],
      liquidityReceiverAddresses["lachesis"],
      tokens["SCX"],
      uniswapAddresses["uniswapFactory"],
      liquidityReceiverAddresses["liquidityReceiver"],
      behodler["addressBalanceCheck"],
      limboDaoAddresses["transferHelper"]
    );
    updater("deployFlan", flanAddresses);
  }

  let limboAddresses = addressLoader("deployLimbo");
  if (!limboAddresses) {
    limboAddresses = await deployments.deployLimbo(
      deployer,
      flanAddresses["FLAN"],
      flanAddresses["flanSCX"],
      tokens["DAI"],
      tokens["SCX"],
      limboDaoAddresses["dao"],
      limboDaoAddresses["transferHelper"]
    );
    updater("deployLimbo", limboAddresses);
  }
  
  

  let limboLibraries: string[] = [];
  limboLibraries.push(limboAddresses["soulLib"]);
  limboLibraries.push(limboAddresses["crossingLib"]);
  limboLibraries.push(limboAddresses["migrationLib"]);
  console.log("limboLibraries" + JSON.stringify(limboLibraries, null, 2));

  let proposalFactoryAddresses = addressLoader("deployProposalFactory");
  if (!proposalFactoryAddresses) {
    proposalFactoryAddresses = await deployments.deployProposalFactory(
      deployer,
      limboDaoAddresses["dao"],
      limboAddresses["limbo"],
      limboAddresses["uniswapHelper"],
      limboDaoAddresses["transferHelper"],
      limboLibraries
    );
    updater("deployProposalFactory", proposalFactoryAddresses);
  }

  console.log("Seeding DAO");
  await deployments.seedLimboDAO(
    limboDaoAddresses["dao"],
    limboAddresses["limbo"],
    flanAddresses["FLAN"],
    tokens["EYE"],
    proposalFactoryAddresses["proposalFactory"],
    uniswapAddresses["uniswapFactory"],
    [uniswapAddresses["EYEDAI"], uniswapAddresses["EYESCX"]],
    limboDaoAddresses["transferHelper"]
  );

  let morgothDAOAddresses = addressLoader("deployMorgothDAO");
  if (!morgothDAOAddresses) {
    morgothDAOAddresses = await deployments.deployMorgothDAO(
      deployer,
      liquidityReceiverAddresses["lachesis"],
      tokens["SCX"],
      behodler["addressBalanceCheck"],
      limboAddresses["limbo"],
      limboLibraries
    );
    updater("deployMorgothDAO", morgothDAOAddresses);
  }

  await deployments.configureLimboCrossingConfig(
    limboAddresses["limbo"],
    tokens["SCX"],
    morgothDAOAddresses["angband"],
    limboAddresses["uniswapHelper"],
    morgothDAOAddresses["limboAddTokenToBehodlerPower"],
    500,
    300,
    0,
    limboLibraries
  );

  let soulReaderAddress = addressLoader("deploySoulReader");
  if (!soulReaderAddress) {
    soulReaderAddress = await deployments.deploySoulReader();
    updater("deploySoulReader", soulReaderAddress);
  }

  let multicallAddress = addressLoader("deployMultiCall");
  if (!multicallAddress) {
    multicallAddress = await deployments.deployMultiCall();
    updater("deployMultiCall", multicallAddress);
  }

  const flatOutput: OutputAddress = {};

  for (const key in behodler) {
    flatOutput[key] = behodler[key];
  }
  for (const key in tokens) {
    flatOutput[key] = tokens[key];
  }

  for (const key in liquidityReceiverAddresses) {
    flatOutput[key] = liquidityReceiverAddresses[key];
  }

  for (const key in wethAddresses) {
    flatOutput[key] = wethAddresses[key];
  }

  for (const key in uniswapAddresses) {
    flatOutput[key] = uniswapAddresses[key];
  }

  for (const key in sushiAddresses) {
    flatOutput[key] = sushiAddresses[key];
  }

  for (const key in limboDaoAddresses) {
    flatOutput[key] = limboDaoAddresses[key];
  }

  for (const key in flanAddresses) {
    flatOutput[key] = flanAddresses[key];
  }

  for (const key in limboAddresses) {
    flatOutput[key] = limboAddresses[key];
  }

  for (const key in proposalFactoryAddresses) {
    flatOutput[key] = proposalFactoryAddresses[key];
  }

  for (const key in morgothDAOAddresses) {
    flatOutput[key] = morgothDAOAddresses[key];
  }

  for (const key in soulReaderAddress) {
    flatOutput[key] = soulReaderAddress[key];
  }

  for (const key in multicallAddress) {
    flatOutput[key] = multicallAddress[key];
  }

  writeFileSync(`./${networkName}.json`, JSON.stringify(flatOutput, null, 2));
}

function updateDomain(networkName: string, domain: string, newAddresses: OutputAddress) {
  const fileName = `${process.cwd()}/scripts/testnet/addresses/${networkName}.json`;
  if (existsSync(fileName)) {
    const blob = readFileSync(fileName);
    const structured: AddressFileStructure = JSON.parse(blob.toString());
    const domainKeys = Object.keys(structured);
    if (domainKeys.includes(domain)) {
      structured[domain] = newAddresses;
    } else {
      structured[domain] = newAddresses;
    }
    writeFileSync(fileName, JSON.stringify(structured, null, 2));
  } else {
    const structured: AddressFileStructure = {};
    structured[domain] = newAddresses;
    writeFileSync(fileName, JSON.stringify(structured, null, 2));
  }
}

function loadAddresses(networkName: string, domain: string): OutputAddress | null {
  const fileName = `${process.cwd()}/scripts/testnet/addresses/${networkName}.json`;

  if (existsSync(fileName)) {
    const blob = readFileSync(fileName);
    const structured: AddressFileStructure = JSON.parse(blob.toString());
    const domainKeys = Object.keys(structured);
    if (domainKeys.includes(domain)) {
      console.log("found " + domain);
      return structured[domain];
    }
  } else console.log("address file not found");
  console.log(domain + " not found. Deploying...");
  return null;
}

function nameNetwork(networkId: number) {
  switch (networkId) {
    case 1337:
      return "hardhat";
    case 3:
      return "ropsten";
    case 42:
      return "kovan";
    default:
      throw "unknown network";
  }
}

const ethers = hre.ethers;
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
