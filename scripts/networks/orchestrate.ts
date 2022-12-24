import { writeFileSync, existsSync, readFileSync } from "fs";
import { OutputAddress, AddressFileStructure, logFactory, getPauser, nameNetwork, Sections, sectionName, SectionsToList } from "./common";
import { IDeploymentParams, sectionChooser } from "./deploymentFunctions";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
const hre = require("hardhat");

const nullAddress = "0x0000000000000000000000000000000000000000";
const logger = logFactory(true);

export async function safeDeploy(
  chainId: number | undefined,
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
    return deployTestnet(chainId, blockTime, confirmations);
  } catch (error) {
    throw error;
  } finally {
    writeFileSync(file, "unlocked");
  }
}

export async function deployTestnet(
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
    logger(sectionName(currentSection) + ": ")
    loader = await loader.loadOrDeploy(currentSection).catch(
      err => { throw err }
    )
    logger('finished section ' + sectionName(currentSection))
  }

  const flat = loader.flatten()
  logger(JSON.stringify(flat, null, 4))
  return flat;
}


class Loader {
  network: string
  existing: AddressFileStructure
  logger: (message: string) => void
  deployer: SignerWithAddress
  pauser: Function
  fileName: string = ""

  constructor(network: string,
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
    let sectionKeys = Object.keys(this.existing)
    for (const sectionKey in sectionKeys) {
      let contractKeys = Object.keys(sectionKeys[sectionKey])
      for (const contractKey in contractKeys) {
        let flatKeys = Object.keys(flat)
        for (const flatKey in flatKeys) {
          if (contractKey == flatKey)
            throw `duplicate contract key found <${contractKey}> when traversing ${sectionKey}`
        }
        flat[contractKey] = contractKeys[contractKey]
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

    if (JSON.stringify(outputAddresses) != '{}') {
      let newExisting: AddressFileStructure = { ...this.existing }
      newExisting[sectionName(section)] = outputAddresses
      this.logger(`persisting deployments for ${sectionName(section)} to ${this.fileName}`)
      let json = JSON.stringify(newExisting, null, 2)
      writeFileSync(this.fileName, json)
    }

    return new Loader(
      this.network,
      this.logger,
      this.deployer,
      this.pauser)
  }

  private async populateExistingFromFile() {
    logger('in populate')
    this.fileName = `${process.cwd()}/scripts/networks/addresses/${this.network}.json`;
    const timeStamp = new Date().toUTCString()
    const backupFilenName = this.fileName.substring(0, this.fileName.length - 5) + timeStamp + ".backup"

    const foundFile = existsSync(this.fileName);
    if (foundFile) {
      const blob = readFileSync(this.fileName);
      writeFileSync(backupFilenName, blob)
      logger('about to parse')
      this.existing = JSON.parse(blob.toString()) as AddressFileStructure;
      logger('parsed')
    }
  }
}


const ethers = hre.ethers