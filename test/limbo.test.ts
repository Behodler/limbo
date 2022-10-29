import { ContractReceipt } from "ethers";
import { assertLog, deploy, executionResult, numberClose, queryChain } from "./helpers";

const { expect, assert } = require("chai");
const { ethers, network } = require("hardhat");
const web3 = require("web3");
import * as Types from "../typechain";

interface TestContracts {
  limbo: Types.Limbo
  limboDAO: Types.LimboDAO
  uniswapHelper: Types.UniswapHelper
}
describe.only("Limbo", function () {
  let owner, secondPerson, link, sushi;
  let daieyeSLP, linkeyeSLP, sushieyeSLP, daiSushiSLP;
  let daieyeULP, linkeyeULP, sushieyeULP, daiSushiULP;
  let proposalFactory;
  let toggleWhiteList;
  let SET: TestContracts = {} as TestContracts
  const zero = "0x0000000000000000000000000000000000000000";

  beforeEach(async function () {
    [owner, secondPerson, proposalFactory] = await ethers.getSigners();
    const UniswapFactoryFactory = await ethers.getContractFactory("UniswapV2Factory");
    const UniswapPairFactory = await ethers.getContractFactory("UniswapV2Pair");

    this.sushiSwapFactory = await UniswapFactoryFactory.deploy(owner.address);
    this.uniswapFactory = await UniswapFactoryFactory.deploy(owner.address);
    const sanityCheck = sanityCheckMaker(false);
    sanityCheck(this.sushiSwapFactory.address !== this.uniswapFactory.address);

    const RouterFactory = await ethers.getContractFactory("UniswapV2Router02");
    const sushiRouter = await RouterFactory.deploy(this.sushiSwapFactory.address, owner.address);
    const uniRouter = await RouterFactory.deploy(this.uniswapFactory.address, owner.address);
    this.TokenFactory = await ethers.getContractFactory("SimpleMockTokenToken");
    this.dai = await this.TokenFactory.deploy("DAI", "DAI");

    this.aave = await this.TokenFactory.deploy("aave", "aave");
    link = await this.TokenFactory.deploy("LINK", "LINK");
    sushi = await this.TokenFactory.deploy("SUSHI", "SUSHI");
    this.eye = (await this.TokenFactory.deploy("this.eye", "this.eye")) as Types.ERC20Burnable;

    const createSLP = await metaPairFactory(this.eye, this.sushiSwapFactory, false);
    daieyeSLP = await createSLP(this.dai);
    linkeyeSLP = await createSLP(link);
    sushieyeSLP = await createSLP(sushi);

    const createDAISLP = await metaPairFactory(this.dai, this.sushiSwapFactory);
    daiSushiSLP = await createDAISLP(sushi);

    const createULP = await metaPairFactory(this.eye, this.uniswapFactory);
    daieyeULP = await createULP(this.dai);
    linkeyeULP = await createULP(link);
    sushieyeULP = await createULP(sushi);

    const createDAIULP = await metaPairFactory(this.dai, this.uniswapFactory);
    daiSushiULP = await createDAIULP(sushi);

    const MockAngband = await ethers.getContractFactory("MockAngband");
    this.mockAngband = await MockAngband.deploy();

    const MockBehodlerFactory = await ethers.getContractFactory("MockBehodler");
    this.mockBehodler = await MockBehodlerFactory.deploy("Scarcity", "SCX");
    this.SCX = this.mockBehodler;
    const SafeERC20Factory = await ethers.getContractFactory("SafeERC20");
    const daoFactory = await ethers.getContractFactory("LimboDAO");

    SET.limboDAO = await daoFactory.deploy() as Types.LimboDAO;
    const flashGovernanceFactory = await ethers.getContractFactory("FlashGovernanceArbiter");
    this.flashGovernance = await flashGovernanceFactory.deploy(SET.limboDAO.address);

    await SET.limboDAO.setFlashGoverner(this.flashGovernance.address);
    const tempConfigLord = await this.flashGovernance.temporaryConfigurationLord();

    await this.flashGovernance.configureSecurityParameters(10, 100, 30);

    // await this.eye.approve(SET.limbo.address, 2000);
    await this.flashGovernance.configureFlashGovernance(this.eye.address, 1000, 10, true);

    const FlanFactory = await ethers.getContractFactory("Flan");
    this.flan = await FlanFactory.deploy(SET.limboDAO.address);
    await this.flan.setMintConfig("100000000000000000000000000000000000", 0);
    const createGov = await metaPairFactory(this.SCX, this.uniswapFactory, false);
    await this.flan.mint(owner.address, "100000000000000000000000");
    //we need Dai/SCX, FLN/SCX and SCX/(FLN/SCX)
    this.flanSCX = await createGov(this.flan);
    this.daiSCX = await createGov(this.dai);

    const CreateMetaflanSCX = await metaPairFactory(this.flanSCX, this.uniswapFactory, false);
    const SCX_fln_scx = await CreateMetaflanSCX(this.SCX);

    const token0 = await SCX_fln_scx.token0();
    const token1 = await SCX_fln_scx.token1();
    [token0, token1].forEach((token, i) => {
      sanityCheck(
        token === this.flanSCX.address || token === this.SCX.address,
        `MetaFlanSCX pair incorrectly setup. Token: ${token}, this.flanSCX: ${this.flanSCX.address}, SCX: ${this.SCX.address}`,
        "LP of SCX / (FLN/SCX) successfully tested for token " + i
      ); //Uniswap checks for token0===token1 so no need for me to replicate that
    });

    await simpleTrade(this.dai, this.daiSCX);
    await simpleTrade(this.SCX, this.flanSCX);
    await simpleTrade(this.SCX, SCX_fln_scx);

    const SoulLib = await ethers.getContractFactory("SoulLib");
    const CrossingLib = await ethers.getContractFactory("CrossingLib");
    const MigrationLib = await ethers.getContractFactory("MigrationLib");
    const LimboFactory = await ethers.getContractFactory("Limbo", {
      libraries: {
        SoulLib: (await SoulLib.deploy()).address,
        CrossingLib: (await CrossingLib.deploy()).address,
        MigrationLib: (await MigrationLib.deploy()).address,
      },
    });
    SET.limbo = await LimboFactory.deploy(
      this.flan.address,
      //  10000000,
      SET.limboDAO.address
    ) as Types.Limbo;

    //enable flash governance on Limbo
    await this.flashGovernance.setGoverned([SET.limbo.address], [true]);

    await this.flan.whiteListMinting(SET.limbo.address, true);
    await this.flan.whiteListMinting(owner.address, true);
    // await this.flan.endConfiguration(SET.limboDAO.address);

    const addTokenPowerFactory = await ethers.getContractFactory("MockAddTokenPower");
    this.addTokenPower = await addTokenPowerFactory.deploy(
      this.mockAngband.address,
      SET.limbo.address,
      "0x0000000000000000000000000000000000000000"
    );

    await this.addTokenPower.seed(this.mockBehodler.address, SET.limbo.address);

    await this.SCX.setTokenPower(this.addTokenPower.address);
    const firstProposalFactory = await ethers.getContractFactory("ToggleWhitelistProposalProposal");
    this.whiteListingProposal = await firstProposalFactory.deploy(SET.limboDAO.address, "toggle whitelist");

    const LimboOracleFactory = await ethers.getContractFactory("LimboOracle");
    this.sushiOracle = await LimboOracleFactory.deploy(this.sushiSwapFactory.address, SET.limboDAO.address);
    this.uniOracle = await LimboOracleFactory.deploy(this.uniswapFactory.address, SET.limboDAO.address);

    await this.uniOracle.RegisterPair(this.flanSCX.address, 1);
    await this.uniOracle.RegisterPair(this.daiSCX.address, 1);
    await this.uniOracle.RegisterPair(SCX_fln_scx.address, 1);

    const sushiMetaPairCreator = await metaPairFactory(this.eye, this.sushiSwapFactory, false);
    this.metadaieyeSLP = await sushiMetaPairCreator(daieyeSLP);
    this.metalinkeyeSLP = await sushiMetaPairCreator(linkeyeSLP);
    this.metasushieyeSLP = await sushiMetaPairCreator(sushieyeSLP);

    const uniMetaPairCreator = await metaPairFactory(this.eye, this.uniswapFactory);
    this.metadaieyeULP = await uniMetaPairCreator(daieyeULP);
    this.metalinkeyeULP = await uniMetaPairCreator(linkeyeULP);
    this.metasushieyeULP = await uniMetaPairCreator(sushieyeULP);

    this.sushiTrade = await tradeOn(sushiRouter, this.eye);
    await this.sushiTrade(this.dai);
    await this.sushiTrade(link);
    await this.sushiTrade(sushi);

    this.uniTrade = await tradeOn(uniRouter, this.eye);
    await this.uniTrade(this.dai);
    await this.uniTrade(link);
    await this.uniTrade(sushi);

    await advanceTime(10000);

    const morgothTokenApproverFactory = await ethers.getContractFactory("MockMorgothTokenApprover");

    this.morgothTokenApprover = await morgothTokenApproverFactory.deploy();
    const soulUpdateProposalFactory = await ethers.getContractFactory("UpdateSoulConfigProposal");
    this.soulUpdateProposal = await soulUpdateProposalFactory.deploy(
      SET.limboDAO.address,
      "hello",
      SET.limbo.address,
      this.morgothTokenApprover.address
    );

    //  const flanSCXPair = await this.sushiSwapFactory.
    this.ProposalFactoryFactory = await ethers.getContractFactory("ProposalFactory");
    this.proposalFactory = await this.ProposalFactoryFactory.deploy(
      SET.limboDAO.address,
      this.whiteListingProposal.address,
      this.soulUpdateProposal.address
    );

    await SET.limboDAO.seed(
      SET.limbo.address,
      this.flan.address,
      this.eye.address,
      this.proposalFactory.address,
      this.sushiOracle.address,
      this.uniOracle.address,
      [this.metadaieyeSLP.address, this.metalinkeyeSLP.address, this.metasushieyeSLP.address],
      [this.metadaieyeULP.address, this.metalinkeyeULP.address, this.metasushieyeULP.address]
    );

    const allAssets = [
      daieyeSLP,
      linkeyeSLP,
      sushieyeSLP,
      daiSushiSLP,
      daieyeULP,
      linkeyeULP,
      sushieyeULP,
      daiSushiULP,
      this.eye,
    ];
    for (let i = 0; i < allAssets.length; i++) {
      await allAssets[i].approve(
        SET.limboDAO.address,
        "115792089237316195423570985008687907853269984665640564039457584007913129639935"
      );
    }
    await SET.limbo.setDAO(SET.limboDAO.address);

    await SET.limboDAO.makeLive();

    const SoulReaderFactory = await ethers.getContractFactory("SoulReader");
    this.soulReader = await SoulReaderFactory.deploy() as Types.SoulReader;

    const UniswapHelperFactory = await ethers.getContractFactory("UniswapHelper");
    SET.uniswapHelper = await UniswapHelperFactory.deploy(SET.limbo.address, SET.limboDAO.address) as Types.UniswapHelper
    await this.flan.whiteListMinting(SET.uniswapHelper.address, true);

    const migrationTokenPairFactory = await ethers.getContractFactory("MockMigrationUniPair");
    this.migrationTokenPair = await migrationTokenPairFactory.deploy("uni", "uni");
    await this.migrationTokenPair.setReserves(1000, 3000);

    await SET.uniswapHelper.setDAI(this.dai.address);
    await advanceTime(1000);
    await SET.uniswapHelper.configure(
      SET.limbo.address,
      this.mockBehodler.address,
      this.flan.address,
      0,
      this.uniOracle.address
    );

    await SET.limbo.configureCrossingParameters(this.aave.address, 1, 1, true, 10000010);

    await SET.limbo.configureCrossingConfig(
      this.mockBehodler.address,
      this.mockAngband.address,
      SET.uniswapHelper.address,
      this.addTokenPower.address,
      10000000,
      10000
    );

    toggleWhiteList = toggleWhiteListFactory(this.eye, SET.limboDAO, this.whiteListingProposal, this.proposalFactory);

    const TokenProxyRegistry = await ethers.getContractFactory("TokenProxyRegistry");
    this.registry = await TokenProxyRegistry.deploy(
      SET.limboDAO.address,
      this.mockBehodler.address
    );
    console.log("end of setup");
  });

  const advanceTime = async (seconds) => {
    await network.provider.send("evm_increaseTime", [seconds]); //6 hours
    await network.provider.send("evm_mine");
  };

  const advanceBlocks = async (blocks) => {
    for (let i = 0; i < blocks; i++) {
      await network.provider.send("evm_mine");
    }
  };

  const stringifyBigNumber = (b) => b.map((i) => i.toString());

  var toggleWhiteListFactory = (eye, dao, whiteListingProposal, proposalFactory) => {
    return async function (contractToToggle) {
      await whiteListingProposal.parameterize(proposalFactory.address, contractToToggle);
      const requiredFateToLodge = (await dao.proposalConfig())[1];

      await eye.mint(requiredFateToLodge);
      await eye.approve(dao.address, requiredFateToLodge.mul(2));
      await dao.burnAsset(eye.address, requiredFateToLodge.div(5).add(10), false);

      await proposalFactory.lodgeProposal(whiteListingProposal.address);
      await dao.vote(whiteListingProposal.address, "100");
      await advanceTime(100000000);
      await dao.executeCurrentProposal();
    };
  };

  const logFactory = (log) => {
    let counter = 0;
    return (message) => {
      if (log) console.log(`${counter++}: ${message}`);
    };
  };

  const sanityCheckMaker = (canLog) => (condition: boolean, fail_message?: string, success_message?: string) => {
    const logger = logFactory(canLog);
    if (!condition) throw fail_message;
    success_message = !success_message ? "" : " : " + success_message;
    logger(`SANITY CHECK PASSED${success_message}`);
  };

  const metaPairFactory = async (eye, factory, canLog?: boolean) => {
    const log = logFactory(canLog);
    const UniswapFactoryFactory = await ethers.getContractFactory("UniswapV2Factory");
    const uniFactory = await UniswapFactoryFactory.attach(factory.address) as Types.UniswapV2Factory;
    const nameLogger = printNamedAddress(canLog);
    let eyeBase = 1;
    return async (LP) => {
      log("*********metapair************");
      await nameLogger(eye.address, "outer token");
      await nameLogger(LP.address, "inner token");
      const length = await uniFactory.allPairsLength();
      await uniFactory.createPair(eye.address, LP.address);
      const metaPairAddress = await uniFactory.getPair(eye.address, LP.address);
      if (metaPairAddress.startsWith("0x00000000000000"))
        throw `metaPair creation failed:meta: ${metaPairAddress}, eye: ${eye.address}, LP:${LP.address}`
      await nameLogger(metaPairAddress, "metapair");

      const LPBalance = await LP.balanceOf(owner.address);
      log(`LP balance ${await LP.balanceOf(owner.address)}, eye balance ${await eye.balanceOf(owner.address)}`);

      await LP.transfer(metaPairAddress, LPBalance.div(10));

      const eyeBalance = await eye.balanceOf(owner.address);

      log("eye balance " + (await eye.balanceOf(owner.address)).toString());
      await eye.transfer(metaPairAddress, `${eyeBalance.div(10)}`);
      log("post transfer");
      const PairFactory = await ethers.getContractFactory("UniswapV2Pair");
      const metaPair = await PairFactory.attach(metaPairAddress);
      log("mint");
      await metaPair.mint(owner.address);
      log("post mint");
      log("*********end metapair************");
      return metaPair;
    };
  };

  const getPairMaker = (factory, sanityCheck) => async (token0, token1) => {
    sanityCheck(
      !!token0.address && !!token1.address,
      "pass ERC20s, not strings",
      "passed tokens rather than addresses"
    );
    const pairAddress = await factory.getPair(token0.address, token1.address);
    const UniswapV2PairFactory = await ethers.getContractFactory("UniswapV2Pair");
    return UniswapV2PairFactory.at(pairAddress);
  };

  const simpleTrade = async (inputToken, pair) => {
    const balanceOfInputBefore = await inputToken.balanceOf(owner.address);
    expect(balanceOfInputBefore.gt(100000)).to.be.true;
    await inputToken.transfer(pair.address, balanceOfInputBefore.div(100));
    try {
      await pair.swap("0", balanceOfInputBefore.div(10000), owner.address, []);
    } catch (e) {
      try {
        await pair.swap(balanceOfInputBefore.div(10000), "0", owner.address, []); // ordering issue
      } catch (inner) {
        throw "simpleTrade failed " + inner; // get 5stake trace
      }
    }
    //
    const balanceOfInptAfter = await inputToken.balanceOf(owner.address);

    expect(balanceOfInptAfter.lte(balanceOfInputBefore)).to.be.true;
  };

  const tradeOn = async (router, commonToken) => {
    return async (inputToken, canLog) => {
      const log = logFactory(canLog);
      log("*********************************" + "\n" + "TRADEON" + "\n" + "****************************************");
      const namedLogger = printNamedAddress(canLog);
      const factoryAddress = await router.factory();
      const UniswapFactoryFactory = await ethers.getContractFactory("UniswapV2Factory");
      const UniswapPairFactory = await ethers.getContractFactory("UniswapV2Pair");

      const uniFactory = await UniswapFactoryFactory.attach(factoryAddress);

      await namedLogger(inputToken.address, "inputToken");
      await namedLogger(commonToken.address, "commonToken");

      const baseAddress = await uniFactory.getPair(inputToken.address, commonToken.address);

      //   if (govTrade) throw "code works to this point";
      //  log("not gov trade");

      const metaPairAddress = await uniFactory.getPair(baseAddress, commonToken.address);
      log(`baseAddress ${baseAddress}, metaPairAddress ${metaPairAddress}`);

      const uniPair = await UniswapPairFactory.attach(baseAddress);
      await inputToken.transfer(baseAddress, "1000000000000000000000");
      await uniPair.swap("0", "10000000000000000000", owner.address, []);

      //trade metaLP
      const metaPair = await UniswapPairFactory.attach(metaPairAddress);

      await commonToken.transfer(metaPairAddress, "1000000000000000000000");
      await metaPair.swap("0", "10000000000000000000", owner.address, []);
      advanceTime(10000);
      log("END TRADE ON");
      log("");
    };
  };

  const printNamedAddress = (log) => async (address, prefix) => {
    prefix = prefix === undefined ? "" : prefix + ": ";
    const logger = logFactory(log);
    try {
      const token = await (await ethers.getContractFactory("SimpleMockTokenToken")).attach(address);
      const name = await token.name();
      logger(`${prefix}token: ${name}, address: ${address}`);
    } catch {
      logger(prefix + "null address");
    }
  };

  //TESTS START

  it("t-0. test setup", async function () { })

  it("t-1. governance actions free to be invoked until configured set to true", async function () {
    //first invoke all of these successfully, then set config true and try again

    //onlySuccessfulProposal:
    //configureSoul
    await SET.limbo.configureSoul(this.aave.address, 10000000, 0, 0, 0, 10000000);
    await this.aave.transfer(SET.limbo.address, 1000);
    //enableProtocol
    await SET.limbo.enableProtocol();

    //governanceShutdown
    await SET.limbo.adjustSoul(this.aave.address, 1, 0, 10);
    //withdrawERC20
    await SET.limbo.configureCrossingConfig(
      this.mockBehodler.address,
      this.mockAngband.address,
      SET.uniswapHelper.address,
      this.addTokenPower.address,
      10000000,
      10000
    );

    //governanceApproved:
    //disableProtocol
    await SET.limbo.disableProtocol();
    await SET.limbo.enableProtocol();
    //adjustSoul
    await SET.limbo.adjustSoul(this.aave.address, 1, 0, 10);
    //configureCrossingParameters

    await SET.limbo.configureCrossingParameters(this.aave.address, 1, 1, true, 10000010);

    await SET.limbo.endConfiguration(SET.limboDAO.address);

    await expect(SET.limbo.configureSoul(this.aave.address, 10000000, 0, 0, 0, 10000000)).to.be.revertedWith(
      "GovernanceActionFailed"
    );
    await this.aave.transfer(SET.limbo.address, 1000);
    // enableProtocol

    await expect(SET.limbo.enableProtocol()).to.be.revertedWith("GovernanceActionFailed");
    // governanceShutdown
    // configureCrossingConfig
    await expect(
      SET.limbo.configureCrossingConfig(
        this.mockBehodler.address,
        this.mockAngband.address,
        SET.uniswapHelper.address,
        this.addTokenPower.address,
        10000000,
        10000
      )
    ).to.be.revertedWith("GovernanceActionFailed");

    //governanceApproved:
    //disableProtocol
    await expect(SET.limbo.disableProtocol()).to.be.revertedWith("AllowanceExceeded(0, 1000)");
    await expect(SET.limbo.enableProtocol()).to.be.revertedWith("GovernanceActionFailed");
    //adjustSoul
    await expect(SET.limbo.adjustSoul(this.aave.address, 1, 0, 10)).to.be.revertedWith("AllowanceExceeded(0, 1000)");
    //configureCrossingParameters

    await expect(SET.limbo.configureCrossingParameters(this.aave.address, 1, 1, true, 10000010)).to.be.revertedWith(
      "AllowanceExceeded(0, 1000)"
    );
  });

  it("t-2. old souls can be claimed from", async function () {
    //make a threshold pool.
    await SET.limbo.configureSoul(this.aave.address, 10000000, 1, 1, 0, 10000000);
    await SET.limbo.endConfiguration(SET.limboDAO.address);

    const flanBalanceBefore = await this.flan.balanceOf(owner.address);

    //stake tokens
    await this.aave.approve(SET.limbo.address, "10000001");
    await SET.limbo.stake(this.aave.address, "10000");
    //fast forward time
    await advanceTime(90000); //just over a day

    //stake enough tokens to cross threshold
    await SET.limbo.stake(this.aave.address, "9990001");
    const flanImmediatelyAfterSecondStake = await this.flan.balanceOf(owner.address);
    const flanBalanceChangeAgterSecondStake = flanImmediatelyAfterSecondStake.sub(flanBalanceBefore);
    assert.isTrue(flanBalanceChangeAgterSecondStake.gt("900000000000") && flanBalanceChangeAgterSecondStake.lt("900050000000"), flanBalanceChangeAgterSecondStake.toString())

    //assert soul state change
    const stats = await this.soulReader.SoulStats(this.aave.address, SET.limbo.address);
    expect(stats[0].toString()).to.equal("2");
    expect(stats[1].toString()).to.equal("10000001");
    //claim

    await SET.limbo.claimReward(this.aave.address, 0);
    const flanBalanceAfter = await this.flan.balanceOf(owner.address);

    expect(flanBalanceAfter.sub(flanImmediatelyAfterSecondStake).toString()).to.equal("0");
  });

  it("t-3. old souls can be bonus claimed from (DELTA = 0)", async function () {
    //make a threshold pool.
    await SET.limbo.configureSoul(this.aave.address, 10000000, 1, 1, 0, 10000000);

    await SET.limbo.configureCrossingParameters(this.aave.address, 21000000, 0, true, 10000000);

    await SET.limbo.endConfiguration(SET.limboDAO.address);

    const flanBalanceBefore = await this.flan.balanceOf(owner.address);

    //stake tokens
    await this.aave.approve(SET.limbo.address, "10000001");
    await SET.limbo.stake(this.aave.address, "10000");
    //fast forward time
    await advanceTime(90000); //just over a day

    //stake enough tokens to cross threshold
    await SET.limbo.stake(this.aave.address, "9990001");

    //assert soul state change
    const stats = await this.soulReader.SoulStats(this.aave.address, SET.limbo.address);
    expect(stats[0].toString()).to.equal("2");
    expect(stats[1].toString()).to.equal("10000001");
    //claim

    await SET.limbo.claimBonus(this.aave.address, 0);

    const flanBalanceAfter = await this.flan.balanceOf(owner.address);
    const lowerLimit = BigInt("900000000210");
    const upperLimit = BigInt("900020000210");
    const difference = BigInt(flanBalanceAfter.sub(flanBalanceBefore).toString());
    assert.isTrue(difference >= lowerLimit && difference <= upperLimit);
  });

  it("t-4. old souls can be bonus claimed from (DELTA > 0)", async function () {
    //make a threshold pool.
    await SET.limbo.configureSoul(this.aave.address, 10000000, 1, 1, 0, 10000000);

    await SET.limbo.configureCrossingParameters(this.aave.address, 21000000, 10000000, true, 10000000);

    await SET.limbo.endConfiguration(SET.limboDAO.address);

    const flanBalanceBefore = await this.flan.balanceOf(owner.address);
    //stake tokens
    await this.aave.approve(SET.limbo.address, "10000001");
    await SET.limbo.stake(this.aave.address, "10000");
    //fast forward time
    await advanceTime(90000); //just over a day

    //stake enough tokens to cross threshold
    await SET.limbo.stake(this.aave.address, "9990001");
    //assert soul state change
    const stats = await this.soulReader.SoulStats(this.aave.address, SET.limbo.address);
    expect(stats[0].toString()).to.equal("2");
    expect(stats[1].toString()).to.equal("10000001");

    await SET.limbo.claimBonus(this.aave.address, 0);

    const flanBalanceAfter = await this.flan.balanceOf(owner.address);
    const increase = flanBalanceAfter.sub(flanBalanceBefore);
    let numberCloseResult = numberClose(increase, 900019000410)
    assert.isTrue(numberCloseResult.close, numberCloseResult.message)
  });

  it("t-5. old souls can be bonus claimed from (DELTA < 0)", async function () {
    //make a threshold pool.
    await SET.limbo.configureSoul(this.aave.address, 10000000, 1, 1, 0, 10000000);

    await SET.limbo.configureCrossingParameters(this.aave.address, 20000000000, "-1000", true, 10000000);

    await SET.limbo.endConfiguration(SET.limboDAO.address);

    const flanBalanceBefore = await this.flan.balanceOf(owner.address);

    //stake tokens
    await this.aave.approve(SET.limbo.address, "10000001");
    await SET.limbo.stake(this.aave.address, "10000");
    //fast forward time
    await advanceTime(44000); //half a day

    //stake enough tokens to cross threshold
    await SET.limbo.stake(this.aave.address, "9990001");
    //assert soul state change
    const stats = await this.soulReader.SoulStats(this.aave.address, SET.limbo.address);
    expect(stats[0].toString()).to.equal("2");
    expect(stats[1].toString()).to.equal("10000001");

    await SET.limbo.claimBonus(this.aave.address, 0);

    const flanBalanceAfter = await this.flan.balanceOf(owner.address);
    const lowerBound = "440010199559";
    const upperBound = "440030199559";
    const change = flanBalanceAfter.sub(flanBalanceBefore);
    const gtLB = change.gte(lowerBound);
    const ltUP = change.lte(upperBound);
    expect(gtLB && ltUP).to.be.true;
  });

  it("t-6. perpetual pools have no upper limit", async function () {
    //make a threshold pool.
    await SET.limbo.configureSoul(this.aave.address, 10000000, 2, 1, 0, 10000000);

    await SET.limbo.configureCrossingParameters(this.aave.address, 20000000000, "-1000", true, 10000000);

    await SET.limbo.endConfiguration(SET.limboDAO.address);

    await this.aave.approve(SET.limbo.address, "10000001");
    await SET.limbo.stake(this.aave.address, "10000001");

    const stats = await this.soulReader.SoulStats(this.aave.address, SET.limbo.address);
    expect(stats[0].toNumber()).to.equal(1);
  });

  it("t-7. use flashGovernance to adjustSoul", async function () {
    //configure soul
    await SET.limbo.configureSoul(this.aave.address, 10000000, 1, 1, 0, 10000000);

    await SET.limbo.configureCrossingParameters(this.aave.address, 20000000000, "-1000", true, 10000000);

    //set flash loan params
    await this.flashGovernance.configureFlashGovernance(
      this.eye.address,
      21000000, //amount to stake
      604800, //lock duration = 1 week,
      true // asset is burnable
    );
    await this.flashGovernance.endConfiguration(SET.limboDAO.address);
    //end configuration
    await SET.limbo.endConfiguration(SET.limboDAO.address);

    //try to adjust soul and fail
    await expect(SET.limbo.adjustSoul(this.aave.address, 1, 10, 200)).to.be.revertedWith("AllowanceExceeded(0, 21000000)");

    //stake requisite tokens, try again and succeed.
    await this.eye.approve(this.flashGovernance.address, 21000000);
    await SET.limbo.adjustSoul(this.aave.address, 20000000001, -1001, 10000001);

    const newStates = await this.soulReader.CrossingParameters(this.aave.address, SET.limbo.address);

    //assert newStates
    const stringNewStates = stringifyBigNumber(newStates);
    expect(stringNewStates[0]).to.equal("20000000001");
    expect(stringNewStates[1]).to.equal("-1001");
  });

  it("t-8. flashGovernance adjust configureCrossingParameters", async function () {
    //set flash loan params
    await this.flashGovernance.configureFlashGovernance(
      this.eye.address,
      21000000, //amount to stake
      604800, //lock duration = 1 week,
      true // asset is burnable
    );
    await this.flashGovernance.endConfiguration(SET.limboDAO.address);
    //end configuration
    await SET.limbo.endConfiguration(SET.limboDAO.address);
    await this.eye.approve(this.flashGovernance.address, 21000000);
    await SET.limbo.configureCrossingParameters(this.aave.address, 1, 1, true, 10000010);

    await expect(this.flashGovernance.withdrawGovernanceAsset(SET.limbo.address, this.eye.address)).to.be.revertedWith(
      "FlashDecisionPending"
    );

    await advanceTime(604801);

    this.eyeBalanceBefore = await this.eye.balanceOf(owner.address);
    await this.flashGovernance.withdrawGovernanceAsset(SET.limbo.address, this.eye.address);
    this.eyeBalanceAfter = await this.eye.balanceOf(owner.address);

    expect(this.eyeBalanceAfter.sub(this.eyeBalanceBefore).toString()).to.equal("21000000");
  });

  it("t-9. burn asset for flashGov decision", async function () {
    //set flash loan params
    await this.flashGovernance.configureFlashGovernance(
      this.eye.address,
      21000000, //amount to stake
      604800, //lock duration = 1 week,
      true // asset is burnable
    );
    await this.flashGovernance.endConfiguration(SET.limboDAO.address);
    //end configuration
    await SET.limbo.endConfiguration(SET.limboDAO.address);

    //make flashgovernance decision.
    await this.eye.approve(this.flashGovernance.address, 21000000);

    // //we need fate to lodge proposal.
    const requiredFate = (await SET.limboDAO.proposalConfig())[1];
    this.eyeToBurn = requiredFate.mul(2).div(10).add(1);
    await this.eye.approve(SET.limboDAO.address, this.eyeToBurn.mul(100));
    await SET.limboDAO.burnAsset(this.eye.address, this.eyeToBurn, false);

    //configure and lodge proposal
    const burnFlashStakeProposalFactory = await ethers.getContractFactory("BurnFlashStakeDeposit");
    const burnFlashStakeProposal = await burnFlashStakeProposalFactory.deploy(SET.limboDAO.address, "burnFlash");
    await burnFlashStakeProposal.parameterize(
      owner.address,
      this.eye.address,
      "21000000",
      this.flashGovernance.address,
      SET.limbo.address
    );

    await toggleWhiteList(burnFlashStakeProposal.address);

    this.eyeBefore = await this.eye.balanceOf(owner.address);
    await SET.limbo.configureCrossingParameters(this.aave.address, 1, 1, true, 10000010);
    this.eyeAfter = await this.eye.balanceOf(owner.address);

    expect(this.eyeBefore.sub(this.eyeAfter).toString()).to.equal("21000000");

    //assert pendingFlashDecision before
    const pendingFlashDecisionBeforeQuery = await queryChain(
      this.flashGovernance.pendingFlashDecision(SET.limbo.address, owner.address)
    );
    expect(pendingFlashDecisionBeforeQuery.success).to.equal(true, pendingFlashDecisionBeforeQuery.error);

    const pendingFlashDecisionBefore = pendingFlashDecisionBeforeQuery.result;
    expect(pendingFlashDecisionBefore[0]).to.equal("21000000");
    let numberCloseResult = numberClose(pendingFlashDecisionBefore[1], 1754463648)
    assert.isTrue(numberCloseResult.close, numberCloseResult.message)
    expect(pendingFlashDecisionBefore[2]).to.equal(this.eye.address);
    expect(pendingFlashDecisionBefore[3]).to.equal(true);
    //assert pendingFlashDecision after

    await this.proposalFactory.lodgeProposal(burnFlashStakeProposal.address);
    let currentProposal = (await SET.limboDAO.currentProposalState())[4];
    expect(currentProposal.toString() !== "0x0000000000000000000000000000000000000000").to.be.true;

    //get more fate to vote
    await SET.limboDAO.burnAsset(this.eye.address, "10000", false);

    //vote on proposal
    await SET.limboDAO.vote(burnFlashStakeProposal.address, "10000");

    const flashGovConfig = await this.flashGovernance.flashGovernanceConfig();
    const advancement = flashGovConfig[1].sub(1000);
    //fast forward time to after voting round finishes but before flash asset unlocked
    await advanceTime(advancement.toNumber()); //more time

    //assert this.eye locked for user
    const pendingBeforeAttempt = await this.flashGovernance.pendingFlashDecision(SET.limbo.address, owner.address);
    expect(pendingBeforeAttempt[0].toString()).to.equal("21000000");

    //try to withdraw flash gov asset and fail. Assert money still there
    await expect(this.flashGovernance.withdrawGovernanceAsset(SET.limbo.address, this.eye.address)).to.be.revertedWith(
      "FlashDecisionPending"
    );

    //execute burn proposal

    this.eyeTotalsupplyBefore = await this.eye.totalSupply();
    this.eyeInFlashGovBefore = await this.eye.balanceOf(this.flashGovernance.address);

    await SET.limboDAO.executeCurrentProposal();

    this.eyeInFlashGovAfter = await this.eye.balanceOf(this.flashGovernance.address);
    this.eyeTotalsupplyAfter = await this.eye.totalSupply();

    //assert this.eye has declined by 21000000
    expect(this.eyeInFlashGovBefore.sub(this.eyeInFlashGovAfter).toString()).to.equal("21000000");
    expect(this.eyeTotalsupplyBefore.sub(this.eyeTotalsupplyAfter).toString()).to.equal("21000000");

    //assert pendingFlashDecision after
    const pendingFlashDecisionAfterQuery = await queryChain(
      this.flashGovernance.pendingFlashDecision(SET.limbo.address, owner.address)
    );
    expect(pendingFlashDecisionAfterQuery.success).to.equal(true, pendingFlashDecisionAfterQuery.error);

    const pendingFlashDecisionAfter = pendingFlashDecisionAfterQuery.result;
    expect(pendingFlashDecisionAfter[0]).to.equal("0");
    expect(pendingFlashDecisionAfter[1]).to.equal("0");
    expect(pendingFlashDecisionAfter[2]).to.equal("0x0000000000000000000000000000000000000000");
    expect(pendingFlashDecisionAfter[3]).to.equal(false);
  });

  it("t-10. unstaking rewards user correctly and sets unclaimed to zero", async function () {
    //make a threshold pool.
    await SET.limbo.configureSoul(
      this.aave.address,
      10000000, //crossingThreshold
      1, //soulType
      1, //state
      0,
      10000000
    );
    await SET.limbo.endConfiguration(SET.limboDAO.address);

    //stake tokens
    await this.aave.approve(SET.limbo.address, "10000001");
    await SET.limbo.stake(this.aave.address, "10000");

    await advanceTime(400000);

    const userInfoBeforeUntake = await SET.limbo.userInfo(this.aave.address, owner.address, 0);
    expect(userInfoBeforeUntake[0].toNumber()).to.equal(10000);

    const expectedFlanLowerbound = Number((10000000n * 400001n) / 1000000n);

    const userFlanBalanceBefore = await this.flan.balanceOf(owner.address);
    const expectedFlanUpperbound = Number((10000000n * 400006n) / 1000000n);

    await SET.limbo.unstake(this.aave.address, 4000);
    const userFlanBalanceAfter = await this.flan.balanceOf(owner.address);

    const userInfoAfterUnstake = await SET.limbo.userInfo(this.aave.address, owner.address, 0);

    const actualFlanDiff = userFlanBalanceAfter.sub(userFlanBalanceBefore).div(1000000).toNumber();

    expect(actualFlanDiff).to.be.greaterThanOrEqual(expectedFlanLowerbound);
    expect(actualFlanDiff).to.be.lessThanOrEqual(expectedFlanUpperbound);

    expect(userInfoAfterUnstake[0].toNumber()).to.equal(6000);
  });

  it("t-11. staking and claim for multiple stakers divides reward correctly", async function () {
    //make a threshold pool.
    await SET.limbo.configureSoul(
      this.aave.address,
      10000000, //crossingThreshold
      1, //soulType
      1, //state
      0,
      10000000
    );
    await SET.limbo.endConfiguration(SET.limboDAO.address);

    //stake tokens
    await this.aave.approve(SET.limbo.address, "10000001");
    await SET.limbo.stake(this.aave.address, "10000");
    await this.aave.transfer(secondPerson.address, 2000);
    await this.aave.connect(secondPerson).approve(SET.limbo.address, "10000001");
    await SET.limbo.connect(secondPerson).stake(this.aave.address, 2000);

    await advanceTime(400000);

    const userFlanBalanceBefore = await this.flan.balanceOf(owner.address);

    await SET.limbo.unstake(this.aave.address, 4000);
    const userFlanBalanceAfter = await this.flan.balanceOf(owner.address);

    const userInfoAfterUnstake = await SET.limbo.userInfo(this.aave.address, owner.address, 0);

    const changeInFlan = userFlanBalanceAfter.sub(userFlanBalanceBefore).div("10000000").toNumber();
    const lowerBound = 333335;
    const upperBound = 333339;
    assert.isAbove(changeInFlan, lowerBound);
    assert.isBelow(changeInFlan, upperBound);

    expect(userInfoAfterUnstake[0].toNumber()).to.equal(6000);
  });

  it("t-12. manually setting fps changes reward", async function () {
    //make a threshold pool.
    await SET.limbo.configureSoul(
      this.aave.address,
      10000000, //crossingThreshold
      1, //soulType
      1, //state
      0,
      2500000
    );
    await SET.limbo.endConfiguration(SET.limboDAO.address);

    //stake tokens
    await this.aave.approve(SET.limbo.address, "10000001");
    await SET.limbo.stake(this.aave.address, "10000");

    await advanceTime(400000);

    const userInfoBeforeUntake = await SET.limbo.userInfo(this.aave.address, owner.address, 0);
    expect(userInfoBeforeUntake[0].toNumber()).to.equal(10000);

    const flanPerSecond = 10000000n;
    const expectedFlanLowerRange = Number((flanPerSecond * 400001n) / (4n * 1000000n)); // quarter rewards because sharing with other token

    const expectedFlanUpperRange = Number((flanPerSecond * 400003n) / (4n * 1000000n)); // quarter rewards because sharing with other token

    const userFlanBalanceBefore = await this.flan.balanceOf(owner.address);

    await SET.limbo.unstake(this.aave.address, 4000);
    const userFlanBalanceAfter = await this.flan.balanceOf(owner.address);

    const userInfoAfterUnstake = await SET.limbo.userInfo(this.aave.address, owner.address, 0);

    const actualFlanDiff = userFlanBalanceAfter.sub(userFlanBalanceBefore).div(1000000).toNumber();

    expect(actualFlanDiff).to.be.greaterThanOrEqual(expectedFlanLowerRange);
    expect(actualFlanDiff).to.be.lessThanOrEqual(expectedFlanUpperRange);
    expect(userInfoAfterUnstake[0].toNumber()).to.equal(6000);
  });

  it("t-13. staking only possible in staking state, unstaking possible in staking,crossedOver", async function () {

    await SET.limbo.configureSoul(
      this.aave.address,
      1000, //crossingThreshold
      1, //soulType
      0, //state
      0,
      10000000
    );
    await expect(SET.limbo.stake(this.aave.address, "10000")).to.be.revertedWith("InvalidSoulState")

    await SET.limbo.configureSoul(
      this.aave.address,
      1000, //crossingThreshold
      1, //soulType
      1, //state
      0,
      10000000
    );

    //stake tokens
    await this.aave.approve(SET.limbo.address, "10000001");
    await SET.limbo.stake(this.aave.address, "10000");

    const updateSoulConfigProposalFactory = await ethers.getContractFactory("UpdateSoulConfigProposal");
    const updateSoulConfigProposal = await updateSoulConfigProposalFactory.deploy(
      SET.limboDAO.address,
      "change state",
      SET.limbo.address,
      this.morgothTokenApprover.address
    );

    await this.morgothTokenApprover.addToken(this.aave.address);
    await updateSoulConfigProposal.parameterize(
      this.aave.address, //token
      10000000, //threshold
      1, //type
      2, //state = waitingToCross
      0, //index
      10 //fps
    );

    const proposalConfig = await SET.limboDAO.proposalConfig();
    const requiredFate = proposalConfig[1].mul(2);
    await this.eye.approve(SET.limboDAO.address, requiredFate);
    await this.eye.mint(requiredFate);
    await SET.limboDAO.burnAsset(this.eye.address, requiredFate, false);

    await toggleWhiteList(updateSoulConfigProposal.address);
    await this.proposalFactory.lodgeProposal(updateSoulConfigProposal.address);

    await SET.limboDAO.vote(updateSoulConfigProposal.address, 1000);

    await advanceTime(6048010);
    await SET.limboDAO.executeCurrentProposal();

    const SoulReaderFactory = await ethers.getContractFactory("SoulReader");
    const soulReader = await SoulReaderFactory.deploy();
    const soulStats = await soulReader.SoulStats(this.aave.address, SET.limbo.address);
    expect(soulStats[0].toNumber()).to.equal(2);

    await expect(SET.limbo.stake(this.aave.address, "10000")).to.be.revertedWith("InvalidSoulState");

    await expect(SET.limbo.unstake(this.aave.address, "10000")).to.be.revertedWith("InvalidSoulState");

    await updateSoulConfigProposal.parameterize(
      this.aave.address, //token
      10000000, //threshold
      1, //type
      1, //state = staking
      0, //index
      10 //fps
    );

    await this.eye.approve(SET.limboDAO.address, requiredFate);
    await this.eye.mint(requiredFate);
    await SET.limboDAO.burnAsset(this.eye.address, requiredFate, false);
    await this.proposalFactory.lodgeProposal(updateSoulConfigProposal.address);

    await SET.limboDAO.vote(updateSoulConfigProposal.address, 1000);

    await advanceTime(6048010);
    await SET.limboDAO.executeCurrentProposal();

    const balanceCheck = async () => {
      const aaveBalanceOnLimbo = await this.aave.balanceOf(SET.limbo.address);
      const userStakedAaveOnLimbo = await SET.limbo.userInfo(this.aave.address, owner.address, 0);

      console.log(
        `aave on Limbo: ${aaveBalanceOnLimbo}\t user staked aave on Limbo: ${userStakedAaveOnLimbo[0].toString()}`
      );
    };

    await this.aave.approve(SET.limbo.address, "1000000");
    SET.limbo.stake(this.aave.address, "10000");
    await balanceCheck();
    await SET.limbo.unstake(this.aave.address, "500");
    await balanceCheck();
  });

  it("t-14. staking an invalid token fails", async function () {
    this.titan = await this.TokenFactory.deploy("iron", "finance");

    //stake tokens
    await this.titan.approve(SET.limbo.address, "10000001");
    await SET.limbo.configureSoul(
      this.titan.address,
      10000000, //crossingThreshold
      0, //soulType
      1, //state
      0,
      10000000
    );
    await expect(SET.limbo.stake(this.titan.address, "10000")).to.be.revertedWith("InvalidSoul");
  });

  it("t-15. unstaking amount larger than balance reverts with ExcessiveWithdrawalRequest", async function () {
    await SET.limbo.configureSoul(
      this.aave.address,
      10000000, //crossingThreshold
      1, //soulType
      1, //state
      0,
      10000000
    );
    await SET.limbo.endConfiguration(SET.limboDAO.address);

    //stake tokens
    await this.aave.approve(SET.limbo.address, "10000001");
    await SET.limbo.stake(this.aave.address, "10000");

    await expect(SET.limbo.unstake(this.aave.address, "10001")).to.be.revertedWith("ExcessiveWithdrawalRequest");
  });

  it("t-16. unstaking amount larger than balance reverts with ExcessiveWithdrawalRequest", async function () {
    await SET.limbo.configureSoul(
      this.aave.address,
      10000000, //crossingThreshold
      1, //soulType
      1, //state
      0,
      10000000
    );
    await SET.limbo.endConfiguration(SET.limboDAO.address);

    //stake tokens
    await this.aave.approve(SET.limbo.address, "10000001");
    await SET.limbo.stake(this.aave.address, "10000");

    await expect(SET.limbo.unstake(this.aave.address, "10001")).to.be.revertedWith("ExcessiveWithdrawalRequest");
  });

  it("t-17. claiming staked reward resets unclaimed to zero", async function () {
    await SET.limbo.configureSoul(
      this.aave.address,
      10000000, //crossingThreshold
      1, //soulType
      1, //state
      0,
      10000000
    );
    //stake tokens
    await this.aave.approve(SET.limbo.address, "10000001");
    await SET.limbo.stake(this.aave.address, "10000");

    await advanceTime(1000);

    const flanBeforeFirstClaim = await this.flan.balanceOf(owner.address);
    await SET.limbo.claimReward(this.aave.address, 0);
    const flanAfterFirstClaim = await this.flan.balanceOf(owner.address);
    await SET.limbo.claimReward(this.aave.address, 0);
    const flanAfterSecondClaim = await this.flan.balanceOf(owner.address);

    expect(flanAfterFirstClaim.gt(flanBeforeFirstClaim));
    expect(flanAfterSecondClaim).to.equal(flanAfterFirstClaim.add("10000000"));
  });

  it("t-18. claim bonus disabled during staking", async function () {
    await SET.limbo.configureSoul(
      this.aave.address,
      10000000, //crossingThreshold
      1, //soulType
      1, //state
      0,
      10000000
    );
    //stake tokens
    await this.aave.approve(SET.limbo.address, "10000001");
    await SET.limbo.stake(this.aave.address, "10000");

    await advanceTime(1000);
    await expect(SET.limbo.claimBonus(this.aave.address, 0)).to.be.revertedWith("InvalidSoulState");
  });

  it("t-19. claiming negative bonus fails", async function () {
    await SET.limbo.configureSoul(
      this.aave.address,
      10000, //crossingThreshold
      1, //soulType
      1, //state
      0,
      10000000
    );

    await SET.limbo.configureCrossingParameters(this.aave.address, 10, -10, true, 10000);

    //stake tokens
    await this.aave.approve(SET.limbo.address, "10000001");
    await SET.limbo.stake(this.aave.address, "9999");

    await advanceTime(1000);
    await SET.limbo.stake(this.aave.address, "2");

    await expect(SET.limbo.claimBonus(this.aave.address, 0)).to.be.revertedWith("FlanBonusMustBePositive");
  });

  it("t-20. migration fails on not waitingToCross", async function () {
    await SET.limbo.configureSoul(
      this.aave.address,
      10000000, //crossingThreshold
      1, //soulType
      1, //state
      0,
      10000000
    );
    //stake tokens
    await this.aave.approve(SET.limbo.address, "10000001");
    await SET.limbo.stake(this.aave.address, "10000");
    const latestIndex = await SET.limbo.latestIndex(this.aave.address)
    await expect(SET.limbo.migrate(this.aave.address, latestIndex)).to.be.revertedWith("InvalidSoulState");
  });

  it("t-21. only threshold souls can migrate", async function () {
    await SET.limbo.configureCrossingConfig(
      this.mockBehodler.address,
      this.mockAngband.address,
      SET.uniswapHelper.address,
      this.addTokenPower.address,
      6756,
      1000
      // 20,
      // 105
    );
    await SET.uniswapHelper.setDAI(this.dai.address);

    await SET.uniswapHelper.configure(
      SET.limbo.address,
      this.mockBehodler.address,
      this.flan.address,
      0,
      this.uniOracle.address
    );

    await SET.limbo.configureSoul(
      this.aave.address,
      100, //crossingThreshold
      2, //soulType
      1, //state
      0,
      10000000
    );
    //stake tokens
    await this.aave.approve(SET.limbo.address, "10000001");
    await SET.limbo.stake(this.aave.address, "10000");

    const latestIndex = await SET.limbo.latestIndex(this.aave.address);
    //assert state is now waitingToCross
    const currentSoul = await SET.limbo.souls(this.aave.address, latestIndex);
    expect(currentSoul[4]).to.equal(1);

    const requiredDelayBetweenEndOfStakingAndMigrate = (await SET.limbo.crossingConfig())[3].toNumber();

    await advanceTime(requiredDelayBetweenEndOfStakingAndMigrate + 1);

    const minQuoteWaitDuration = 3600;

    await advanceTime(minQuoteWaitDuration + 1);
    //no longer explicit quote generation
    await expect(SET.limbo.migrate(this.aave.address, latestIndex)).to.be.revertedWith("InvalidSoulType");
  });

  it("t-22. multiple migrations (STABILIZE) to real uniswap tilts price", async function () {
    const AddressBalanceCheckLib = await ethers.getContractFactory("AddressBalanceCheck");
    const addressBalanceCheckLibAddress = (await AddressBalanceCheckLib.deploy()).address;
    const RealBehodlerFactory = await ethers.getContractFactory("BehodlerLite", {
      libraries: {
        AddressBalanceCheck: addressBalanceCheckLibAddress,
      },
    });
    const realBehodler = await RealBehodlerFactory.deploy();
    await realBehodler.configureScarcity(15, 5, owner.address);
    const LachesisFactory = await ethers.getContractFactory("LachesisLite");
    const lachesis = await LachesisFactory.deploy();

    await realBehodler.setLachesis(lachesis.address);
    await (lachesis as Types.LachesisLite).setBehodler(realBehodler.address);

    const RealAngband = await ethers.getContractFactory("Angband");
    const realAngband = await RealAngband.deploy();

    const proxyRegistryFactory = await ethers.getContractFactory("TokenProxyRegistry");
    const registry: Types.TokenProxyRegistry = await proxyRegistryFactory.deploy(
      SET.limboDAO.address,
      realBehodler.address
    );

    const RealPower = await ethers.getContractFactory("LimboAddTokenToBehodler");
    const realPower = await RealPower.deploy(
      realAngband.address,
      SET.limbo.address,
      registry.address,
      lachesis.address,
      realBehodler.address
    );

    await registry.setPower(realPower.address)

    const UniswapFactoryFactory = await ethers.getContractFactory("UniswapV2Factory");
    const UniswapPairFactory = await ethers.getContractFactory("UniswapV2Pair");

    const realUniswapFactory = await UniswapFactoryFactory.deploy(owner.address);

    await realUniswapFactory.createPair(realBehodler.address, this.flan.address);

    await this.dai.mint("1400000000000000010100550");
    await this.dai.approve(realBehodler.address, "140000000000000001010055");
    await (lachesis as Types.LachesisLite).measure(this.dai.address, true, false);
    await (lachesis as Types.LachesisLite).updateBehodler(this.dai.address);
    await (realBehodler as Types.BehodlerLite).addLiquidity(this.dai.address, "14000000000000001010055");

    const scxBalanceGenerated = await realBehodler.balanceOf(owner.address);
    const createGov = await metaPairFactory(realBehodler, this.uniswapFactory, false);
    await this.flan.mint(owner.address, "100000000000000000000");
    const realflanSCX = await createGov(this.flan);
    const realdaiSCX = await createGov(this.dai);
    await realBehodler.transfer(realflanSCX.address, scxBalanceGenerated.div(10));
    await this.flan.mint(realflanSCX.address, "3000000000000000000");

    // await realflanSCX.mint(owner.address);

    const CreateMetaflanSCX = await metaPairFactory(realflanSCX, this.uniswapFactory, false);
    const real_SCX_fln_scx = await CreateMetaflanSCX(realBehodler);

    const token0 = await real_SCX_fln_scx.token0();
    const token1 = await real_SCX_fln_scx.token1();

    [token0, token1].forEach((token, i) => {
      sanityCheckMaker(false)(
        token === realflanSCX.address || token === realBehodler.address,
        `MetaFlanSCX pair incorrectly setup. Token: ${token}, this.flanSCX: ${this.flanSCX.address}, SCX: ${realBehodler.address}`,
        "LP of SCX / (FLN/SCX) successfully tested for token " + i
      ); //Uniswap checks for token0===token1 so no need for me to replicate that
    });

    await simpleTrade(this.dai, realdaiSCX);

    await simpleTrade(realBehodler, realflanSCX);
    await simpleTrade(realBehodler, real_SCX_fln_scx);
    await advanceTime(6000);

    await simpleTrade(realBehodler, realdaiSCX);
    await simpleTrade(this.flan, realflanSCX);
    await simpleTrade(realflanSCX, real_SCX_fln_scx);
    await advanceTime(4000);

    await this.uniOracle.RegisterPair(realflanSCX.address, 1);
    await this.uniOracle.RegisterPair(realdaiSCX.address, 1);
    await this.uniOracle.RegisterPair(real_SCX_fln_scx.address, 1);
    await advanceTime(10000);
    await simpleTrade(this.dai, realdaiSCX);
    await simpleTrade(realBehodler, realflanSCX);
    await simpleTrade(realBehodler, real_SCX_fln_scx);

    await this.uniOracle.updatePair(realdaiSCX.address);
    await this.uniOracle.updatePair(realflanSCX.address);
    await this.uniOracle.updatePair(real_SCX_fln_scx.address);
    await advanceTime(10000);
    await simpleTrade(realBehodler, realdaiSCX);
    await simpleTrade(this.flan, realflanSCX);
    await simpleTrade(realflanSCX, real_SCX_fln_scx);


    await this.uniOracle.updatePair(realdaiSCX.address);
    await this.uniOracle.updatePair(realflanSCX.address);
    await this.uniOracle.updatePair(real_SCX_fln_scx.address);
    await advanceTime(10000);
    await simpleTrade(realBehodler, realdaiSCX);
    await simpleTrade(this.flan, realflanSCX);
    await simpleTrade(realflanSCX, real_SCX_fln_scx);

    await this.uniOracle.updatePair(realdaiSCX.address);
    await this.uniOracle.updatePair(realflanSCX.address);
    await this.uniOracle.updatePair(real_SCX_fln_scx.address);
    await advanceTime(10000);
    await simpleTrade(realBehodler, realdaiSCX);
    await simpleTrade(this.flan, realflanSCX);
    await simpleTrade(realflanSCX, real_SCX_fln_scx);

    let result = await executionResult(
      SET.limbo.configureCrossingConfig(
        realBehodler.address,
        realAngband.address,
        SET.uniswapHelper.address,
        realPower.address,
        6756,
        1000
        // 20,
        // 105
      )
    );

    expect(result.success).to.equal(true, result.error);
    await SET.uniswapHelper.setDAI(this.dai.address);

    result = await executionResult(
      SET.uniswapHelper.configure(
        SET.limbo.address,
        realBehodler.address,
        this.flan.address,
        0,
        this.uniOracle.address
      )
    );
    expect(result.success).to.equal(true, result.error);

    result = await executionResult(
      SET.limbo.configureSoul(
        this.aave.address,
        100, //crossingThreshold
        1, //soulType
        1, //state
        0,
        10000000
      )
    );

    expect(result.success).to.equal(true, result.error);

    //stake tokens
    await this.aave.approve(SET.limbo.address, "100000000000000000000001");
    await SET.limbo.stake(this.aave.address, "100000000000000000000");

    //assert state is now waitingToCross
    const currentSoul = await SET.limbo.souls(this.aave.address, 0);
    expect(currentSoul[4]).to.equal(2);

    const requiredDelayBetweenEndOfStakingAndMigrate = (await SET.limbo.crossingConfig())[3].toNumber();

    await advanceTime(requiredDelayBetweenEndOfStakingAndMigrate + 1);
    //no longer explicit quote generation

    const minQuoteWaitDuration = 105;

    await advanceBlocks(minQuoteWaitDuration + 1);

    //no longer explicit quote generation

    const scxBalanceOfPairBefore = await realBehodler.balanceOf(realflanSCX.address);

    const blackHoleAddress = await SET.uniswapHelper.blackHole();

    const blackHoleBalanceBefore = await realflanSCX.balanceOf(blackHoleAddress);

    const flanPairBalanceBefore = await this.flan.balanceOf(realflanSCX.address);

    let numberCloseResult = numberClose(scxBalanceOfPairBefore, '129565000000000000000')
    assert.isTrue(numberCloseResult.close, numberCloseResult.message)

    numberCloseResult = numberClose(flanPairBalanceBefore, '10615000000000000000000')
    assert.isTrue(numberCloseResult.close, numberCloseResult.message)

    await advanceTime(600000);
    const scxInflanSCXBefore = await realBehodler.balanceOf(realflanSCX.address)
    const latestIndex = await SET.limbo.latestIndex(this.aave.address)
    result = await executionResult(SET.limbo.migrate(this.aave.address, latestIndex));
    expect(result.success).to.equal(true, result.error.toString());

    const blackHoleBalanceAfter = await realflanSCX.balanceOf(blackHoleAddress);

    expect(blackHoleBalanceAfter.gt(blackHoleBalanceBefore)).to.be.true;

    const flanPairBalanceAfter = await this.flan.balanceOf(realflanSCX.address);
    const scxBalanceOfPairAfter = await realBehodler.balanceOf(realflanSCX.address);

    const flanToSCXRatio = flanPairBalanceAfter.mul(1000).div(scxBalanceOfPairAfter)
    numberCloseResult = numberClose(flanToSCXRatio, 2713842)
    assert.isTrue(numberCloseResult.close, numberCloseResult.message)

    //SECOND MIGRATION

    const mock1 = await this.TokenFactory.deploy("mock1", "mock1");

    //require DAI price of SCX to rise so that we can mint more FLN

    //change DAI price
    await this.aave.mint("100000000000000000000000");
    await this.aave.approve(realBehodler.address, "10000000000000000000000000");
    await realBehodler.addLiquidity(this.aave.address, "100000000000000000000000");

    const scxBalance = await realBehodler.balanceOf(owner.address);
    await realBehodler.withdrawLiquidity(this.dai.address, "140000000000000010100");

    await SET.limbo.configureSoul(
      mock1.address,
      "100000000", //crossingThreshold
      1, //soulType
      1, //state
      1,
      10000000
    );
    //stake tokens
    await mock1.approve(SET.limbo.address, "100000000000000000000001");
    await SET.limbo.stake(mock1.address, "100000000000000000000");

    await SET.limbo.configureCrossingConfig(
      realBehodler.address,
      realAngband.address,
      SET.uniswapHelper.address,
      realPower.address,
      6756,
      1000
      // 20,
      // 105
    );

    await advanceTime(requiredDelayBetweenEndOfStakingAndMigrate + 1);
    //no longer explicit quote generation

    await advanceBlocks(minQuoteWaitDuration + 1);

    await advanceTime(600000);
    //no longer explicit quote generation
    const mock1LatestIndex = await SET.limbo.latestIndex(mock1.address)
    result = await executionResult(SET.limbo.migrate(mock1.address, mock1LatestIndex));
    expect(result.success).to.equal(true, result.error);

    const flanBalanceAfterSecondMigrate = await this.flan.balanceOf(realflanSCX.address);
    const scxBalanceOfPairAfterSecondMigrate = await realBehodler.balanceOf(realflanSCX.address);

    const ratio = flanBalanceAfterSecondMigrate.mul(1000).div(scxBalanceOfPairAfterSecondMigrate);

    //flan strengthens
    numberCloseResult = numberClose(ratio, '2379392')
    assert.isTrue(numberCloseResult.close, numberCloseResult.message)

    //  THIRD MIGRATION
    const mock2 = await this.TokenFactory.deploy("mock1", "mock1");

    await SET.limbo.configureSoul(
      mock2.address,
      100, //crossingThreshold
      1, //soulType
      1, //state
      1,
      10000000
    );

    await SET.limbo.configureCrossingConfig(
      realBehodler.address,
      realAngband.address,
      SET.uniswapHelper.address,
      realPower.address,
      6756,
      1000
      // 20,
      // 105
    );
    await SET.uniswapHelper.setDAI(this.dai.address);

    await SET.uniswapHelper.configure(
      SET.limbo.address,
      realBehodler.address,
      this.flan.address,
      10, //10% price overshoot on flan means 10% less flan minted,
      this.uniOracle.address
    );

    await mock2.mint("3000000000000000000000");
    await mock2.approve(SET.limbo.address, "3000000000000000000000");
    await SET.limbo.stake(mock2.address, "3000000000000000000000");

    await advanceTime(600000);
    //no longer explicit quote generation

    await advanceBlocks(minQuoteWaitDuration + 1);

    //no longer explicit quote generation
    const mock2LatestIndex = await SET.limbo.latestIndex(mock2.address)
    await SET.limbo.migrate(mock2.address, mock2LatestIndex);

    const flanBalanceAfterThirdMigrate = await this.flan.balanceOf(realflanSCX.address);
    const scxBalanceOfPairAfterThirdMigrate = await realBehodler.balanceOf(realflanSCX.address);

    const ratio2 = flanBalanceAfterThirdMigrate.mul(10000).div(scxBalanceOfPairAfterThirdMigrate);
    numberCloseResult = numberClose(ratio2, 23687384)
    assert.isTrue(numberCloseResult.close, numberCloseResult.message)
  });

  it("t-23. any whitelisted contract can mint flan", async function () {
    //assert secondPerson can't mint flan
    await expect(this.flan.connect(secondPerson).mint(owner.address, 1000)).to.be.revertedWith("MintingNotWhiteListed");

    //whitelist secondPerson
    await this.flan.whiteListMinting(secondPerson.address, true);

    const flanBefore = await this.flan.balanceOf(owner.address);
    await this.flan.connect(secondPerson).mint(owner.address, 1000);
    const flanAfter = await this.flan.balanceOf(owner.address);
    expect(flanAfter.sub(flanBefore).toString()).to.equal("1000");

    //unwhitelist secondPerson
    await this.flan.whiteListMinting(secondPerson.address, false);

    //assert secondPerson can't mint flan
    await expect(this.flan.connect(secondPerson).mint(owner.address, 1000)).to.be.revertedWith("MintingNotWhiteListed");
  });

  it("t-25. attemptToTargetAPY for non threshold soul fails", async function () {
    await SET.limbo.configureSoul(this.aave.address, 10000000, 2, 1, 0, 10000000);

    //create real behodler
    const AddressBalanceCheckLib = await ethers.getContractFactory("AddressBalanceCheck");
    const addressBalanceCheckLibAddress = (await AddressBalanceCheckLib.deploy()).address;
    const RealBehodlerFactory = await ethers.getContractFactory("BehodlerLite", {
      libraries: {
        AddressBalanceCheck: addressBalanceCheckLibAddress,
      },
    });
    const realBehodler = await RealBehodlerFactory.deploy();
    await realBehodler.configureScarcity(15, 5, owner.address);

    //add dai to real behodler
    await this.dai.mint("5000000000000000000000000");
    await this.dai.approve(realBehodler.address, "5000000000000000000000000");
    await realBehodler.addLiquidity(this.dai.address, "5000000000000000000000000");

    //create Uniswap pair for Flan/SCX
    const UniswapFactoryFactory = await ethers.getContractFactory("UniswapV2Factory");
    const UniswapPairFactory = await ethers.getContractFactory("UniswapV2Pair");
    await this.dai.mint("1400000000000000010100550");
    await this.dai.approve(realBehodler.address, "140000000000000001010055");
    await realBehodler.addLiquidity(this.dai.address, "14000000000000001010055");

    const scxBalanceGenerated = await realBehodler.balanceOf(owner.address);
    const createGov = await metaPairFactory(realBehodler, this.uniswapFactory, false);
    await this.flan.mint(owner.address, "100000000000000000000");
    const realflanSCX = await createGov(this.flan);
    const realdaiSCX = await createGov(this.dai);
    await realBehodler.transfer(realflanSCX.address, scxBalanceGenerated.div(10));
    await this.flan.mint(realflanSCX.address, "3000000000000000000");

    // await realflanSCX.mint(owner.address);

    const CreateMetaflanSCX = await metaPairFactory(realflanSCX, this.uniswapFactory, false);
    const real_SCX_fln_scx = await CreateMetaflanSCX(realBehodler);

    const token0 = await real_SCX_fln_scx.token0();
    const token1 = await real_SCX_fln_scx.token1();

    [token0, token1].forEach((token, i) => {
      sanityCheckMaker(false)(
        token === realflanSCX.address || token === realBehodler.address,
        `MetaFlanSCX pair incorrectly setup. Token: ${token}, this.flanSCX: ${this.flanSCX.address}, SCX: ${realBehodler.address}`,
        "LP of SCX / (FLN/SCX) successfully tested for token " + i
      ); //Uniswap checks for token0===token1 so no need for me to replicate that
    });

    await simpleTrade(this.dai, realdaiSCX);

    await simpleTrade(realBehodler, realflanSCX);
    await simpleTrade(realBehodler, real_SCX_fln_scx);
    await advanceTime(6000);

    await simpleTrade(realBehodler, realdaiSCX);
    await simpleTrade(this.flan, realflanSCX);
    await simpleTrade(realflanSCX, real_SCX_fln_scx);
    await advanceTime(4000);

    await this.uniOracle.RegisterPair(realflanSCX.address, 1);
    await this.uniOracle.RegisterPair(realdaiSCX.address, 1);
    await this.uniOracle.RegisterPair(real_SCX_fln_scx.address, 1);
    await advanceTime(10000);
    await simpleTrade(this.dai, realdaiSCX);
    await simpleTrade(realBehodler, realflanSCX);
    await simpleTrade(realBehodler, real_SCX_fln_scx);

    await this.uniOracle.updatePair(realdaiSCX.address);
    await this.uniOracle.updatePair(realflanSCX.address);
    await this.uniOracle.updatePair(real_SCX_fln_scx.address);

    await simpleTrade(realBehodler, realdaiSCX);
    await simpleTrade(this.flan, realflanSCX);
    await simpleTrade(realflanSCX, real_SCX_fln_scx);
    await SET.uniswapHelper.setDAI(this.dai.address);

    //configure uniswapHelper
    const result = await executionResult(
      SET.uniswapHelper.configure(
        SET.limbo.address,
        realBehodler.address,
        this.flan.address,
        0,
        this.uniOracle.address
      )
    );
    expect(result.success).to.equal(true, result.error);

    //send Flan and SCX to pair and mint
    await this.flan.mint(realflanSCX.address, "1000000000000000000000000");
    130000000000000000000000;
    const scxBalance = await realBehodler.balanceOf(owner.address);

    await realBehodler.transfer(realflanSCX.address, scxBalance);

    await realflanSCX.mint(owner.address);

    //run price quote, wait required time and run quote again.
    //no longer explicit quote generation

    await advanceBlocks(11);

    //no longer explicit quote generation

    //flash govern set APY
    await expect(
      SET.limbo.attemptToTargetAPY(
        this.aave.address,
        1300, // 13%
        0 //let helper figure this out
      )
    ).to.be.revertedWith("InvalidSoulType");
  });

  it("t-26. attemptToTargetAPY sets fps correctly, use to test multiple token migrations", async function () {
    await SET.limbo.configureSoul(this.aave.address, 10000000, 1, 1, 0, 10000000);

    //create real behodler
    const AddressBalanceCheckLib = await ethers.getContractFactory("AddressBalanceCheck");
    const addressBalanceCheckLibAddress = (await AddressBalanceCheckLib.deploy()).address;
    const RealBehodlerFactory = await ethers.getContractFactory("BehodlerLite", {
      libraries: {
        AddressBalanceCheck: addressBalanceCheckLibAddress,
      },
    });
    const realBehodler = await RealBehodlerFactory.deploy();
    await realBehodler.configureScarcity(15, 5, owner.address);

    //add dai to real behodler
    await this.dai.mint("5000000000000000000000000");
    await this.dai.approve(realBehodler.address, "5000000000000000000000000");
    await realBehodler.addLiquidity(this.dai.address, "5000000000000000000000000");

    //create Uniswap pair for Flan/SCX
    const UniswapFactoryFactory = await ethers.getContractFactory("UniswapV2Factory");
    const UniswapPairFactory = await ethers.getContractFactory("UniswapV2Pair");
    const realUniswapFactory = await UniswapFactoryFactory.deploy(owner.address);
    await realUniswapFactory.createPair(realBehodler.address, this.flan.address);

    const scxBalanceGenerated = await realBehodler.balanceOf(owner.address);
    const createGov = await metaPairFactory(realBehodler, this.uniswapFactory, false);
    await this.flan.mint(owner.address, "100000000000000000000");
    const realflanSCX = await createGov(this.flan);
    const realdaiSCX = await createGov(this.dai);
    await realBehodler.transfer(realflanSCX.address, scxBalanceGenerated.div(10));
    await this.flan.mint(realflanSCX.address, "3000000000000000000");

    // await realflanSCX.mint(owner.address);

    const CreateMetaflanSCX = await metaPairFactory(realflanSCX, this.uniswapFactory, false);
    const real_SCX_fln_scx = await CreateMetaflanSCX(realBehodler);

    const token0 = await real_SCX_fln_scx.token0();
    const token1 = await real_SCX_fln_scx.token1();

    [token0, token1].forEach((token, i) => {
      sanityCheckMaker(false)(
        token === realflanSCX.address || token === realBehodler.address,
        `MetaFlanSCX pair incorrectly setup. Token: ${token}, this.flanSCX: ${this.flanSCX.address}, SCX: ${realBehodler.address}`,
        "LP of SCX / (FLN/SCX) successfully tested for token " + i
      ); //Uniswap checks for token0===token1 so no need for me to replicate that
    });

    await simpleTrade(this.dai, realdaiSCX);

    await simpleTrade(realBehodler, realflanSCX);
    await simpleTrade(realBehodler, real_SCX_fln_scx);
    await advanceTime(6000);

    await simpleTrade(realBehodler, realdaiSCX);
    await simpleTrade(this.flan, realflanSCX);
    await simpleTrade(realflanSCX, real_SCX_fln_scx);
    await advanceTime(4000);

    await this.uniOracle.RegisterPair(realflanSCX.address, 1);
    await this.uniOracle.RegisterPair(realdaiSCX.address, 1);
    await this.uniOracle.RegisterPair(real_SCX_fln_scx.address, 1);
    await advanceTime(10000);
    await simpleTrade(this.dai, realdaiSCX);
    await simpleTrade(realBehodler, realflanSCX);
    await simpleTrade(realBehodler, real_SCX_fln_scx);

    await this.uniOracle.updatePair(realdaiSCX.address);
    await this.uniOracle.updatePair(realflanSCX.address);
    await this.uniOracle.updatePair(real_SCX_fln_scx.address);

    await simpleTrade(realBehodler, realdaiSCX);
    await simpleTrade(this.flan, realflanSCX);
    await simpleTrade(realflanSCX, real_SCX_fln_scx);
    await SET.uniswapHelper.setDAI(this.dai.address);

    await SET.uniswapHelper.setDAI(this.dai.address);

    //configure uniswapHelper
    let result = await executionResult(
      SET.uniswapHelper.configure(
        SET.limbo.address,
        realBehodler.address,
        this.flan.address,
        0,
        this.uniOracle.address
      )
    );
    expect(result.success).to.equal(true, result.error);

    //send Flan and SCX to pair and mint
    await this.flan.mint(realflanSCX.address, "1000000000000000000000000");
    130000000000000000000000;
    const scxBalance = await realBehodler.balanceOf(owner.address);

    await realBehodler.transfer(realflanSCX.address, scxBalance);

    await realflanSCX.mint(owner.address);

    //run price quote, wait required time and run quote again.
    //no longer explicit quote generation

    await advanceBlocks(11);

    //no longer explicit quote generation

    //flash govern set APY
    result = await executionResult(
      SET.limbo.attemptToTargetAPY(
        this.aave.address,
        1300, // 13%
        "10000000000000000000000" //let helper figure this out
      )
    );
    expect(result.success).to.equal(true, result.error);

    //get soul info and assert fps is correct.
    //Dai per scx = 6425.272584524
    //Flan per scx = 1285.054516905
    // Dai per flan =143.486644559

    const soulInfo = await SET.limbo.souls(this.aave.address, 0);
    expect(soulInfo.flanPerSecond).to.equal("41222729578893");

    const sushi = await this.TokenFactory.deploy("Sushi", "Sushi");
    const pool = await this.TokenFactory.deploy("pool", "pool");
    //initiatialize proposal
    const updateMultipleSoulConfigProposalFactory = await ethers.getContractFactory("UpdateMultipleSoulConfigProposal");
    await this.morgothTokenApprover.toggleManyTokens([this.aave.address, sushi.address, pool.address], true);
    const updateMultiSoulConfigProposal = await updateMultipleSoulConfigProposalFactory.deploy(
      SET.limboDAO.address,
      "List many tokens",
      SET.limbo.address,
      SET.uniswapHelper.address,
      this.morgothTokenApprover.address
    );

    await updateMultiSoulConfigProposal.parameterize(sushi.address, 0, 2, 0, 0, 2600, "5000000000000000000000000");
    await updateMultiSoulConfigProposal.parameterize(pool.address, 123456, 1, 0, 0, 1300, "10000000000000000000000000");
    await updateMultiSoulConfigProposal.lockDown();

    //lodge
    const proposalConfig = await SET.limboDAO.proposalConfig();
    const requiredFate = proposalConfig[1].mul(2);
    await this.eye.approve(SET.limboDAO.address, requiredFate);
    await this.eye.mint(requiredFate);
    await SET.limboDAO.burnAsset(this.eye.address, requiredFate, false);

    await toggleWhiteList(updateMultiSoulConfigProposal.address);
    await this.proposalFactory.lodgeProposal(updateMultiSoulConfigProposal.address);

    //vote and execute
    await SET.limboDAO.vote(updateMultiSoulConfigProposal.address, 1000);

    await advanceTime(6048010);
    console.log('executing proposal')
    await expect(SET.limboDAO.executeCurrentProposal())
      .to.emit(SET.limboDAO, "proposalExecuted")
      .withArgs(updateMultiSoulConfigProposal.address, true);
    console.log('proposal executed')

    //assert
    const sushiDetails = await SET.limbo.souls(sushi.address, 0);
    expect(sushiDetails[2]).to.equal("0"); //crossing threshold
    expect(sushiDetails[3]).to.equal(2); //soul type = migration
    expect(sushiDetails[5]).to.equal("41222729578893962"); //fps

    const poolDetails = await SET.limbo.souls(pool.address, 0);
    expect(poolDetails[2]).to.equal("123456"); //crossing threshold
    expect(poolDetails[3]).to.equal(1); //soul type = migration
    expect(poolDetails[5]).to.equal("41222729578893962"); //fps
  });


  async function deployClaimSecondaryRewardsProposal(limboDAO: Types.LimboDAO) {
    const claimSecondaryRewardsProposalFactory = await ethers.getContractFactory("ClaimSecondaryRewardsProposal")
    let claimSecondaryRewardsProposal = await deploy<Types.ClaimSecondaryRewardsProposal>(
      claimSecondaryRewardsProposalFactory, limboDAO.address
    );
    return claimSecondaryRewardsProposal
  }

  async function lodgeAndExecuteClaimSecondaryRewards(claimSecondaryRewardsProposal: Types.ClaimSecondaryRewardsProposal, token: Types.MockToken, eye: Types.MockToken, limboDAO: Types.LimboDAO,
    proposalFactory: Types.ProposalFactory, expectError: boolean) {

    //paramterize proposal
    await claimSecondaryRewardsProposal.parameterize(token.address, owner.address)


    //whitelist proposal on LimboDAO
    await toggleWhiteList(claimSecondaryRewardsProposal.address)

    //acquire enough fate to lodge and vote on proposal
    const proposalConfig = await limboDAO.proposalConfig();
    const requiredFate = proposalConfig[1].mul(2);
    await eye.approve(limboDAO.address, requiredFate);
    await eye.mint(requiredFate);
    await limboDAO.burnAsset(eye.address, requiredFate, false);

    //lodge proposal


    await proposalFactory.lodgeProposal(claimSecondaryRewardsProposal.address);
    //vote yes on proposal
    await limboDAO.vote(claimSecondaryRewardsProposal.address, 1000);

    //time travel to when voting period has ended
    await advanceTime(6048010);

    if (expectError) {
      await expect(limboDAO.executeCurrentProposal())
        .to.emit(limboDAO, "proposalExecuted")
        .withArgs(claimSecondaryRewardsProposal.address, false);
    }
    //execute proposal. Owner should get 10000 sushi
    await limboDAO.executeCurrentProposal();


  }

  it("t-27.1 Only a proposal can withdraw secondary rewards", async function () {


    //create unlisted token and send to limbo
    const sushi = await this.TokenFactory.deploy("Sushi", "Sushi");
    await sushi.mint("10000");
    await sushi.transfer(SET.limbo.address, "10000");

    //assert token is in unset state on Limbo.
    const soulReader: Types.SoulReader = this.soulReader as Types.SoulReader
    let soulState = (await soulReader.getCurrentSoulState(sushi.address, SET.limbo.address)).toNumber()
    expect(soulState).to.equal(0)

    //store owner balance before withdrawal
    const ownerBalanceBefore = await sushi.balanceOf(owner.address)
    const limboBalanceBefore = await sushi.balanceOf(SET.limbo.address)

    let proposal = await deployClaimSecondaryRewardsProposal(SET.limboDAO)
    await lodgeAndExecuteClaimSecondaryRewards(proposal, sushi, this.eye, SET.limboDAO, this.proposalFactory, false)

    const ownerBalanceAfter = await sushi.balanceOf(owner.address)
    const limboBalanceAfter = await sushi.balanceOf(SET.limbo.address)

    //assert that Limbo has zero balance and owner has an increase of 10000
    expect(ownerBalanceAfter.sub(ownerBalanceBefore).toNumber()).to.equal(10000)
    expect(limboBalanceAfter.toNumber()).to.equal(0)
    expect(limboBalanceBefore.toNumber()).to.equal(10000)
  })

  for (let i = 1; i < 4; i++) {


    it("t-27.2 only unset tokens can be claimed as secondary rewards", async function () {
      //create new token and list it on Behodler for staking
      const sushi = await this.TokenFactory.deploy("Sushi", "Sushi");
      await sushi.mint("10000");
      await sushi.transfer(SET.limbo.address, "10000");

      await SET.limbo.configureSoul(sushi.address, 10000000, 1, i, 0, 10000000);

      let proposal = await deployClaimSecondaryRewardsProposal(SET.limboDAO)
      console.log('proposal: ' + proposal.address)
      await lodgeAndExecuteClaimSecondaryRewards(proposal, sushi, this.eye, SET.limboDAO, this.proposalFactory, true)
    })
  }

  it("t-28. flash governance tolerance enforced for flash loan but not successful proposals or unconfigured", async function () {
    await this.flashGovernance.configureSecurityParameters(10, 100, 3);

    await SET.limbo.configureSoul(this.aave.address, 10000000, 1, 1, 0, 10000000);

    //create real behodler
    const AddressBalanceCheckLib = await ethers.getContractFactory("AddressBalanceCheck");
    const addressBalanceCheckLibAddress = (await AddressBalanceCheckLib.deploy()).address;
    const RealBehodlerFactory = await ethers.getContractFactory("BehodlerLite", {
      libraries: {
        AddressBalanceCheck: addressBalanceCheckLibAddress,
      },
    });
    const realBehodler = await RealBehodlerFactory.deploy();
    await realBehodler.configureScarcity(15, 5, owner.address);

    //add dai to real behodler
    await this.dai.mint("5000000000000000000000000");
    await this.dai.approve(realBehodler.address, "5000000000000000000000000");
    await realBehodler.addLiquidity(this.dai.address, "5000000000000000000000000");

    //create Uniswap pair for Flan/SCX
    const UniswapFactoryFactory = await ethers.getContractFactory("UniswapV2Factory");
    const UniswapPairFactory = await ethers.getContractFactory("UniswapV2Pair");
    const realUniswapFactory = await UniswapFactoryFactory.deploy(owner.address);
    await realUniswapFactory.createPair(realBehodler.address, this.flan.address);

    await this.dai.mint("1400000000000000010100550");
    await this.dai.approve(realBehodler.address, "140000000000000001010055");
    await realBehodler.addLiquidity(this.dai.address, "14000000000000001010055");

    const scxBalanceGenerated = await realBehodler.balanceOf(owner.address);
    const createGov = await metaPairFactory(realBehodler, this.uniswapFactory, false);
    await this.flan.mint(owner.address, "100000000000000000000");
    const realflanSCX = await createGov(this.flan);
    const realdaiSCX = await createGov(this.dai);
    await realBehodler.transfer(realflanSCX.address, scxBalanceGenerated.div(10));
    await this.flan.mint(realflanSCX.address, "3000000000000000000");

    // await realflanSCX.mint(owner.address);

    const CreateMetaflanSCX = await metaPairFactory(realflanSCX, this.uniswapFactory, false);
    const real_SCX_fln_scx = await CreateMetaflanSCX(realBehodler);

    const token0 = await real_SCX_fln_scx.token0();
    const token1 = await real_SCX_fln_scx.token1();

    [token0, token1].forEach((token, i) => {
      sanityCheckMaker(false)(
        token === realflanSCX.address || token === realBehodler.address,
        `MetaFlanSCX pair incorrectly setup. Token: ${token}, this.flanSCX: ${this.flanSCX.address}, SCX: ${realBehodler.address}`,
        "LP of SCX / (FLN/SCX) successfully tested for token " + i
      ); //Uniswap checks for token0===token1 so no need for me to replicate that
    });

    await simpleTrade(this.dai, realdaiSCX);

    await simpleTrade(realBehodler, realflanSCX);
    await simpleTrade(realBehodler, real_SCX_fln_scx);
    await advanceTime(6000);

    await simpleTrade(realBehodler, realdaiSCX);
    await simpleTrade(this.flan, realflanSCX);
    await simpleTrade(realflanSCX, real_SCX_fln_scx);
    await advanceTime(4000);

    await this.uniOracle.RegisterPair(realflanSCX.address, 1);
    await this.uniOracle.RegisterPair(realdaiSCX.address, 1);
    await this.uniOracle.RegisterPair(real_SCX_fln_scx.address, 1);
    await advanceTime(10000);
    await simpleTrade(this.dai, realdaiSCX);
    await simpleTrade(realBehodler, realflanSCX);
    await simpleTrade(realBehodler, real_SCX_fln_scx);

    await this.uniOracle.updatePair(realdaiSCX.address);
    await this.uniOracle.updatePair(realflanSCX.address);
    await this.uniOracle.updatePair(real_SCX_fln_scx.address);

    await simpleTrade(realBehodler, realdaiSCX);
    await simpleTrade(this.flan, realflanSCX);
    await simpleTrade(realflanSCX, real_SCX_fln_scx);

    await SET.uniswapHelper.setDAI(this.dai.address);

    //configure uniswapHelper
    const result = await executionResult(
      SET.uniswapHelper.configure(
        SET.limbo.address,
        realBehodler.address,
        this.flan.address,
        0,
        this.uniOracle.address
      )
    );
    expect(result.success).to.equal(true, result.error);

    //send Flan and SCX to pair and mint
    await this.flan.mint(realflanSCX.address, "1000000000000000000000000");
    130000000000000000000000;
    const scxBalance = await realBehodler.balanceOf(owner.address);

    await realBehodler.transfer(realflanSCX.address, scxBalance);

    await realflanSCX.mint(owner.address);

    //run price quote, wait required time and run quote again.
    //no longer explicit quote generation

    await advanceBlocks(11);

    //no longer explicit quote generation

    //flash govern set APY
    await SET.limbo.attemptToTargetAPY(
      this.aave.address,
      1300, // 13%
      10000
    );

    await SET.limbo.attemptToTargetAPY(
      this.aave.address,
      2600, //more than 3% is fine when not configured
      10000
    );
  });

  it("t-29. flash governance enforcement works immediately after configuring", async function () {
    await this.flashGovernance.configureSecurityParameters(10, 100, 3);

    await SET.limbo.configureSoul(this.aave.address, 10000000, 1, 1, 0, 10000000);

    //create real behodler
    const AddressBalanceCheckLib = await ethers.getContractFactory("AddressBalanceCheck");
    const addressBalanceCheckLibAddress = (await AddressBalanceCheckLib.deploy()).address;
    const RealBehodlerFactory = await ethers.getContractFactory("BehodlerLite", {
      libraries: {
        AddressBalanceCheck: addressBalanceCheckLibAddress,
      },
    });
    const realBehodler = await RealBehodlerFactory.deploy();
    await realBehodler.configureScarcity(15, 5, owner.address);

    //add dai to real behodler
    await this.dai.mint("5000000000000000000000000");
    await this.dai.approve(realBehodler.address, "5000000000000000000000000");
    await realBehodler.addLiquidity(this.dai.address, "5000000000000000000000000");

    //create Uniswap pair for Flan/SCX
    const UniswapFactoryFactory = await ethers.getContractFactory("UniswapV2Factory");
    const UniswapPairFactory = await ethers.getContractFactory("UniswapV2Pair");
    const realUniswapFactory = await UniswapFactoryFactory.deploy(owner.address);
    await realUniswapFactory.createPair(realBehodler.address, this.flan.address);

    await this.dai.mint("1400000000000000010100550");
    await this.dai.approve(realBehodler.address, "140000000000000001010055");
    await realBehodler.addLiquidity(this.dai.address, "14000000000000001010055");

    const scxBalanceGenerated = await realBehodler.balanceOf(owner.address);
    const createGov = await metaPairFactory(realBehodler, this.uniswapFactory, false);
    await this.flan.mint(owner.address, "100000000000000000000");
    const realflanSCX = await createGov(this.flan);
    const realdaiSCX = await createGov(this.dai);
    await realBehodler.transfer(realflanSCX.address, scxBalanceGenerated.div(10));
    await this.flan.mint(realflanSCX.address, "3000000000000000000");

    // await realflanSCX.mint(owner.address);

    const CreateMetaflanSCX = await metaPairFactory(realflanSCX, this.uniswapFactory, false);
    const real_SCX_fln_scx = await CreateMetaflanSCX(realBehodler);

    const token0 = await real_SCX_fln_scx.token0();
    const token1 = await real_SCX_fln_scx.token1();

    [token0, token1].forEach((token, i) => {
      sanityCheckMaker(false)(
        token === realflanSCX.address || token === realBehodler.address,
        `MetaFlanSCX pair incorrectly setup. Token: ${token}, this.flanSCX: ${this.flanSCX.address}, SCX: ${realBehodler.address}`,
        "LP of SCX / (FLN/SCX) successfully tested for token " + i
      ); //Uniswap checks for token0===token1 so no need for me to replicate that
    });

    await simpleTrade(this.dai, realdaiSCX);

    await simpleTrade(realBehodler, realflanSCX);
    await simpleTrade(realBehodler, real_SCX_fln_scx);
    await advanceTime(6000);

    await simpleTrade(realBehodler, realdaiSCX);
    await simpleTrade(this.flan, realflanSCX);
    await simpleTrade(realflanSCX, real_SCX_fln_scx);
    await advanceTime(4000);

    await this.uniOracle.RegisterPair(realflanSCX.address, 1);
    await this.uniOracle.RegisterPair(realdaiSCX.address, 1);
    await this.uniOracle.RegisterPair(real_SCX_fln_scx.address, 1);
    await advanceTime(10000);
    await simpleTrade(this.dai, realdaiSCX);
    await simpleTrade(realBehodler, realflanSCX);
    await simpleTrade(realBehodler, real_SCX_fln_scx);

    await this.uniOracle.updatePair(realdaiSCX.address);
    await this.uniOracle.updatePair(realflanSCX.address);
    await this.uniOracle.updatePair(real_SCX_fln_scx.address);

    await simpleTrade(realBehodler, realdaiSCX);
    await simpleTrade(this.flan, realflanSCX);
    await simpleTrade(realflanSCX, real_SCX_fln_scx);

    await SET.uniswapHelper.setDAI(this.dai.address);

    await this.eye.approve(this.flashGovernance.address, "100000000000000000000000000000");

    await SET.uniswapHelper.setDAI(this.dai.address);

    //configure uniswapHelper
    const result = await executionResult(
      SET.uniswapHelper.configure(
        SET.limbo.address,
        realBehodler.address,
        this.flan.address,
        0,
        this.uniOracle.address
      )
    );
    expect(result.success).to.equal(true, result.error);

    //send Flan and SCX to pair and mint
    await this.flan.mint(realflanSCX.address, "1000000000000000000000000");

    const scxBalance = await realBehodler.balanceOf(owner.address);

    await realBehodler.transfer(realflanSCX.address, scxBalance);

    await realflanSCX.mint(owner.address);

    //run price quote, wait required time and run quote again.
    //no longer explicit quote generation

    await advanceBlocks(11);

    //no longer explicit quote generation

    await SET.limbo.endConfiguration(SET.limboDAO.address);

    // this should fail
    //flash govern set APY
    await expect(
      SET.limbo.attemptToTargetAPY(
        this.aave.address,
        2000, // 13%
        10000
      )
    ).to.be.revertedWith("FlashToleranceViolated");
  });

  it("t-31. test unstaking from another user more than allowance fails", async function () {
    await SET.limbo.configureSoul(
      this.aave.address,
      10000000, //crossingThreshold
      1, //soulType
      1, //state
      0,
      10000000
    );
    await SET.limbo.endConfiguration(SET.limboDAO.address);

    //stake tokens
    await this.aave.approve(SET.limbo.address, "10000001");
    await SET.limbo.stake(this.aave.address, "10000");

    await advanceTime(400000);

    const userInfoBeforeUntake = await SET.limbo.userInfo(this.aave.address, owner.address, 0);
    expect(userInfoBeforeUntake[0].toNumber()).to.equal(10000);

    const expectedFlanLowerbound = Number((10000000n * 400001n) / 1000000n);

    const userFlanBalanceBefore = await this.flan.balanceOf(owner.address);
    const expectedFlanUpperbound = Number((10000000n * 400006n) / 1000000n);
    await SET.limbo.approveUnstake(this.aave.address, secondPerson.address, "2000");
    const latestIndex = await SET.limbo.latestIndex(this.aave.address)

    await SET.limbo.connect(secondPerson).unstakeFor(this.aave.address, 2000, owner.address, latestIndex);

    await expect(SET.limbo.connect(secondPerson).unstakeFor(this.aave.address, 1, owner.address, latestIndex)).to.be.revertedWith(
      "Arithmetic operation underflowed or overflowed outside of an unchecked block"
    );
  });

  it("t-35. disabled flash governance fails", async function () {
    //configure soul
    await SET.limbo.configureSoul(this.aave.address, 10000000, 1, 1, 0, 10000000);

    await SET.limbo.configureCrossingParameters(this.aave.address, 20000000000, "-1000", true, 10000000);

    //set flash loan params
    await this.flashGovernance.configureFlashGovernance(
      this.eye.address,
      21000000, //amount to stake
      604800, //lock duration = 1 week,
      true // asset is burnable
    );

    await this.flashGovernance.setGoverned([SET.limbo.address], [false]);
    await this.flashGovernance.endConfiguration(SET.limboDAO.address);
    //end configuration
    await SET.limbo.endConfiguration(SET.limboDAO.address);

    //stake requisite tokens, try again and succeed.
    await this.eye.approve(this.flashGovernance.address, 21000000);
    await expect(SET.limbo.adjustSoul(this.aave.address, 20000000001, -1001, 10000001)).to.be.revertedWith(
      "FlashGovernanceDisabled"
    );
  });

  it("t-36. flash governance on same contract by same user after judgment period has elapsed deducts zero", async function () {
    //configure soul
    await SET.limbo.configureSoul(this.aave.address, 10000000, 1, 1, 0, 10000000);

    await SET.limbo.configureCrossingParameters(this.aave.address, 20000000000, "-1000", true, 10000000);

    //set flash loan params
    await this.flashGovernance.configureFlashGovernance(
      this.eye.address,
      21000000, //amount to stake
      604800, //lock duration = 1 week,
      true // asset is burnable
    );
    let result = await executionResult(SET.limbo.endConfiguration(SET.limboDAO.address));
    expect(result.success).to.equal(true, result.error);

    //stake requisite tokens, try again and succeed.
    await this.eye.approve(this.flashGovernance.address, 42000000);
    const eyeBalanceBeforeEveryThing = await this.eye.balanceOf(this.flashGovernance.address);
    console.log("eyeBalanceBeforeEveryThing", eyeBalanceBeforeEveryThing.toString());
    const userBalanceBeforeFirstCall = await this.eye.balanceOf(owner.address);
    await SET.limbo.adjustSoul(this.aave.address, 20000000001, -1001, 10000001);
    const userBalanceAfterFirstCall = await this.eye.balanceOf(owner.address);
    expect(userBalanceAfterFirstCall.toString()).to.equal(userBalanceBeforeFirstCall.sub(21000000).toString());

    await advanceTime(605800); // more than enough time.
    const eyeBalanceBeforeSecondJudgment = await this.eye.balanceOf(this.flashGovernance.address);

    result = await executionResult(SET.limbo.adjustSoul(this.aave.address, 20000000001, -1001, 10000001));
    expect(result.success).to.equal(true, result.error);

    const userBalanceAfterSecondCall = await this.eye.balanceOf(owner.address);
    const eyeBalanceAfterSecondJudgment = await this.eye.balanceOf(this.flashGovernance.address);

    expect(userBalanceAfterSecondCall.toString()).to.equal(userBalanceAfterFirstCall.toString());

    expect(eyeBalanceAfterSecondJudgment).to.equal(eyeBalanceBeforeSecondJudgment.toString());
  });

  [0, 1000, -1000].forEach((offset) => {
    it("t-37. flash governance on same contract by same user after judgment period has elapsed correct amount", async function () {
      console.log("running offset " + offset);
      const initialStakeAmount = 21000000;
      const newDepositRequirement: number = initialStakeAmount + offset;
      const requireFate = (await SET.limboDAO.proposalConfig())[1];
      await this.eye.mint(requireFate.mul("1000000000000"));
      await this.eye.approve(
        SET.limboDAO.address,
        "115792089237316195423570985008687907853269984665640564039457584007913129639935"
      );

      let contextString: string = "remains same";
      if (newDepositRequirement < initialStakeAmount) contextString = "decreases";
      else if (newDepositRequirement > initialStakeAmount) contextString = "increases";

      console.log("DFlashGovernanceDisabledOSIT REQUIREMENT BETWEEN FLASH LOANS " + contextString);

      //configure soul
      let result = await executionResult(SET.limbo.configureSoul(this.aave.address, 10000000, 1, 1, 0, 10000000));
      expect(result.success).to.equal(true, result.error);

      result = await executionResult(
        SET.limbo.configureCrossingParameters(this.aave.address, 20000000000, "-1000", true, 10000000)
      );
      expect(result.success).to.equal(true, result.error);

      //set flash loan params
      result = await executionResult(
        this.flashGovernance.configureFlashGovernance(
          this.eye.address,
          21000000, //amount to stake
          604800, //lock duration = 1 week,
          true // asset is burnable
        )
      );
      expect(result.success).to.equal(true, result.error);

      result = await executionResult(SET.limbo.endConfiguration(SET.limboDAO.address));
      expect(result.success).to.equal(true, result.error);

      //stake requisite tokens, try again and succeed.
      await this.eye.approve(
        this.flashGovernance.address,
        "115792089237316195423570985008687907853269984665640564039457584007913129639935"
      );
      const eyeBalanceBeforeEveryThing = await this.eye.balanceOf(this.flashGovernance.address);
      console.log("eyeBalanceBeforeEveryThing", eyeBalanceBeforeEveryThing.toString());
      const userBalanceBeforeFirstCall = await this.eye.balanceOf(owner.address);
      await SET.limbo.adjustSoul(this.aave.address, 20000000001, -1001, 10000001);
      const userBalanceAfterFirstCall = await this.eye.balanceOf(owner.address);
      expect(userBalanceAfterFirstCall.toString()).to.equal(userBalanceBeforeFirstCall.sub(21000000).toString());

      await advanceTime(605800); // more than enough time.

      const ConfigureFlashGovernanceProposalFactory = await ethers.getContractFactory(
        "ConfigureFlashGovernanceProposal"
      );
      const configureFlashGovernanceProposal = await ConfigureFlashGovernanceProposalFactory.deploy(
        SET.limboDAO.address,
        "flashGovProposal"
      );

      await this.eye.mint(requireFate.mul(10000000));
      await this.eye.approve(
        SET.limboDAO.address,
        "115792089237316195423570985008687907853269984665640564039457584007913129639935"
      );
      await SET.limboDAO.burnAsset(this.eye.address, requireFate, false);

      await configureFlashGovernanceProposal.parameterize(
        this.eye.address,
        newDepositRequirement, //amount to stake
        604800, //lock duration = 1 week,
        true // asset is burnable
      );

      await toggleWhiteList(configureFlashGovernanceProposal.address);

      let fateBalance = await SET.limboDAO.fateState(owner.address);
      console.log("Fate before burn (JS) " + fateBalance[1]);

      fateBalance = await SET.limboDAO.fateState(owner.address);
      console.log("Fate before proposal (JS) " + fateBalance[1]);
      let expectedArgs = [];
      expectedArgs["proposal"] = configureFlashGovernanceProposal.address;
      expectedArgs["status"] = "SUCCESS";

      let proposalTX = await this.proposalFactory.lodgeProposal(configureFlashGovernanceProposal.address);
      let receipt: ContractReceipt = await proposalTX.wait();

      let eventAssertionResult = await assertLog(receipt.events, "LodgingStatus", expectedArgs);

      expect(eventAssertionResult.reason).to.equal("", eventAssertionResult.details);

      result = await executionResult(SET.limboDAO.vote(configureFlashGovernanceProposal.address, "100"));
      expect(result.success).to.equal(true, result.error);

      await advanceTime(100000000);
      await SET.limboDAO.executeCurrentProposal();

      const eyeBalanceBeforeSecondJudgment = await this.eye.balanceOf(this.flashGovernance.address);
      const userBalanceBeforeSecondCall = await this.eye.balanceOf(owner.address);
      console.log("JS: userBalanceBeforeSecondCall ", userBalanceBeforeSecondCall.toString());
      console.log("JS: contractBalanceBeforeSecondCall ", eyeBalanceBeforeSecondJudgment.toString());
      result = await executionResult(SET.limbo.adjustSoul(this.aave.address, 20000000001, -1001, 10000001));
      expect(result.success).to.equal(true, result.error);

      const userBalanceAfterSecondCall = await this.eye.balanceOf(owner.address);
      const eyeBalanceAfterSecondJudgment = await this.eye.balanceOf(this.flashGovernance.address);

      const netAmount = newDepositRequirement - initialStakeAmount;
      console.log("netAmount " + netAmount);
      console.log("change :" + userBalanceAfterSecondCall.sub(userBalanceBeforeSecondCall).toString());
      expect(userBalanceBeforeSecondCall.sub(userBalanceAfterSecondCall).toString()).to.equal(netAmount.toString());

      expect(eyeBalanceAfterSecondJudgment.sub(eyeBalanceBeforeSecondJudgment)).to.equal(netAmount.toString());
    });
  });

  it("t-38. User with pending rewards gets rewards when staking zero tokens", async function () {
    //make a threshold pool.
    await SET.limbo.configureSoul(this.aave.address, 10000000, 1, 1, 0, 10000000);
    await SET.limbo.endConfiguration(SET.limboDAO.address);

    const flanBalanceBefore = await this.flan.balanceOf(owner.address);

    //stake tokens
    await this.aave.approve(SET.limbo.address, "10000001");
    await SET.limbo.stake(this.aave.address, "10000");
    //fast forward time
    await advanceTime(90000); //just over a day

    //stake zero tokens
    await SET.limbo.stake(this.aave.address, "0");

    const flanImmediatelyAfterSecondStake = await this.flan.balanceOf(owner.address);

    const flanBalanceChangeAgterSecondStake = flanImmediatelyAfterSecondStake.sub(flanBalanceBefore);
    const numberCloseResult = numberClose(flanBalanceChangeAgterSecondStake, "900000000000")
    assert.isTrue(numberCloseResult.close, numberCloseResult.message)
  });

  it("t-39. Ending configuration with wrong DAO or by wrong user fails. Correct user passes and ends configuration user", async function () {
    const daoFactory = await ethers.getContractFactory("LimboDAO");

    const wrongDAO = await daoFactory.deploy();

    await expect(SET.limbo.endConfiguration(wrongDAO.address)).to.be.revertedWith(
      `BackrunDetected("${wrongDAO.address}", "${SET.limboDAO.address}")`
    );

    await expect(SET.limbo.connect(secondPerson).endConfiguration(SET.limboDAO.address)).to.be.revertedWith(
      `AccessDenied("${owner.address}", "${secondPerson.address}")`
    );

    const result = await executionResult(SET.limbo.endConfiguration(SET.limboDAO.address));
    expect(result.success).to.equal(true, result.error);

    const configLord = await SET.limbo.temporaryConfigurationLord();
    expect(configLord.substring(0, 8)).to.equal("0x000000");
  });

  it("t-40. Minting more than aggregate allowance reverts", async function () {
    const flan: Types.Flan = this.flan as Types.Flan;
    const dao = SET.limboDAO as Types.LimboDAO;
    const eye = this.eye as Types.ERC20Burnable;
    const proposalFactory = this.proposalFactory as Types.ProposalFactory;

    const flanMinterFactory = (await ethers.getContractFactory("FlanMinter")) as Types.FlanMinter__factory;
    const flanMinter = await flanMinterFactory.deploy(flan.address);

    const requireFate = (await dao.proposalConfig()).requiredFateStake;
    await dao.burnAsset(eye.address, requireFate, false);
    const approveFlanMintingProposalFactory = (await ethers.getContractFactory(
      "ApproveFlanMintingProposal"
    )) as Types.ApproveFlanMintingProposal__factory;
    const approveFlanMintingProposal = await approveFlanMintingProposalFactory.deploy(dao.address, "minter");

    await toggleWhiteList(approveFlanMintingProposal.address);
    await approveFlanMintingProposal.parameterize(flanMinter.address, true);
    await expect(proposalFactory.lodgeProposal(approveFlanMintingProposal.address))
      .to.emit(proposalFactory, "LodgingStatus")
      .withArgs(approveFlanMintingProposal.address, "SUCCESS");
    await dao.vote(approveFlanMintingProposal.address, "1000000");
    await advanceTime(1000000000000);

    await dao.executeCurrentProposal();

    await flan.setMintConfig("10000000000000000000", "0");
    await flanMinter.mintAlot(10);
    await expect(flanMinter.mintAlot(1)).to.be.revertedWith(
      `MaxMintPerEpochExceeded(10000000000000000000, 11000000000000000000)`
    );
  });

  it("t-41. Cannot set soul to unset once it has left this state", async function () {
    const initialState = await (await SET.limbo.souls(this.aave.address, 0)).state
    expect(initialState).to.equal(0)//unset

    await SET.limbo.configureSoul(this.aave.address, 1000, 1, 1, 0, 10) // staking
    await expect(SET.limbo.configureSoul(this.aave.address, 1000, 1, 0, 0, 10))
      .to.be
      .revertedWith('CannotFallBackIntoUnset')

    await SET.limbo.configureSoul(this.aave.address, 1000, 1, 2, 0, 10) // waiting to cross
    await expect(SET.limbo.configureSoul(this.aave.address, 1000, 1, 0, 0, 10))
      .to.be
      .revertedWith('CannotFallBackIntoUnset')

    await SET.limbo.configureSoul(this.aave.address, 1000, 1, 3, 0, 10) // crossed over
    await expect(SET.limbo.configureSoul(this.aave.address, 1000, 1, 0, 0, 10))
      .to.be
      .revertedWith('CannotFallBackIntoUnset')
  })

  it("t-42. unstake previous rounds works", async function () {

    await SET.limbo.configureSoul(this.aave.address, 100, 1, 1, 0, 10000000);

    const flanBalanceBefore = await this.flan.balanceOf(owner.address);

    //stake tokens
    await this.aave.approve(SET.limbo.address, "10000001");
    await SET.limbo.stake(this.aave.address, "10000");
    //fast forward time
    await advanceTime(90000); //just over a day

    await SET.limbo.configureSoul(this.aave.address, 10000000, 1, 3, 0, 10000000);
    await SET.limbo.configureSoul(this.aave.address, 10000000, 1, 1, 1, 10000000);

    const latestIndex = await SET.limbo.latestIndex(this.aave.address)
    expect(latestIndex).to.equal(1)

    const balanceBefore = await this.aave.balanceOf(owner.address)
    await SET.limbo.unstakeFor(this.aave.address, 10000, owner.address, 0)
    const balanceAfter = await this.aave.balanceOf(owner.address)

    expect(balanceAfter.sub(balanceBefore).toString()).to.equal('10000')
  })
  //TESTS END
});
