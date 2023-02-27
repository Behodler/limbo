/*
This is an in memory representation of the public testnet deployment script. Each test represents a scenario or "wargame" that can be tested in memory.
Once the wargame is established, it can be used as a script for manually testing the wargame on public testnet. If the result diverges from the unit test, 
we know there's a front end error.
This suite will be a useful area for the community to submit pull requests against when they wish to test certain cryptoeconomic aspects of Limbo before 
issuing a proposal.
This offers a bit more flexibility than forking the existing public testnet state and testing against that because we may wish the local and public testnet states to diverge.
You can't undeploy a contract and adding self destruct code just for testing could introduce vulnerabilities.
*/
const { expect, assert } = require("chai");
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
import { runSynchronously } from "./helpers";
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
describe("public testnet deployment", function () {
  const provider = hre.network.provider
  let logger = logFactory(false)
  if (existsSync("scripts/networks/addresses/hardhat.json"))
    shell.rm("scripts/networks/addresses/hardhat.json")

  async function deployEcosystem() {
    const [owner, secondPerson] = await ethers.getSigners();
    const addresses = (await safeDeploy("testnet", 1337, 2, 9, logger)) as DeployedContracts;
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
    const { fetchAddress } = await
      runSynchronously(provider, async () => await loadFixture(deployEcosystem))
  })

  it("t1. illustrate a healthy deployment by having working LP tokens", async function () {
    const { fetchAddress } =
      await runSynchronously(provider, async () => await loadFixture(deployEcosystem))

    const eyeDaiAddress = fetchAddress("EYE_DAI")
    const uniswapPairFactory = await ethers.getContractFactory("UniswapV2Pair");
    const eyeDai = uniswapPairFactory.attach(eyeDaiAddress) as Types.ERC20;
    const totalSupply = await eyeDai.totalSupply();
    logger('total eye dai supply ' + totalSupply.toString())
  });

  it("t2. list a fake token as threshold with positive delta and migrate it successfully to behodler", async function () {
    const { owner, secondPerson, fetchAddress, pauser } =
      await runSynchronously(provider, async () => await loadFixture(deployEcosystem))

    const aave = await (await ethers.getContractFactory("MockToken")).attach(fetchAddress("Aave")) as Types.MockToken;
    await expect(await aave.totalSupply()).to.be.gt(0);

    //Approve aave on Limbo
    await aave.approve(fetchAddress("Limbo"), parseEther("1000000000000000000000000000"));
    await aave.connect(secondPerson).approve(fetchAddress("Limbo"), parseEther("1000000000000000000000000000"));
    await aave.transfer(secondPerson.address, parseEther("2000"));

    //attach Limbo
    const LimboFactory = await ethers.getContractFactory("Limbo", {
      libraries: {
        SoulLib: fetchAddress("SoulLib"),
        CrossingLib: fetchAddress("CrossingLib"),
        MigrationLib: fetchAddress("MigrationLib"),
      },
    });
    const limbo = await LimboFactory.attach(fetchAddress("Limbo")) as Types.Limbo;

    logger("DAO", fetchAddress('LimboDAO'))
    logger('aave address', aave.address)
    const LimboDAOFactory = await ethers.getContractFactory("LimboDAO")
    const dao = await LimboDAOFactory.attach(fetchAddress("LimboDAO")) as Types.LimboDAO


    const UpdateMultipleSoulConfigProposalFactory = await ethers.getContractFactory("UpdateMultipleSoulConfigProposal")
    const proposal = await UpdateMultipleSoulConfigProposalFactory.attach(fetchAddress("UpdateMultipleSoulConfigProposal")) as Types.UpdateMultipleSoulConfigProposal
    logger("about to engage in governance for proposal", proposal.address)
    const ConfigureTokenApproverPowerFactory = await ethers.getContractFactory("ConfigureTokenApproverPower")
    const power = await ConfigureTokenApproverPowerFactory.attach(fetchAddress("ConfigureTokenApproverPower")) as Types.ConfigureTokenApproverPower
    await power.setApprove([aave.address], [true])

    const AngbandFactory = await ethers.getContractFactory("Angband")
    const angband = await AngbandFactory.attach(fetchAddress("Angband")) as Types.Angband

    await angband.executePower(power.address)

    await proposal.parameterize(aave.address,
      ethers.constants.WeiPerEther.mul(2000)
      , 1, 1, 0, "210", ethers.constants.WeiPerEther.mul(7000)
      , ethers.constants.WeiPerEther.mul("6320000"),
      ethers.constants.WeiPerEther.mul("100000"), false)
    await proposal.lockDown()

    const ProposalFactoryFactory = await ethers.getContractFactory("ProposalFactory")
    const proposalFactory = await ProposalFactoryFactory.attach(fetchAddress("ProposalFactory")) as Types.ProposalFactory

    const MockToken = await ethers.getContractFactory("MockToken")
    const eye = await MockToken.attach(fetchAddress("EYE")) as Types.MockToken

    const proposalConfig = await dao.proposalConfig()
    await eye.approve(dao.address, ethers.constants.MaxUint256)
    await dao.burnAsset(fetchAddress("EYE"), proposalConfig.requiredFateStake, true)

    await expect(proposalFactory.lodgeProposal(proposal.address))
      .to.emit(proposalFactory, "LodgingStatus")
      .withArgs(proposal.address, "SUCCESS");

    await dao.vote(proposal.address, "1000")

    logger("voting duration", proposalConfig.votingDuration.toString())
    await networkHelpers.mine(1)
    await networkHelpers.time.increase(proposalConfig.votingDuration)
    await networkHelpers.mine(1)

    await expect(dao.executeCurrentProposal())//2 == rejected, 3 == failed
      .to.emit(dao, "proposalExecuted")
      .withArgs(proposal.address, true)

    logger("governance success for dao", dao.address)

    const soul = await limbo.souls(aave.address, 0)
    logger('Soul State', soul.state)
    //get initial flan balances
    const flan = await (await ethers.getContractFactory("MockToken")).attach(fetchAddress("Flan"));
    const user1Flan = await flan.balanceOf(owner.address);
    const user2Flan = await flan.balanceOf(secondPerson.address);

    await expect(user2Flan).to.equal(0);

    const aaveBalanceOwner = await aave.balanceOf(owner.address);
    const aaveBalanceSecondPerson = await aave.balanceOf(secondPerson.address);

    logger(`aave balance owner ${aaveBalanceOwner}, aave balance second person ${aaveBalanceSecondPerson}`);
    //stake user 1
    await aave.approve(limbo.address, ethers.constants.MaxUint256)

    await limbo.stake(aave.address, parseEther("250"))
    //stake user 2.
    await aave.connect(secondPerson).approve(limbo.address, ethers.constants.MaxUint256)
    await limbo.connect(secondPerson).stake(aave.address, parseEther("1100"));


    logger("about to pause for 400000 seconds ");

    await networkHelpers.time.increase(400000)

    logger("finished pausing");

    //unstake some of user 1, assert flan balance
    await limbo.unstake(aave.address, parseEther("100"));
    await networkHelpers.time.increase(5)
    await networkHelpers.mine(1);

    const user1FlanAfter = (await flan.balanceOf(owner.address)).sub(user1Flan);
    logger("user1Flan", user1FlanAfter)
    await expect(user1FlanAfter).to.be.gte(parseEther("0.34"));
    await expect(user1FlanAfter).to.be.lt(parseEther("0.38"));
    //increase stake of user 2 until threshold crossed, assert state

    //stake exact amount, no crossover
    await limbo.stake(aave.address, parseEther("750"));
    await networkHelpers.time.increase(5)

    const soulReader = (await ethers.getContractFactory("SoulReader")).attach(fetchAddress("SoulReader")) as Types.SoulReader;
    const stats = await soulReader.soulStats(aave.address, limbo.address);
    logger(`state: ${stats[0]}, stakedBalance: ${stats[1]}`);
    expect(stats[0].toString()).to.equal("1");
    expect(stats[1].toString()).to.equal(parseEther("2000"));

    //stake 1 and cross over
    await limbo.connect(secondPerson).stake(aave.address, parseEther("1"));
    await networkHelpers.time.increase(10)

    const stats2 = await soulReader.soulStats(aave.address, limbo.address);
    logger(`state: ${stats2[0]}, stakedBalance: ${stats2[1]}`);
    expect(stats2[0].toString()).to.equal("2");
    const stakedAave = ethers.constants.WeiPerEther.mul(2001)
    expect(stats2[1].toString()).to.equal(stakedAave);

    await networkHelpers.time.increase(3600)
    await networkHelpers.mine(1)
    //migrate token to behodler
    const aaveBalanceOnBehodlerBeforeMigrate = await aave.balanceOf(fetchAddress("Behodler"));
    expect(aaveBalanceOnBehodlerBeforeMigrate).to.equal(0);
    await limbo.migrate(aave.address, 0);

    const aaveBalanceOnBehodlerAfter = await aave.balanceOf(fetchAddress("Behodler"));
    logger('aave address', fetchAddress("Aave"))
    //redeem some of the token from behodler
    const addressBalanceCheckAddress = fetchAddress("AddressBalanceCheck");
    const BehodlerFactory = await ethers.getContractFactory("BehodlerLite", {
      libraries: { AddressBalanceCheck: addressBalanceCheckAddress },
    })
    const behodler = BehodlerFactory.attach(fetchAddress("Behodler")) as Types.Behodler;
    expect(aaveBalanceOnBehodlerAfter).to.equal(stakedAave);

    const aaveBalanceBeforeRedeem = await aave.balanceOf(owner.address);
    await networkHelpers.time.increase(2)
    await behodler.withdrawLiquidity(aave.address, parseEther("10"));
    await networkHelpers.time.increase(2)
    const aaveBalanceAfterRedeem = await aave.balanceOf(owner.address);
    expect(aaveBalanceAfterRedeem).to.be.gt(aaveBalanceBeforeRedeem);



    const LiquidityReceiverFactory = await ethers.getContractFactory("LiquidityReceiver")
    const liquidityReceiver = LiquidityReceiverFactory.attach(await fetchAddress("LiquidityReceiver")) as Types.LiquidityReceiver

    const powersFactory = await ethers.getContractFactory("PowersRegistry")
    const powers = await powersFactory.attach(fetchAddress("PowersRegistry")) as Types.PowersRegistry

    const powerBytes = stringToBytes32("REGISTER_PYRO_V3")
    const melkor = stringToBytes32("Melkor")
    await powers.create(powerBytes, stringToBytes32("LIQUIDITY_RECEIVER"), true, false)
    await powers.pour(powerBytes, melkor)

    const setPyroDetailsPower = stringToBytes32("ADD_TOKEN_TO_BEHODLER")
    await powers.create(setPyroDetailsPower, stringToBytes32("LIQUIDITY_RECEIVER"), true, false)
    await powers.pour(setPyroDetailsPower, melkor)

    const RegisterPyroV3PowerInvokerFactory = await ethers.getContractFactory("RegisterPyroTokenV3Power")

    const powerInvoker = await deploy<Types.RegisterPyroTokenV3Power>(RegisterPyroV3PowerInvokerFactory, aave.address, false, angband.address,powers.address)
    await powerInvoker.setPyroDetails("PyroAave", "PAAVE")
    await angband.authorizeInvoker(powerInvoker.address, true)
    await angband.executePower(powerInvoker.address)

    const pyroAaveAddress = await liquidityReceiver.getPyroToken(aave.address)
    logger('pyroAaveAddress ' + pyroAaveAddress)

    const PyroTokenFactory = await ethers.getContractFactory("PyroToken")

    const pyroAave = await PyroTokenFactory.attach(pyroAaveAddress) as Types.PyroToken

    await expect((await pyroAave.config()).baseToken).to.equal(aave.address)
    await aave.approve(pyroAave.address, ethers.constants.MaxUint256)
    await pyroAave.mint(owner.address, ethers.constants.WeiPerEther.mul(10))
    const balanceOfPyro = await pyroAave.balanceOf(owner.address)
    await expect(balanceOfPyro).to.equal(ethers.constants.WeiPerEther.mul(10))
    const redeemRate = (await pyroAave.redeemRate()).toString()
    logger('pyroAaveRedeemRate', redeemRate)
    const aaveInPyroAave = await aave.balanceOf(pyroAave.address)
    logger('Aave in pyroAave', aaveInPyroAave)
    const aaveInLiquidityReceiver = await aave.balanceOf(liquidityReceiver.address)
    logger('aave in liquidityReceiver', aaveInLiquidityReceiver)
    const aaveOfOwnerBefore = await aave.balanceOf(owner.address)
    await pyroAave.redeem(owner.address, ethers.constants.WeiPerEther.mul(10))
  });

  it("t3. trade flan via cliff face mapping", async function () {

    const { owner, secondPerson, fetchAddress, pauser } =
      await runSynchronously(provider, async () => await loadFixture(deployEcosystem))


    const ApproveFlanMintingProposalFactory = await ethers.getContractFactory("ApproveFlanMintingProposal")
    const approveFlanMintingProposal = await ApproveFlanMintingProposalFactory.attach(fetchAddress("ApproveFlanMintingProposal")) as Types.ApproveFlanMintingProposal
    await approveFlanMintingProposal.parameterize(owner.address, true)

    const LimboDAOFactory = await ethers.getContractFactory("LimboDAO")
    const dao = await LimboDAOFactory.attach(fetchAddress("LimboDAO")) as Types.LimboDAO

    const mockTokenFactory = await ethers.getContractFactory("MockToken")
    const eye = await mockTokenFactory.attach(fetchAddress("EYE")) as Types.MockToken

    await eye.approve(dao.address, ethers.constants.MaxUint256)

    const proposalConfig = await dao.proposalConfig()
    await dao.burnAsset(eye.address, proposalConfig.requiredFateStake, true)

    const proposalFactory = (await ethers.getContractFactory("ProposalFactory")).attach(fetchAddress("ProposalFactory")) as Types.ProposalFactory

    await expect(proposalFactory.lodgeProposal(approveFlanMintingProposal.address))
      .to.emit(proposalFactory, "LodgingStatus")
      .withArgs(approveFlanMintingProposal.address, "SUCCESS");

    await dao.vote(approveFlanMintingProposal.address, 100)

    await networkHelpers.mine(1)
    await networkHelpers.time.increase(proposalConfig.votingDuration.add(10))
    await networkHelpers.mine(1)

    await expect(dao.executeCurrentProposal())//2 == rejected, 3 == failed
      .to.emit(dao, "proposalExecuted")
      .withArgs(approveFlanMintingProposal.address, true)

    //mint lots of flan via a proposal.
    const behodlerAddress = fetchAddress("Behodler")

    const dai = mockTokenFactory.attach(fetchAddress("DAI")) as Types.MockToken
    const balanceOfDaiOnBehodler = await dai.balanceOf(behodlerAddress)

    const flan = (await ethers.getContractFactory("Flan")).attach(fetchAddress("Flan")) as Types.Flan
    await flan.mint(owner.address, balanceOfDaiOnBehodler.mul(3))

    //mint pyroFlan
    //Remember the mapping is Flan -> cliffFace(Flan) -> Pyro(CliffFace(Flan)) which means liquidity Receiver maps cliff to Pyro, not Flan to pyro
    const LiquidityReceiverFactory = await ethers.getContractFactory("LiquidityReceiver")
    const liquidityReceiver = LiquidityReceiverFactory.attach(await fetchAddress("LiquidityReceiver")) as Types.LiquidityReceiver
    const pyroTokenFactory = (await ethers.getContractFactory("PyroToken"))

    const tokenProxyRegistry = await (await (ethers.getContractFactory("TokenProxyRegistry"))).attach(fetchAddress("TokenProxyRegistry")) as Types.TokenProxyRegistry
    const tokenConfig = await tokenProxyRegistry.tokenProxy(flan.address)
    const behodlerFlanProxy = tokenConfig.behodlerProxy
    logger('cliffFace of Flan', behodlerFlanProxy)
    const pyroFlanAddress = await liquidityReceiver.getPyroToken(behodlerFlanProxy)
    const pyroFlan = await pyroTokenFactory.attach(pyroFlanAddress) as Types.PyroToken

    const pyroConfig = await pyroFlan.config()
    expect(pyroConfig.baseToken).to.equal(behodlerFlanProxy)

    const flanCliffFace = (await ethers.getContractFactory("CliffFace")).attach(behodlerFlanProxy) as Types.CliffFace
    await flan.approve(flanCliffFace.address, ethers.constants.MaxUint256)
    await flanCliffFace.seedBehodler(balanceOfDaiOnBehodler, owner.address)

    const proxyHandler = (await ethers.getContractFactory("ProxyHandler")).attach(fetchAddress("ProxyHandler")) as Types.ProxyHandler
    await flan.approve(proxyHandler.address, ethers.constants.MaxUint256)
    await proxyHandler.approvePyroTokenForProxy(pyroFlan.address)
    await proxyHandler.mintPyroFromBase(pyroFlan.address, ethers.constants.WeiPerEther.mul(1000))

    const pyroFlanRedeemRate = await proxyHandler.redeemRate(pyroFlan.address)
    logger('pyroFlanRedeemRate', pyroFlanRedeemRate)
    const balanceOfPyroFlan = await pyroFlan.balanceOf(owner.address)
    expect(balanceOfPyroFlan.toString()).to.equal("989108910891089108921")

    //dump lots of flan via cliff face onto Behodler.
    let changeInDai = BigNumber.from(0)
    let outputAmount = BigNumber.from('330469270000000000000')

    const daiBalancOfOwnerBefore = await dai.balanceOf(owner.address)

    await flanCliffFace.swapAsInput(owner.address, dai.address, outputAmount, ethers.constants.WeiPerEther.mul((1000)))
    const daiBalanceOfOwnerAfter = await dai.balanceOf(owner.address)
    changeInDai = daiBalanceOfOwnerAfter.sub(daiBalancOfOwnerBefore)


    expect(changeInDai.toString()).to.equal(outputAmount.toString())
    //Compare redeem rate reported on PyroToken to inferred calculations.


    //try again
    const cliffFaceBalanceOfPyroFlan = await flanCliffFace.balanceOf(pyroFlan.address)
    const cliffFaceBalanceOnLR = await flanCliffFace.balanceOf(liquidityReceiver.address)
    const totalCliffFaceReserve = cliffFaceBalanceOfPyroFlan.add(cliffFaceBalanceOnLR)

    const totalSupplyOfPyroFlan = await pyroFlan.totalSupply()
    const impliedPyroFlanRedeemRate = await totalCliffFaceReserve
      .mul(ethers.constants.WeiPerEther).div(totalSupplyOfPyroFlan)


    const flanOnCliffFace = await flan.balanceOf(flanCliffFace.address)
    const totalSupplyOfCliffFace = await flanCliffFace.totalSupply()
    const impliedCliffFaceRedeemRate = await flanOnCliffFace.mul(ethers.constants.WeiPerEther).div(totalSupplyOfCliffFace)
    const actualCliffFaceRedeemRate = await flanCliffFace.redeemRate()
    expect(impliedCliffFaceRedeemRate.toString()).to.equal(actualCliffFaceRedeemRate.toString())


    const ownerBalanceOfPyroFlan = await pyroFlan.balanceOf(owner.address)

    const impliedProxyRedeemed = impliedPyroFlanRedeemRate
      .mul(ownerBalanceOfPyroFlan)
      .mul(98).div(100) //redemption fee but no transfer fee
      .div(ethers.constants.WeiPerEther)
    logger('implied proxyRedeemed', impliedProxyRedeemed)

    const impliedFlan = actualCliffFaceRedeemRate
      .mul(impliedProxyRedeemed)
      .div(ethers.constants.WeiPerEther)

    const ownerFlanBeforeRedeem = await flan.balanceOf(owner.address)
    await pyroFlan.approve(proxyHandler.address, ethers.constants.MaxUint256)
    await proxyHandler.redeemFromPyro(pyroFlan.address, ownerBalanceOfPyroFlan)
    const changeInFlan = (await flan.balanceOf(owner.address)).sub(ownerFlanBeforeRedeem)
    logger('changeInFlan', changeInFlan)
    logger('impliedFlan', impliedFlan)
    expect(changeInFlan.toString()).to.equal(impliedFlan)
  })

  describe("gas test", () => {
    const provider = hre.network.provider

    it("swap comparisons", async function () {

      let { owner, secondPerson, fetchAddress, pauser, getContract } =
        await runSynchronously(provider, async () => await loadFixture(deployEcosystem))
      //note: fixture must be loaded with synchronous blocks before automine is enabled. This is 
      //why we can't put the automine command in beforeEach\

      const tokenFactory = await ethers.getContractFactory("MockToken")
      const eye = await tokenFactory.attach(fetchAddress("EYE")) as Types.MockToken

      const eyeBalance = await eye.balanceOf(owner.address)
      logger("eye balance", eyeBalance)

      const flanFactory = await ethers.getContractFactory("Flan")
      const flan = await flanFactory.attach(fetchAddress("Flan")) as Types.Flan
      const tokenProxyRegistryFactory = await ethers.getContractFactory("TokenProxyRegistry")
      const tokenProxyRegistry = await tokenProxyRegistryFactory.attach(fetchAddress("TokenProxyRegistry")) as Types.TokenProxyRegistry
      const set = await tokenProxyRegistry.tokenProxy(flan.address)
      logger('set', `${flan.address}, ${set.behodlerProxy}`)
      await flan.approve(set.behodlerProxy, ethers.constants.MaxUint256)

      const flanBalance = await flan.balanceOf(owner.address)
      logger('owner flan balance', flanBalance)
      const SwapComparisonsFactory = await ethers.getContractFactory("SwapComparisons")
      const swapComparisons = await deploy<Types.SwapComparisons>(SwapComparisonsFactory, fetchAddress("TokenProxyRegistry"), fetchAddress("EYE"), fetchAddress("DAI"), fetchAddress("Behodler"), fetchAddress("Flan"))

      await eye.approve(swapComparisons.address, ethers.constants.MaxUint256)
      await swapComparisons.swapMeasureSimpleSwap()
      const simpleGasConsumption = await swapComparisons.gasConsumed(true)
      logger('simple gas consumed', simpleGasConsumption.toString())

      await flan.approve(swapComparisons.address, ethers.constants.MaxUint256)
      await swapComparisons.swapMeasureCliffFaceSwap()
      const cliffFaceGasConsumed = await swapComparisons.gasConsumed(false)
      logger('cliffFace gas consumed ', cliffFaceGasConsumed.toString())
      const percentage = simpleGasConsumption.mul(100).div(cliffFaceGasConsumed)
      logger('cliffFace gas consumed ', cliffFaceGasConsumed.toString())

      logger(`simple uses ${percentage.toString()}% as much gas as cliffFace. Note different base tokens`)
    })

  })
  interface ethersLib {
    [key: string]: string
  }
})


