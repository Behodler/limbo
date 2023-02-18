
const { expect } = require("chai");
import { parseEther } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { safeDeploy } from "../../scripts/networks/orchestrate";
import { broadcast, contractNames, getPauser, stringToBytes32 } from "../../scripts/networks/common"
import * as networkHelpers from "@nomicfoundation/hardhat-network-helpers";
import * as Types from "../../typechain"
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import shell from "shelljs"
import { existsSync } from "fs";
import { BigNumber, Contract } from "ethers";
import { deploy } from "../helpers";
import * as hre from "hardhat"
const web3 = require("web3");
interface DeployedContracts {
  [name: string]: string;
}
let logFactory = (show: boolean) => {
  return (message: string, content?: any) => {
    if (show)
      console.log(`In test: ${message} ${content || ''}`)
  }
}
describe("pyroV3 addition to mainnet", function () {

  let logger = logFactory(true)
  if (existsSync("scripts/networks/addresses/hardhat.json"))
    shell.rm("scripts/networks/addresses/hardhat.json")

  async function deployStatusQuo() {
    const [owner, secondPerson] = await ethers.getSigners();
    const addresses = (await safeDeploy("statusquo",1337, 2, 9)) as DeployedContracts;
    const fetchAddressFactory = (addresses: DeployedContracts) =>
      (name: contractNames) => addresses[name]
    const fetchAddress = fetchAddressFactory(addresses)
    logger('addresses', JSON.stringify(addresses, null, 4))
    const pauser = await getPauser(2, "hardhat", 9);
    const getContractFactory = (fetchAddress: (name: contractNames) => string) => {

      return async<T extends Contract>(contractName: contractNames, factoryName?: string, libraries?: ethersLib) => {

        let loadName = factoryName || contractName
        let factory = await (
          libraries ? ethers.getContractFactory(loadName, {
            libraries
          }) : ethers.getContractFactory(loadName))

        return factory.attach(fetchAddress(contractName)) as T;
      }
    }
    const getContract = getContractFactory(fetchAddress)
    return { owner, secondPerson, fetchAddress, pauser, getContract }
  }


  it("t0. tests deployer", async function () {
    const { owner, secondPerson, fetchAddress, pauser } = await loadFixture(deployStatusQuo)
  })


  it("t1. Mint PyroV1, trade on Behodler, redeem PyroV1, redeem rate should rise",async function (){
    throw "not implemented"
  })

  interface ethersLib {
    [key: string]: string
  }
})


