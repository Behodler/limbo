/*
This is an in memory representation of the ropsten deployment script. Each test represents a scenario or "wargame" that can be tested in memory.
Once the wargame is established, it can be used as a script for manually testing the wargame on ropsten. If the result diverges from the unit test, 
we know there's a front end error.
This suite will be a useful area for the community to submit pull requests against when they wish to test certain cryptoeconomic aspects of Limbo before 
issuing a proposal.
This offers a bit more flexibility than forking the existing ropsten state and testing against that because we may wish the local and ropsten states to diverge.
You can't undeploy a contract and adding self destruct code just for testing could introduce vulnerabilities.
*/
const { expect, assert } = require("chai");
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { parseEther } from "ethers/lib/utils";
import { ethers, network } from "hardhat";
import { safeDeploy } from "../../scripts/networks/orchestrate";
import { broadcast, contractNames, getPauser, stringToBytes32 } from "../../scripts/networks/common"
import * as networkHelpers from "@nomicfoundation/hardhat-network-helpers";
import * as Types from "../../typechain"
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import shell from "shelljs"
import { existsSync } from "fs";
import { BigNumber } from "ethers";
const web3 = require("web3");
interface DeployedContracts {
  [name: string]: string;
}

describe("ropsten deployment", function () {

  let logger = (message: string, content: any) => {
    console.log(`In test: ${message} ${content}`)
  }
  if (existsSync("scripts/networks/addresses/hardhat.json"))
    shell.rm("scripts/networks/addresses/hardhat.json")

  async function deployEcosystem() {
    const [owner, secondPerson] = await ethers.getSigners();
    const addresses = (await safeDeploy(1337, 2, 9)) as DeployedContracts;
    const fetchAddressFactory = (addresses: DeployedContracts) =>
      (name: contractNames) => addresses[name]
    const fetchAddress = fetchAddressFactory(addresses)
    logger('Addresses ', JSON.stringify(addresses, null, 4))
    const pauser = await getPauser(2, "hardhat", 9);
    return { owner, secondPerson, fetchAddress, pauser }
  }


  it("t0. tests deployer", async function () {
    const { fetchAddress } = await loadFixture(deployEcosystem)
  })

  it("t1. illustrate a healthy deployment by having working LP tokens", async function () {
    const { fetchAddress } = await loadFixture(deployEcosystem)
    const eyeDaiAddress = fetchAddress("EYE_DAI")
    const uniswapPairFactory = await ethers.getContractFactory("UniswapV2Pair");
    const eyeDai = uniswapPairFactory.attach(eyeDaiAddress) as Types.ERC20;
    const totalSupply = await eyeDai.totalSupply();
    console.log('total eye dai supply ' + totalSupply.toString())
  });

  it("t2. list a fake token as threshold with positive delta and migrate it successfully to behodler", async function () {
    const { owner, secondPerson, fetchAddress, pauser } = await loadFixture(deployEcosystem)
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
    await broadcast("setting approve token", power.setApprove([aave.address], [true]), pauser)

    const AngbandFactory = await ethers.getContractFactory("Angband")
    const angband = await AngbandFactory.attach(fetchAddress("Angband")) as Types.Angband

    await broadcast("angband execute proposal", angband.executePower(power.address), pauser)

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

    await broadcast("voting on proposal", dao.vote(proposal.address, "1000"), pauser)

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

    console.log(`aave balance owner ${aaveBalanceOwner}, aave balance second person ${aaveBalanceSecondPerson}`);
    //stake user 1
    await broadcast("approving aave for limbo", aave.approve(limbo.address, ethers.constants.MaxUint256), pauser)

    await broadcast("limbo stake 250", limbo.stake(aave.address, parseEther("250")), pauser)
    //stake user 2.
    await broadcast("approving aave for limbo", aave.connect(secondPerson).approve(limbo.address, ethers.constants.MaxUint256), pauser)
    await broadcast("limbo stake second person", limbo.connect(secondPerson).stake(aave.address, parseEther("1100")), pauser);

    //wait 100 seconds
    //revert mining style temporarily
    // await network.provider.send("evm_setAutomine", [false]);
    // await network.provider.send("evm_setIntervalMining", [0]);
    console.log("about to pause for 400000 seconds ");

    await networkHelpers.time.increase(400000)

    console.log("finished pausing");
    //  await network.provider.send("evm_setAutomine", [true]);
    // await network.provider.send("evm_setIntervalMining", [20]);

    //unstake some of user 1, assert flan balance
    await broadcast("unstaking ", limbo.unstake(aave.address, parseEther("100")), pauser);
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
    console.log(`state: ${stats[0]}, stakedBalance: ${stats[1]}`);
    expect(stats[0].toString()).to.equal("1");
    expect(stats[1].toString()).to.equal(parseEther("2000"));

    //stake 1 and cross over
    await limbo.connect(secondPerson).stake(aave.address, parseEther("1"));
    await networkHelpers.time.increase(10)

    const stats2 = await soulReader.soulStats(aave.address, limbo.address);
    console.log(`state: ${stats2[0]}, stakedBalance: ${stats2[1]}`);
    expect(stats2[0].toString()).to.equal("2");
    const stakedAave = ethers.constants.WeiPerEther.mul(2001)
    expect(stats2[1].toString()).to.equal(stakedAave);

    await networkHelpers.time.increase(3600)
    await networkHelpers.mine(1)
    //migrate token to behodler
    const aaveBalanceOnBehodlerBeforeMigrate = await aave.balanceOf(fetchAddress("Behodler"));
    expect(aaveBalanceOnBehodlerBeforeMigrate).to.equal(0);
    await broadcast("migrating on limbo", limbo.migrate(aave.address, 0), pauser);

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

    const RegisterPyroV3PowerInvokerFactory = await ethers.getContractFactory("RegisterPyroTokenV3Power")

    const powerInvoker = await broadcast("deploying RegisterPyro powerinvoker", RegisterPyroV3PowerInvokerFactory.deploy(aave.address, false, angband.address), pauser) as Types.RegisterPyroTokenV3Power
    await broadcast("setting pyroDetails on invoker", powerInvoker.setPyroDetails("PyroAave", "PAAVE"), pauser)
    await broadcast("authorizing invoker ", angband.authorizeInvoker(powerInvoker.address, true), pauser)
    await broadcast("executing power to register pyroAave", angband.executePower(powerInvoker.address), pauser)

    const pyroAaveAddress = await liquidityReceiver.getPyroToken(aave.address)
    console.log('pyroAaveAddress ' + pyroAaveAddress)

    const PyroTokenFactory = await ethers.getContractFactory("PyroToken")

    const pyroAave = await PyroTokenFactory.attach(pyroAaveAddress) as Types.PyroToken

    await expect((await pyroAave.config()).baseToken).to.equal(aave.address)
    await broadcast("Approving pyroAave", aave.approve(pyroAave.address, ethers.constants.MaxUint256), pauser)
    await broadcast("minting pyroAave", pyroAave.mint(owner.address, ethers.constants.WeiPerEther.mul(10)), pauser)
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
    const { owner, secondPerson, fetchAddress, pauser } = await loadFixture(deployEcosystem)


    const ApproveFlanMintingProposalFactory = await ethers.getContractFactory("ApproveFlanMintingProposal")
    const approveFlanMintingProposal = await ApproveFlanMintingProposalFactory.attach(fetchAddress("ApproveFlanMintingProposal")) as Types.ApproveFlanMintingProposal
    await broadcast("parameterize proposal", approveFlanMintingProposal.parameterize(owner.address, true), pauser)

    const LimboDAOFactory = await ethers.getContractFactory("LimboDAO")
    const dao = await LimboDAOFactory.attach(fetchAddress("LimboDAO")) as Types.LimboDAO

    const mockTokenFactory = await ethers.getContractFactory("MockToken")
    const eye = await mockTokenFactory.attach(fetchAddress("EYE")) as Types.MockToken

    await broadcast("approve eye on dao", eye.approve(dao.address, ethers.constants.MaxUint256), pauser)

    const proposalConfig = await dao.proposalConfig()
    await dao.burnAsset(eye.address, proposalConfig.requiredFateStake, true)

    const proposalFactory = (await ethers.getContractFactory("ProposalFactory")).attach(fetchAddress("ProposalFactory")) as Types.ProposalFactory

    await expect(proposalFactory.lodgeProposal(approveFlanMintingProposal.address))
      .to.emit(proposalFactory, "LodgingStatus")
      .withArgs(approveFlanMintingProposal.address, "SUCCESS");

    await broadcast("voting on proposal", dao.vote(approveFlanMintingProposal.address, 100), pauser)

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
    await broadcast("mint flan to owner", flan.mint(owner.address, balanceOfDaiOnBehodler.mul(3)), pauser)

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
    await broadcast("approve flan on cliffFace", flan.approve(flanCliffFace.address, ethers.constants.MaxUint256), pauser)
    await broadcast("seed behodler for cliffFace", flanCliffFace.seedBehodler(balanceOfDaiOnBehodler, owner.address), pauser)

    const proxyHandler = (await ethers.getContractFactory("ProxyHandler")).attach(fetchAddress("ProxyHandler")) as Types.ProxyHandler
    await broadcast("approve flan on proxyHandler", flan.approve(proxyHandler.address, ethers.constants.MaxUint256), pauser)
    await broadcast("once off approve pyroToken for proxy", proxyHandler.approvePyroTokenForProxy(pyroFlan.address), pauser)
    await broadcast("minting 1000 pyroflan", proxyHandler.mintPyroFromBase(pyroFlan.address, ethers.constants.WeiPerEther.mul(1000)), pauser)

    const balanceOfPyroFlan = await pyroFlan.balanceOf(owner.address)
    expect(balanceOfPyroFlan.toString()).to.equal(ethers.constants.WeiPerEther.mul(1000).toString())

    //dump lots of flan via cliff face onto Behodler.
    let changeInDai = BigNumber.from(0)
    let outputAmount = BigNumber.from('330469270000000000000')

    const daiBalancOfOwnerBefore = await dai.balanceOf(owner.address)

    await broadcast(`dump flan into Behodler with ${outputAmount}`, flanCliffFace.swapAsInput(owner.address, dai.address, outputAmount, ethers.constants.WeiPerEther.mul((1000))), pauser)
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
    await broadcast('pyro approve proxyHandler', pyroFlan.approve(proxyHandler.address, ethers.constants.MaxUint256), pauser)
    await broadcast("redeeming pyroFlan", proxyHandler.redeemFromPyro(pyroFlan.address, ownerBalanceOfPyroFlan), pauser)
    const changeInFlan = (await flan.balanceOf(owner.address)).sub(ownerFlanBeforeRedeem)
    logger('changeInFlan', changeInFlan)
    logger('impliedFlan', impliedFlan)
    expect(changeInFlan.toString()).to.equal(impliedFlan)
  })

})


