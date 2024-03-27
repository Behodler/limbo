import { writeFileSync, existsSync, readFileSync } from "fs";
import {
  OutputAddress, AddressFileStructure, getPauser,
  nameNetwork, Sections, sectionName,
  fetchDeploymentRecipe, networks, recipeNames,
  broadcastFactory, ITokenConfig
} from "./common";
import { IDeploymentParams, sectionChooser, extractTokenConfig } from "./deploymentFunctions";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import hre from 'hardhat';
import '@nomiclabs/hardhat-ethers';
import path from 'path';

const nullAddress = "0x0000000000000000000000000000000000000000";
export interface ContractSet {
  protocol: OutputAddress,
  tokens: ITokenConfig[],
  chainId: number,
  primeAccount: string
}

export async function safeDeploy(
  recipeOfDeployment: recipeNames,
  chainId: number | undefined,
  confirmations: number,
  logger: (message: string) => void,
  persistPath?: string
): Promise<ContractSet> {
  const file = "/tmp/deploy.lock";
  if (!existsSync(file)) {
    writeFileSync(file, "unlocked");
  }
  const lockStatus = readFileSync(file, "utf8");
  logger("lock status is " + lockStatus);
  if (lockStatus === "locked") {
    logger("deployment locked");
    return {} as ContractSet;
  }
  writeFileSync(file, "locked");
  try {
    logger("about to deploy");
    const set = await deployToNetwork(recipeOfDeployment, chainId, confirmations, logger);
    if (persistPath)
      writeFileSync(persistPath, JSON.stringify(set.protocol, null, 2))
    return set
  } catch (error) {
    writeFileSync(file, "unlocked");
    throw error;
  } finally {
    writeFileSync(file, "unlocked");
  }
}

export async function deployToNetwork(
  recipeName: recipeNames,
  chainId: number | undefined,
  confirmations: number,
  logger: (message: string) => void
): Promise<ContractSet> {
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

  const recipe = fetchDeploymentRecipe(recipeName)

  const networkName = nameNetwork(chainId);
  const pauser = await getPauser(networkName, confirmations);
  const initialBalance = await deployer.getBalance()
  let loader = new Loader(networkName, logger, deployer, pauser, confirmations, recipeName)

  const iterations = recipe.length;
  logger('Sections: ' + iterations)
  for (let i = 0; i < iterations; i++) {
    const currentSection: Sections = recipe[i]
    logger(" ")
    logger("#######################################################")
    logger(sectionName(currentSection).toUpperCase() + ": ")
    logger("#######################################################")

    loader = await loader.loadOrDeploy(currentSection).catch(
      err => { throw err }
    )
    logger('finished section ' + sectionName(currentSection))
  }
  const finalBalance = await deployer.getBalance()
  logger('total eth consumed ' + initialBalance.sub(finalBalance).toString())
  logger("Deployments complete. Flattening...")
  const recipeToUseForTokenConfig = recipeName === "onlyPyroV3" ? [...fetchDeploymentRecipe("statusquo"), ...recipe] : recipe
  const tokenConfig = await loader.getTokenConfig(recipeToUseForTokenConfig)
  const flat = loader.flatten(tokenConfig.map(c => c.address))

  return {
    protocol: flat,
    tokens: tokenConfig,
    chainId,
    primeAccount: await deployer.address
  };
}

class Loader {
  network: networks
  existing: AddressFileStructure
  logger: (message: string) => void
  deployer: SignerWithAddress
  pauser: Function
  fileName: string = ""
  confirmations: number
  recipeName: recipeNames

  constructor(network: networks,
    logger: (message: string) => void,
    deployer: SignerWithAddress,
    pauser: Function,
    confirmations: number,
    recipeName: recipeNames) {
    this.recipeName = recipeName
    this.network = network;
    this.existing = {} as AddressFileStructure;
    this.logger = logger;
    this.deployer = deployer;
    this.pauser = pauser;
    this.populateExistingFromFile();
    this.confirmations = confirmations

  }

  flatten(excludedAddresses: string[]): OutputAddress {
    let flat: OutputAddress = {}
    let duplicate = (newKey: string, existing: OutputAddress): boolean => {
      let keys = Object.keys(existing)
      return keys.filter(k => k == newKey).length > 0
    }
    let sectionKeys = Object.keys(this.existing)
    for (let i = 0; i < sectionKeys.length; i++) {
      const sectionKey = sectionKeys[i]
      let contractKeys = Object.keys(this.existing[sectionKey])
      for (let j = 0; j < contractKeys.length; j++) {
        const contractKey = contractKeys[j]
        const address = this.existing[sectionKey][contractKey]
        if (excludedAddresses.find(a => a === address) !== undefined)
          continue;
        if (duplicate(contractKey, flat))
          throw `duplicate key found in flatten. New Key: ${contractKey}`
        flat[contractKey] = address
      }
    }
    return flat;
  }

  async getTokenConfig(recipe: Sections[]): Promise<ITokenConfig[]> {

    const existingKeys = Object.keys(this.existing)
    const pyroCapableSections: Sections[] = [Sections.LiquidityReceiverOld, Sections.LiquidityReceiverNew, Sections.BehodlerTokens, Sections.LimboTokens]

    const isPyroCapable = pyroCapableSections.every(s => recipe.includes(s))
    //Only produce a meaninful output if we actually have pyroTokens in our deployment recipe
    if (!isPyroCapable)
      return [] as ITokenConfig[]

    let params: IDeploymentParams = {
      deployer: this.deployer,
      existing: this.existing,
      logger: this.logger,
      broadcast: broadcastFactory(this.confirmations)
    }
    return await extractTokenConfig(params)
  }

  async loadOrDeploy(section: Sections): Promise<Loader> {
    const existingKeys = Object.keys(this.existing)
    const message = `Section ${sectionName(section)} `
    for (let i = 0; i < existingKeys.length; i++) {
      if (existingKeys[i] === sectionName(section)) {
        this.logger(`${message}already deployed. Skipping deployment...`)
        return this
      }
    }

    this.logger(`${message}not found. Deploying...`)
    let deploymentFunction = sectionChooser(section)

    let params: IDeploymentParams = {
      deployer: this.deployer,
      existing: this.existing,
      logger: this.logger,
      broadcast: broadcastFactory(this.confirmations)
    }

    let outputAddresses = await deploymentFunction(params)

    let newExisting: AddressFileStructure = { ...this.existing }
    newExisting[sectionName(section)] = outputAddresses
    this.logger(`persisting deployments for ${sectionName(section)} to ${this.fileName}`)
    let json = JSON.stringify(newExisting, null, 2)
    writeFileSync(this.fileName, json)

    return new Loader(
      this.network,
      this.logger,
      this.deployer,
      this.pauser,
      this.confirmations,
      this.recipeName)
  }

  private async populateExistingFromFile() {
    this.logger('in populate')
    this.fileName = path.resolve(__dirname, `./addresses/${this.network}.${this.recipeName}.json`);
    const foundFile = existsSync(this.fileName);
    if (foundFile) {
      const blob = readFileSync(this.fileName);
      this.logger('about to parse')
      this.existing = JSON.parse(blob.toString()) as AddressFileStructure;
      this.logger('parsed')
    }
  }
}


const ethers = hre.ethers
