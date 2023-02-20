
const { expect } = require("chai");
import { parseEther } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { safeDeploy } from "../../scripts/networks/orchestrate";
import { contractNames, getPauser, stringToBytes32 } from "../../scripts/networks/common"
import * as networkHelpers from "@nomicfoundation/hardhat-network-helpers";
import * as Types from "../../typechain"
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import shell from "shelljs"
import { existsSync } from "fs";
import { BigNumber, Contract } from "ethers";
import { deploy } from "../helpers";
import * as hre from "hardhat"
import { getContractFromSection } from "../../scripts/networks/deploymentFunctions";
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
  const provider = hre.network.provider
  let logger = logFactory(true)
  if (existsSync("scripts/networks/addresses/hardhat.json"))
    shell.rm("scripts/networks/addresses/hardhat.json")

  async function deployStatusQuo() {
    const [owner, secondPerson] = await ethers.getSigners();
    const addresses = (await safeDeploy("statusquo", 1337, 2, 9)) as DeployedContracts;
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

  this.afterEach(async () => {
    await provider.send("evm_setAutomine", [false]);
  })
  
  it("t0. tests deployer", async function () {
    const { owner, secondPerson, fetchAddress, pauser } = await loadFixture(deployStatusQuo)
  })


  it("t1. assert statusQuo recipe", async function () {
    const { owner, secondPerson, fetchAddress, pauser } = await loadFixture(deployStatusQuo)
    await provider.send("evm_setAutomine", [true]);
    const MockTokenFactory = await ethers.getContractFactory("MockToken")
    const link = await MockTokenFactory.attach(fetchAddress("LNK")) as Types.MockToken
    const eye = await MockTokenFactory.attach(fetchAddress("EYE")) as Types.MockToken

    const behodler = await getBehodler(fetchAddress)
    const LiquidityReceiverFactory = await ethers.getContractFactory("LiquidityReceiverV1")
    const liquidityReceiver = await LiquidityReceiverFactory.attach(fetchAddress("LiquidityReceiverV1")) as Types.LiquidityReceiverV1

    const pyroLinkAddress = await liquidityReceiver.baseTokenMapping(link.address)
    const PyroTokenFactory = await ethers.getContractFactory("PyroToken_V2")
    const pyroLink = await PyroTokenFactory.attach(pyroLinkAddress) as Types.PyroTokenV2
    expect((await pyroLink.redeemRate()).toString()).to.equal(ethers.constants.WeiPerEther.toString())

    await link.approve(pyroLink.address, ethers.constants.MaxUint256)
    await link.approve(behodler.address, ethers.constants.MaxUint256)
    const linkBalance = await link.balanceOf(owner.address)
    const balanceCondition = linkBalance.gt(ethers.constants.One.mul(10))
    expect(balanceCondition).is.true

    await pyroLink.mint(ethers.constants.WeiPerEther.mul(2))

    const pyroLinkBalance = await pyroLink.balanceOf(owner.address)
    expect(pyroLinkBalance.toString()).to.equal(ethers.constants.WeiPerEther.mul(2))

    const linkBalanceBefore = await link.balanceOf(owner.address)
    const eyeBalanceBefore = await eye.balanceOf(owner.address)
    const linkReserveOnPyro = await link.balanceOf(pyroLink.address)

    const behodlerLink = await link.balanceOf(behodler.address)
    const behodlerEye = await eye.balanceOf(behodler.address)
    const amountIn = linkReserveOnPyro.mul(100)
    const amountOut = getAmountOut(amountIn, behodlerLink, behodlerEye)
    await behodler.swap(link.address, eye.address, amountIn, amountOut)

    const eyeBalanceAfter = await eye.balanceOf(owner.address)
    const linkBalanceAfter = await link.balanceOf(owner.address)

    expect(eyeBalanceAfter.sub(eyeBalanceBefore).toString()).to.equal(amountOut)
    expect(linkBalanceBefore.sub(linkBalanceAfter).toString()).to.equal(amountIn)
    await pyroLink.mint(ethers.constants.WeiPerEther)

    const redeemRateAfter = await pyroLink.redeemRate()
    expect(redeemRateAfter.toString()).to.equal(ethers.constants.WeiPerEther.mul(15).div(10).toString())
  })

  function getAmountOut(
    amountIn: BigNumber,
    reserveIn: BigNumber,
    reserveOut: BigNumber
  ): BigNumber {
    require(!amountIn.isZero(), "UniswapV2Library: INSUFFICIENT_INPUT_AMOUNT");
    require(!reserveIn.isZero() && !reserveOut.isZero(), `INSUFFICIENT_LIQUIDITY: reserveIn: ${reserveIn.toString()}, reserveOut: ${reserveOut.toString()}`);
    const amountInWithFee = amountIn.mul(995);
    const numerator = amountInWithFee.mul(reserveOut);
    const denominator = reserveIn.mul(1000).add(amountInWithFee);
    return numerator.div(denominator);
  }

  const require = (condition: boolean, message: String) => {
    if (!condition)
      throw message
  }

  interface ethersLib {
    [key: string]: string
  }

  const getBehodler = async (fetchAddress: (name: contractNames) => string): Promise<Types.Behodler> => {

    const AddressBalanceCheckFactory = await ethers.getContractFactory("AddressBalanceCheck")
    const addressBalanceCheck = await AddressBalanceCheckFactory.attach(fetchAddress("AddressBalanceCheck"))

    const behodlerLib: ethersLib = {
      AddressBalanceCheck: addressBalanceCheck.address
    }

    const BehodlerFactory = await ethers.getContractFactory("Behodler", { libraries: behodlerLib })
    return await BehodlerFactory.attach(fetchAddress("Behodler")) as Types.Behodler
  }
})


