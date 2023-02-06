import { writeFileSync, existsSync, readFileSync } from "fs";
import { OutputAddress, AddressFileStructure, logFactory, getPauser, nameNetwork, Sections, sectionName, SectionsToList, OutputAddressAdder, networks } from "./common";
import { IDeploymentParams, sectionChooser } from "./deploymentFunctions";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import hre from 'hardhat'
import '@nomiclabs/hardhat-ethers'
import path from 'path'

const nullAddress = "0x0000000000000000000000000000000000000000";
const logger = logFactory(true);

export async function safeDeploy(
  chainId: number | undefined,
  blockTime: number,
  confirmations: number,
  persistPath?: string
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
    const addresses = deployToNetwork(chainId, blockTime, confirmations);
    if (persistPath)
      writeFileSync(persistPath, JSON.stringify(addresses, null, 2))
    return addresses
  } catch (error) {
    throw error;
  } finally {
    writeFileSync(file, "unlocked");
  }
}

export async function deployToNetwork(
  chainId: number | undefined,
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

  let loader = new Loader(networkName, logger, deployer, pauser)

  const iterations = SectionsToList.length;
  for (let i = 0; i < iterations; i++) {
    const currentSection: Sections = SectionsToList[i]
    logger(" ")
    logger("#######################################################")
    logger(sectionName(currentSection).toUpperCase() + ": ")
    logger("#######################################################")

    loader = await loader.loadOrDeploy(currentSection).catch(
      err => { throw err }
    )
    logger('finished section ' + sectionName(currentSection))
  }

  logger("Deployments complete. Flattening...")
  const flat = loader.flatten()
  return flat;
}

class Loader {
  network: networks
  existing: AddressFileStructure
  logger: (message: string) => void
  deployer: SignerWithAddress
  pauser: Function
  fileName: string = ""

  constructor(network: networks,
    logger: (message: string) => void,
    deployer: SignerWithAddress,
    pauser: Function) {
    this.network = network;
    this.existing = {} as AddressFileStructure;
    this.logger = logger;
    this.deployer = deployer;
    this.pauser = pauser;
    this.populateExistingFromFile();
  }

  flatten(): OutputAddress {
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
        if (duplicate(contractKey, flat))
          throw `duplicate key found in flatten. New Key: ${contractKey}`
        flat[contractKey] = this.existing[sectionKey][contractKey]
      }
    }
    return flat;
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

    logger(`${message}not found. Deploying...`)
    let deploymentFunction = sectionChooser(section)

    let params: IDeploymentParams = {
      deployer: this.deployer,
      existing: this.existing,
      pauser: this.pauser
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
      this.pauser)
  }

  private async populateExistingFromFile() {
    logger('in populate')
    this.fileName = path.resolve(__dirname, `./addresses/${this.network}.json`);
    const foundFile = existsSync(this.fileName);
    if (foundFile) {
      const blob = readFileSync(this.fileName);
      logger('about to parse')
      this.existing = JSON.parse(blob.toString()) as AddressFileStructure;
      logger('parsed')
    }
  }
}


const ethers = hre.ethers
