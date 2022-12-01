import { writeFileSync, existsSync, readFileSync } from "fs";
import * as deployments from "./deploymentFunctions";
import { OutputAddress, AddressFileStructure, logFactory, getPauser, nameNetwork } from "./common";
const hre = require("hardhat");

const nullAddress = "0x0000000000000000000000000000000000000000";
const logger = logFactory(true);

export async function safeDeploy(
  chainId: number | undefined,
  persist: boolean,
  blockTime: number,
  confirmations: number
): Promise<OutputAddress> {
  const file = "/tmp/deploy.lock";
  if (!existsSync(file)) {
    writeFileSync(file, "unlocked");
  }
  const lockStatus = readFileSync(file, "utf8");
  logger("lock status is " + lockStatus);
  if (lockStatus === "locked") {
    logger("deployment locked");
    return {};
  }
  writeFileSync(file, "locked");
  try {
    logger("about to deploy");
    return deployTestnet(chainId, persist, blockTime, confirmations);
  } catch (error) {
    throw error;
  } finally {
    writeFileSync(file, "unlocked");
  }
}

export async function deployTestnet(
  chainId: number | undefined,
  persist: boolean,
  blockTime: number,
  confirmations: number,
  nonce?: number
): Promise<OutputAddress> {
  /*
    Steps:
    1. load addresses for group by testnet id. 
        1.1 If missing or empty, load deployment script and run
        1.2 else loop back to 1.
    2. combine all addresses into one object
    3. print object to root with filename == network name;
    */

  const [deployer] = await ethers.getSigners();
  if (!chainId) {
    throw "unknown chain";
  }

  const networkName = nameNetwork(chainId);
  const pauser = await getPauser(blockTime, networkName, confirmations);
  const recognizedTestNet = networkName !== "hardhat";

  const networkLoader = (network: string, persist: boolean) => (domain: string, existing: AddressFileStructure) =>
    loadAddresses(network, domain, existing, persist);
  const addressLoader = networkLoader(networkName, persist);

  const domainUpdater =
    (network: string, persist: boolean) =>
      (domain: string, newAddresses: OutputAddress, existing: AddressFileStructure) =>
        updateDomain(network, domain, newAddresses, existing, persist);
  const updater = domainUpdater(networkName, persist);
  let existing: AddressFileStructure = {};


  let loaded = addressLoader("deployBehodler", existing);
  let behodler = loaded.result;
  existing = loaded.existing;

  if (!behodler) {
    behodler = await deployments.deployBehodler(deployer, pauser);
    updater("deployBehodler", behodler, existing);
  }

  loaded = addressLoader("deployTokens", existing);
  let tokens = loaded.result;
  existing = loaded.existing;

  if (!tokens) {
    tokens = await deployments.deployTokens(deployer, pauser);
  }
  tokens["SCX"] = behodler["behodler"];
  updater("deployTokens", tokens, existing);

  loaded = addressLoader("deployLiquidityReceiver", existing);
  let liquidityReceiverAddresses = loaded.result;
  existing = loaded.existing;
  logger("existing liquidity receiver");
  logger(JSON.stringify(liquidityReceiverAddresses, null, 2));

  if (!liquidityReceiverAddresses) {
    liquidityReceiverAddresses = await deployments.deployLiquidityReceiver(
      deployer,
      tokens,
      behodler["addressBalanceCheck"],
      pauser
    );
    logger("lachesis address right after deployLiquidityReceiver " + liquidityReceiverAddresses["lachesis"]);
    updater("deployLiquidityReceiver", liquidityReceiverAddresses, existing);
  }
  logger("lachesis address in orchestrate " + liquidityReceiverAddresses["lachesis"]);

  loaded = addressLoader("deployWeth", existing);
  let wethAddresses = loaded.result;
  existing = loaded.existing;

  if (!wethAddresses) {
    wethAddresses = await deployments.deployWeth(
      deployer,
      liquidityReceiverAddresses["liquidityReceiver"],
      liquidityReceiverAddresses["lachesis"],
      pauser
    );
    updater("deployWeth", wethAddresses, existing);
  }
  logger("lachesis in orchestrate: " + liquidityReceiverAddresses["lachesis"]);
  tokens["WETH"] = wethAddresses["WETH"];
  updater("deployTokens", tokens, existing);
  await deployments.mintOnBehodler(
    deployer,
    tokens,
    behodler["addressBalanceCheck"],
    liquidityReceiverAddresses["lachesis"],
    pauser
  );
  logger("behodler minting complete");

  loaded = addressLoader("deployUniswap", existing);
  let uniswapAddresses = loaded.result;
  existing = loaded.existing;

  if (!uniswapAddresses) {
    uniswapAddresses = await deployments.deployUniswap(deployer, tokens, recognizedTestNet, pauser);
    updater("deployUniswap", uniswapAddresses, existing);
  }

  loaded = addressLoader("deploySushiswap", existing);
  let sushiAddresses = loaded.result;
  existing = loaded.existing;
  if (!sushiAddresses) {
    logger("About to deploy sushi swap");
    sushiAddresses = await deployments.deploySushiswap(deployer, tokens, recognizedTestNet, pauser);
    updater("deploySushiswap", sushiAddresses, existing);
  }
  logger(JSON.stringify(tokens, null, 4));
  await deployments.seedUniswap(
    deployer,
    tokens["EYE"],
    tokens["DAI"],
    tokens["SCX"],
    wethAddresses["WETH"],
    uniswapAddresses["EYEDAI"],
    uniswapAddresses["SCXWETH"],
    uniswapAddresses["EYESCX"],
    pauser
  );

  await deployments.seedUniswap(
    deployer,
    tokens["EYE"],
    tokens["DAI"],
    tokens["SCX"],
    wethAddresses["WETH"],
    sushiAddresses["EYEDAISLP"],
    sushiAddresses["SCXWETHSLP"],
    sushiAddresses["EYESCXSLP"],
    pauser
  );

  loaded = addressLoader("deployLimboDAO", existing);
  let limboDaoAddresses = loaded.result;
  existing = loaded.existing;

  if (!limboDaoAddresses) {
    limboDaoAddresses = await deployments.deployLimboDAO(deployer, tokens["EYE"], pauser);
    updater("deployLimboDAO", limboDaoAddresses, existing);
  }

  loaded = addressLoader("deployFlan", existing);
  let flanAddresses = loaded.result;
  existing = loaded.existing;

  if (!flanAddresses) {
    flanAddresses = await deployments.deployFlan(
      deployer,
      limboDaoAddresses["dao"],
      liquidityReceiverAddresses["lachesis"],
      tokens["SCX"],
      uniswapAddresses["uniswapFactory"],
      liquidityReceiverAddresses["liquidityReceiver"],
      behodler["addressBalanceCheck"],
      limboDaoAddresses["safeERC20"],
      pauser
    );
    updater("deployFlan", flanAddresses, existing);
  }

  loaded = addressLoader("deployLimbo", existing);
  let limboAddresses = loaded.result;
  existing = loaded.existing;

  if (!limboAddresses) {
    limboAddresses = await deployments.deployLimbo(deployer,
      flanAddresses["FLAN"],
      tokens["DAI"],
      tokens["SCX"],
      limboDaoAddresses["dao"],
      uniswapAddresses["uniswapRouter"],
      chainId,
      pauser
    );
    updater("deployLimbo", limboAddresses, existing);
  }

  let limboLibraries: string[] = [];
  limboLibraries.push(limboAddresses["soulLib"]);
  limboLibraries.push(limboAddresses["crossingLib"]);
  limboLibraries.push(limboAddresses["migrationLib"]);
  logger("limboLibraries" + JSON.stringify(limboLibraries, null, 2));

  loaded = addressLoader("deployProposalFactory", existing);
  let proposalFactoryAddresses = loaded.result;
  existing = loaded.existing;

  if (!proposalFactoryAddresses) {
    proposalFactoryAddresses = await deployments.deployProposalFactory(
      deployer,
      limboDaoAddresses["dao"],
      limboAddresses["limbo"],
      limboAddresses["uniswapHelper"],
      limboDaoAddresses["safeERC20"],
      limboLibraries,
      pauser
    );
    updater("deployProposalFactory", proposalFactoryAddresses, existing);
  }

  logger("Seeding DAO");
  await deployments.seedLimboDAO(
    limboDaoAddresses["dao"],
    limboAddresses["limbo"],
    flanAddresses["FLAN"],
    tokens["EYE"],
    proposalFactoryAddresses["proposalFactory"],
    limboAddresses["uniswapOracle"],
    [uniswapAddresses["EYEDAI"], uniswapAddresses["EYESCX"]],
    pauser
  );

  loaded = addressLoader("deployMorgothDAO", existing);
  let morgothDAOAddresses = loaded.result;
  existing = loaded.existing;

  if (!morgothDAOAddresses) {
    morgothDAOAddresses = await deployments.deployMorgothDAO(
      deployer,
      liquidityReceiverAddresses["lachesis"],
      tokens["SCX"],
      behodler["addressBalanceCheck"],
      limboAddresses["limbo"],
      limboLibraries,
      pauser
    );
    updater("deployMorgothDAO", morgothDAOAddresses, existing);
  }

  await deployments.configureLimboCrossingConfig(
    limboAddresses["limbo"],
    tokens["SCX"],
    morgothDAOAddresses["angband"],
    limboAddresses["uniswapHelper"],
    morgothDAOAddresses["limboAddTokenToBehodlerPower"],
    500,
    300,
    100,
    limboLibraries,
    pauser
  );

  loaded = addressLoader("deploySoulReader", existing);
  let soulReaderAddress = loaded.result;
  existing = loaded.existing;

  if (!soulReaderAddress) {
    soulReaderAddress = await deployments.deploySoulReader(pauser);
    updater("deploySoulReader", soulReaderAddress, existing);
  }

  loaded = addressLoader("deployMultiCall", existing);
  let multicallAddress = loaded.result;
  existing = loaded.existing;

  if (!multicallAddress) {
    multicallAddress = await deployments.deployMultiCall(pauser);
    updater("deployMultiCall", multicallAddress, existing);
  }

  loaded = addressLoader("TestTokens", existing);
  let testTokens = loaded.result;
  existing = loaded.existing;

  if (!testTokens && !persist) {
    testTokens = await deployments.deployFakeTokens(pauser);
    updater("TestTokens", testTokens, existing);
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

  if (!persist) {
    for (const key in testTokens) {
      flatOutput[key] = testTokens[key];
    }
  }

  const flatString = JSON.stringify(flatOutput, null, 2);
  if (persist) {
    writeFileSync(`./${networkName}.json`, JSON.stringify(flatOutput, null, 2));
  } else {
    logger(flatString);
  }
  logger("successfully deployed Limbo and test versions of Behodler and MorgothDAO")
  return flatOutput;
}

function updateDomain(
  networkName: string,
  domain: string,
  newAddresses: OutputAddress,
  existing: AddressFileStructure,
  persist: boolean
) {
  const fileName = `${process.cwd()}/scripts/testnet/addresses/${networkName}.json`;

  if (persist && existsSync(fileName)) {
    const blob = readFileSync(fileName);
    existing = JSON.parse(blob.toString()) as AddressFileStructure;
  }
  const domainKeys = Object.keys(existing);
  if (domainKeys.includes(domain)) {
    existing[domain] = newAddresses;
  } else {
    existing[domain] = newAddresses;
  }

  if (persist) {
    logger("about to write out domain");
    writeFileSync(fileName, JSON.stringify(existing, null, 2));
  }
  return existing;
}

interface LoadStructure {
  result: OutputAddress | null;
  existing: AddressFileStructure;
}

function loadAddresses(
  networkName: string,
  domain: string,
  existing: AddressFileStructure,
  persist: boolean
): LoadStructure {
  const fileName = `${process.cwd()}/scripts/networks/addresses/${networkName}.json`;
  const timeStamp = new Date().toUTCString()
  const backupFilenName = fileName.substring(0, fileName.length - 5) + timeStamp + ".backup"

  const foundFile = existsSync(fileName);
  if (persist) {
    logger("persist is true");
    if (foundFile) {
      const blob = readFileSync(fileName);
      writeFileSync(backupFilenName, blob)
      existing = JSON.parse(blob.toString()) as AddressFileStructure;
    } else {
      logger("address file not found");
    }
  } else logger("persist is false");

  logger("domainKeys at " + domain + " " + JSON.stringify(Object.keys(existing), null, 2));
  logger(" ");
  const domainKeys = Object.keys(existing);
  if (domainKeys.includes(domain)) {
    logger("found " + domain);
    return { result: existing[domain], existing };
  } else {
    logger(domain + " not found. Deploying...");
    return { result: null, existing };
  }
}


const ethers = hre.ethers;