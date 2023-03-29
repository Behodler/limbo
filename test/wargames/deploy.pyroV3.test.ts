
const { expect } = require("chai");
import { parseEther } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { ContractSet, safeDeploy } from "../../scripts/networks/orchestrate";
import { contractNames, getPauser, recipeNames, stringToBytes32 } from "../../scripts/networks/common"
import * as networkHelpers from "@nomicfoundation/hardhat-network-helpers";
import * as Types from "../../typechain"
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import shell from "shelljs"
import { existsSync } from "fs";
import { BigNumber, Contract, ContractFactory } from "ethers";
import { deploy } from "../helpers";
import * as hre from "hardhat"
import { getContractFromSection } from "../../scripts/networks/deploymentFunctions";
import { EthereumProvider } from "hardhat/types";
const web3 = require("web3");

interface DeployedContracts {
  [name: string]: string;
}
let logFactory = (show: boolean) => {
  return (message: string, content?: any) => {
    if (show)
      console.log(`${message} ${content || ''}`)
  }
}
const deployRecipe = async (recipe: recipeNames, log: boolean, provider: EthereumProvider): Promise<ContractSet> => {
  let recipeLogger = logFactory(log)
  await provider.send("evm_setAutomine", [true]);
  const set = await safeDeploy(recipe, 1337, 1, recipeLogger) as ContractSet
  return set
}
describe("pyroV3 addition to mainnet", function () {
  const provider = hre.network.provider
  let logger = logFactory(false)
  const addressDir = shell.ls("scripts/networks/addresses/")

  if (addressDir.includes("hardhat.json")) {
    shell.rm("scripts/networks/addresses/hardhat*")
  }

  const lockDir = shell.ls("/tmp/")
  if (lockDir.includes("deploy.lock")) {
    shell.rm("/tmp/deploy.lock")
  }

  async function deployStatusQuoWithLogging() {
    return await deployStatusQuo(true)
  }

  async function deployStatusQuoWithoutLogging() {
    return await deployStatusQuo(false)
  }

  async function deployStatusQuo(log: boolean) {
    const [owner, secondPerson] = await ethers.getSigners();
    const set = await deployRecipe("statusquo", log, provider);

    const fetchAddressFactory = (addresses: DeployedContracts) =>
      (name: contractNames) => addresses[name]
    const fetchAddress = fetchAddressFactory(set.protocol)
    if (log)
      logger('addresses', JSON.stringify(set, null, 4))
    const pauser = await getPauser("hardhat", 9);
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
    logger('after each executed.');
    // await provider.send("evm_setAutomine", [false]);
  })

  it("t0. tests deployer", async function () {
    const { owner, secondPerson, fetchAddress, pauser } = await loadFixture(deployStatusQuoWithoutLogging)
  })


  it("t1. assert statusQuo recipe", async function () {
    const { owner, secondPerson, fetchAddress, pauser } = await loadFixture(deployStatusQuoWithLogging)
    // await provider.send("evm_setAutomine", [true]);
    const MockTokenFactory = await ethers.getContractFactory("MockToken")
    const link = await MockTokenFactory.attach(fetchAddress("LINK")) as Types.MockToken
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

  it("t2. assert OnlyPyroV3 recipe", async function () {

    // 1. Deploy status quo.
    // await provider.send("evm_setAutomine", [false]);
    const { owner, secondPerson, fetchAddress, pauser } = await loadFixture(deployStatusQuoWithLogging)
    // await provider.send("evm_setAutomine", [true]);
    const liquidityReceiverV1Factory = await getNamedFactory("LiquidityReceiverV1")
    const liquidityReceiverV1 = await getTypedContract<Types.LiquidityReceiverV1>(fetchAddress("LiquidityReceiverV1"), liquidityReceiverV1Factory)
    const addresses = {
      pyroLink: await liquidityReceiverV1.baseTokenMapping(fetchAddress("LINK")),
      pyroLoom: await liquidityReceiverV1.baseTokenMapping(fetchAddress("LOOM")),
      pyroMKR: await liquidityReceiverV1.baseTokenMapping(fetchAddress("MKR")),
      pyroPNK: await liquidityReceiverV1.baseTokenMapping(fetchAddress("PNK"))
    }
    const PyroTokenFactory = await ethers.getContractFactory("PyroToken_V2")
    const getPyroToken = async (address: string): Promise<Types.PyroTokenV2> => {
      return await getTypedContract<Types.PyroTokenV2>(address, PyroTokenFactory)
    }

    const pyroTokensV2 = {
      pyroLink: await getPyroToken(addresses.pyroLink),
      pyroLoom: await getPyroToken(addresses.pyroLoom),
      pyroMKR: await getPyroToken(addresses.pyroMKR),
      pyroPNK: await getPyroToken(addresses.pyroPNK),
    }

    // 2. Mint 3 Pyro V2 tokens
    // 2.1 Gather all addresses and approve
    const MockTokenFactory = await ethers.getContractFactory("MockToken")
    const getBaseToken = async (pyroToken: Types.PyroTokenV2): Promise<Types.MockToken> => {
      return await MockTokenFactory.attach(await pyroToken.baseToken()) as Types.MockToken
    }
    const max = ethers.constants.MaxUint256
    const baseTokens = {
      link: await getBaseToken(pyroTokensV2.pyroLink),
      loom: await getBaseToken(pyroTokensV2.pyroLoom),
      mkr: await getBaseToken(pyroTokensV2.pyroMKR),
      pnk: await getBaseToken(pyroTokensV2.pyroPNK),
    }

    await baseTokens.link.approve(addresses.pyroLink, max)
    await baseTokens.loom.approve(addresses.pyroLoom, max)
    await baseTokens.mkr.approve(addresses.pyroMKR, max)
    await baseTokens.pnk.approve(addresses.pyroPNK, max)

    await baseTokens.link.approve(fetchAddress("Behodler"), max)
    await baseTokens.loom.approve(fetchAddress("Behodler"), max)
    await baseTokens.mkr.approve(fetchAddress("Behodler"), max)
    await baseTokens.pnk.approve(fetchAddress("Behodler"), max)

    //2.2 Mint PyroV2 tokens
    const keys = Object.keys(pyroTokensV2)
    const pyroV2Balances = {
      pyroLink: BigNumber.from(0),
      pyroLoom: BigNumber.from(0),
      pyroMKR: BigNumber.from(0),
      pyroPNK: BigNumber.from(0)
    }
    logger('pyroV2Token keys: ' + JSON.stringify(keys))
    for (let i = 0; i < keys.length; i++) {
      const currentPyro = pyroTokensV2[keys[i]] as Types.PyroTokenV2
      //mint different amounts for each token
      const balanceOfCurrentBefore = await currentPyro.balanceOf(owner.address)
      const amountToMint = ethers.constants.WeiPerEther.mul(i + 1)
      await currentPyro.mint(amountToMint)
      const balanceOfCurrentAfter = await currentPyro.balanceOf(owner.address)
      pyroV2Balances[keys[i]] = balanceOfCurrentAfter
      expect(balanceOfCurrentAfter.sub(balanceOfCurrentBefore).toString()).to.equal(amountToMint.toString())
    }

    // 3. Deploy Pyro V3 upgrade.

    const pyroDeployments = await deployRecipe("onlyPyroV3", true, provider)

    const fetchPyroAddress = (contract: contractNames) => pyroDeployments.protocol[contract]

    logger('pyroDeployments', JSON.stringify(pyroDeployments, null, 2))

    // 4. sell base token on Behodler and assert correct LR
    const behodler = await getBehodler(fetchAddress)
    const liquidityReceiverFactory = await getNamedFactory("LiquidityReceiver")
    const liquidityReceiver = await getTypedContract<Types.LiquidityReceiver>(fetchPyroAddress("LiquidityReceiver"), liquidityReceiverFactory)
    const linkBalanceOnLRBefore = await baseTokens.link.balanceOf(liquidityReceiver.address)
    const linkOnBehodlerBefore = await baseTokens.link.balanceOf(behodler.address)
    await baseTokens.link.approve(behodler.address, ethers.constants.MaxUint256)
    const mkrBalanceBefore = await baseTokens.mkr.balanceOf(behodler.address)
    const linkToTrade = ethers.constants.WeiPerEther.mul(15).div(10)
    const mkrOutput = getAmountOut(linkToTrade, linkOnBehodlerBefore, mkrBalanceBefore)

    await behodler.swap(baseTokens.link.address, baseTokens.mkr.address, linkToTrade, mkrOutput)

    const linkBalanceOnLRAfterSwap = await baseTokens.link.balanceOf(liquidityReceiver.address)
    expect(linkBalanceOnLRAfterSwap).to.equal(linkToTrade.mul(5).div(1000))
    expect(linkBalanceOnLRBefore.isZero()).to.be.true

    // 5. Upgrade 1 of the tokens via the migrator

    const migratorFactory = await getNamedFactory("V2Migrator")
    const migrator = await getTypedContract<Types.V2Migrator>(fetchPyroAddress("V2Migrator"), migratorFactory)

    // 5.1 Deply PyroLink
    const PyroTokenV3Factory = await ethers.getContractFactory("PyroToken")
    const pyroLinkAddress = await liquidityReceiver.getPyroToken(baseTokens.link.address)
    const pyroLinkV3 = await PyroTokenV3Factory.attach(pyroLinkAddress) as Types.PyroToken

    await pyroTokensV2.pyroLink.approve(migrator.address, ethers.constants.MaxUint256)
    const pyroLinkV3BalanceBeforeMigrate = await pyroLinkV3.balanceOf(owner.address)
    expect(pyroLinkV3BalanceBeforeMigrate.toString()).to.equal("0")

    const expectedP3Amount = pyroV2Balances.pyroLink.mul(98).div(100)
    await migrator.migrate(pyroTokensV2.pyroLink.address, pyroLinkV3.address, pyroV2Balances.pyroLink, expectedP3Amount)

    const pyroV3BalanceAfterMigrate = await pyroLinkV3.balanceOf(owner.address)
    expect(pyroV3BalanceAfterMigrate.add(1000).gt(expectedP3Amount)).to.be.true

    // 6. Upgrade the other 2 as a batch.
    const expectedPyroLoomBalanceAfterMigrate = pyroV2Balances.pyroLoom.mul(98).div(100)
    const expectedPyroMKRBalanceAfterMigrate = pyroV2Balances.pyroMKR.mul(98).div(100)

    await pyroTokensV2.pyroLoom.approve(migrator.address, ethers.constants.MaxUint256)
    await pyroTokensV2.pyroMKR.approve(migrator.address, ethers.constants.MaxUint256)

    const pyroLoomV3Address = await liquidityReceiver.getPyroToken(baseTokens.loom.address)
    const pyroMKRV3Address = await liquidityReceiver.getPyroToken(baseTokens.mkr.address)

    await migrator.migrateMany([pyroTokensV2.pyroLoom.address, pyroTokensV2.pyroMKR.address], [pyroLoomV3Address, pyroMKRV3Address],
      [pyroV2Balances.pyroLoom, pyroV2Balances.pyroMKR], [expectedPyroLoomBalanceAfterMigrate, expectedPyroMKRBalanceAfterMigrate])

    const pyroLoomV3 = await PyroTokenV3Factory.attach(pyroLoomV3Address) as Types.PyroToken
    const pyroMKRV3 = await PyroTokenV3Factory.attach(pyroMKRV3Address) as Types.PyroToken

    const pyroLoomV3Balance = await pyroLoomV3.balanceOf(owner.address)
    const pyroMKRV3Balance = await pyroMKRV3.balanceOf(owner.address)

    expect(pyroLoomV3Balance.add(1000).gt(expectedPyroLoomBalanceAfterMigrate)).to.be.true
    expect(pyroMKRV3Balance.add(1000).gt(expectedPyroMKRBalanceAfterMigrate)).to.be.true

    // 7. Redeem all tokens Link,Loom,MKR


    const basePyroGroup = [{
      base: baseTokens.link,
      pyro: pyroLinkV3,
      pyroBalanceBefore: await pyroLinkV3.balanceOf(owner.address),
      baseBalanceBefore: await baseTokens.link.balanceOf(owner.address),
      baseBalanceAfter: BigNumber.from(0),
    },
    {
      base: baseTokens.loom,
      pyro: pyroLoomV3,
      pyroBalanceBefore: await pyroLoomV3.balanceOf(owner.address),
      baseBalanceBefore: await baseTokens.loom.balanceOf(owner.address),
      baseBalanceAfter: BigNumber.from(0),
    },
    {
      base: baseTokens.mkr,
      pyro: pyroMKRV3,
      pyroBalanceBefore: await pyroMKRV3.balanceOf(owner.address),
      baseBalanceBefore: await baseTokens.mkr.balanceOf(owner.address),
      baseBalanceAfter: BigNumber.from(0),
    }]

    for (let i = 0; i < basePyroGroup.length; i++) {
      const current = basePyroGroup[i]
      const currentRedeemRate = await current.pyro.redeemRate()
      await current.pyro.redeem(owner.address, current.pyroBalanceBefore)
      current.baseBalanceAfter = await current.base.balanceOf(owner.address)
      const expectedIncreaseInBase = current.pyroBalanceBefore.mul(98).div(100).mul(currentRedeemRate).div(ethers.constants.WeiPerEther)
      logger('iteration', i.toString())
      const actualIncrease = current.baseBalanceAfter.sub(current.baseBalanceBefore)

      //precision loss requires the amounts to almost match
      const upperBound = actualIncrease.add(1000).gt(expectedIncreaseInBase)
      const lowerBound = actualIncrease.sub(1000).lt(expectedIncreaseInBase)
      expect(upperBound).to.be.true
      expect(lowerBound).to.be.true
    }
  })


  it("t3. OnlyPyroV3 must not accidentally deploy Flan or PyroFlan", async function () {
    // await provider.send("evm_setAutomine", [false]);
    const { owner, secondPerson, fetchAddress, pauser } = await loadFixture(deployStatusQuoWithoutLogging)
    const pyroDeployments = await deployRecipe("onlyPyroV3", true, provider)


    // await provider.send("evm_setAutomine", [true]);
    const fetchPyroAddress = (contract: contractNames) => pyroDeployments[contract]

    const flanFromPyro = fetchPyroAddress("Flan")
    const flanFromStatusQuo = fetchAddress("Flan")
    expect(flanFromPyro).to.be.undefined
    expect(flanFromStatusQuo).to.be.undefined
  })

  //***********************************END TESTS*********************
  async function getNamedFactory(name: contractNames): Promise<ContractFactory> {
    return ethers.getContractFactory(name)
  }

  async function getTypedContract<T>(address: string, factory: ContractFactory): Promise<T> {
    return factory.attach(address) as T
  }

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


