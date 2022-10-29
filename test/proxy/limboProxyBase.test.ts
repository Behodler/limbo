import { deploy, executionResult, numberClose, queryChain } from "../helpers";

const { expect, assert } = require("chai");
import { ethers, network } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import * as Types from "../../typechain";
import { BigNumber, ContractFactory } from "ethers";
const web3 = require("web3");

interface TestSet {
  BaseToken: Types.MockToken;
  Flan: Types.Flan;
  Registry: Types.TokenProxyRegistry;
  DAO: Types.LimboDAO;
  Limbo: Types.Limbo;
  Behodler:Types.MockBehodler
  ZERO: BigNumber;
  ONE: BigNumber;
  TEN: BigNumber;
  TWO: BigNumber;
  HALF: BigNumber;
  MILLION: BigNumber;
  TEN_K: BigNumber;
  FINNEY: BigNumber;
  DECAFINNEY: BigNumber;
  SZABO: BigNumber;
  owner: SignerWithAddress;
  secondary: SignerWithAddress;
  LimboProxy: Types.LimboProxy;
}

const getBigNumber = (value: string): BigNumber => BigNumber.from(value);

describe("limbo proxy test", function () {
  let SET = {} as TestSet;
  let daieyeSLP, linkeyeSLP, sushieyeSLP, daiSushiSLP;
  let daieyeULP, linkeyeULP, sushieyeULP, daiSushiULP;
  let link, sushi;
  let toggleWhiteList;
  this.beforeEach(async function () {
    [SET.owner, SET.secondary] = await ethers.getSigners();
    SET.MILLION = getBigNumber("1000000000000000000000000");
    SET.TEN_K = SET.MILLION.div(100);
    SET.ONE = getBigNumber("1000000000000000000");
    SET.TEN = SET.ONE.mul(10);
    SET.HALF = getBigNumber("500000000000000000");
    SET.TWO = getBigNumber("2000000000000000000");
    SET.FINNEY = getBigNumber("1000000000000000");
    SET.DECAFINNEY = SET.FINNEY.div(10);
    SET.SZABO = SET.FINNEY.div(1000);
    SET.ZERO = getBigNumber("0");

    const MockTokenFactory = await ethers.getContractFactory("MockToken");
    SET.BaseToken = await deploy<Types.MockToken>(MockTokenFactory, "MockToken", "MT", [], []);
    await SET.BaseToken.mint(SET.TEN_K);

    const UniswapFactoryFactory = await ethers.getContractFactory("UniswapV2Factory");
    const UniswapPairFactory = await ethers.getContractFactory("UniswapV2Pair");

    this.sushiSwapFactory = await UniswapFactoryFactory.deploy(SET.owner.address);
    this.uniswapFactory = await UniswapFactoryFactory.deploy(SET.owner.address);
    const sanityCheck = sanityCheckMaker(false);
    sanityCheck(this.sushiSwapFactory.address !== this.uniswapFactory.address);

    const RouterFactory = await ethers.getContractFactory("UniswapV2Router02");
    const sushiRouter = await RouterFactory.deploy(this.sushiSwapFactory.address, SET.owner.address);
    const uniRouter = await RouterFactory.deploy(this.uniswapFactory.address, SET.owner.address);
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
    SET.Behodler = this.mockBehodler;
    const SafeERC20Factory = await ethers.getContractFactory("SafeERC20");
    const daoFactory = await ethers.getContractFactory("LimboDAO");

    this.limboDAO = await daoFactory.deploy();
    const flashGovernanceFactory = await ethers.getContractFactory("FlashGovernanceArbiter");
    this.flashGovernance = await flashGovernanceFactory.deploy(this.limboDAO.address);

    await this.limboDAO.setFlashGoverner(this.flashGovernance.address);
    const tempConfigLord = await this.flashGovernance.temporaryConfigurationLord();

    await this.flashGovernance.configureSecurityParameters(10, 100, 30);

    // await this.eye.approve(this.limbo.address, 2000);
    await this.flashGovernance.configureFlashGovernance(this.eye.address, 1000, 10, true);

    const FlanFactory = await ethers.getContractFactory("Flan");
    this.flan = await FlanFactory.deploy(this.limboDAO.address);
    SET.Flan = this.flan;
    await this.flan.setMintConfig("100000000000000000000000000000000000", 0);
    const createGov = await metaPairFactory(SET.Behodler, this.uniswapFactory, false);
    await this.flan.mint(SET.owner.address, "100000000000000000000000");
    //we need Dai/SCX, FLN/SCX and SCX/(FLN/SCX)
    this.flanSCX = await createGov(this.flan);
    this.daiSCX = await createGov(this.dai);

    const CreateMetaflanSCX = await metaPairFactory(this.flanSCX, this.uniswapFactory, false);
    const SCX_fln_scx = await CreateMetaflanSCX(SET.Behodler);

    const token0 = await SCX_fln_scx.token0();
    const token1 = await SCX_fln_scx.token1();
    [token0, token1].forEach((token, i) => {
      sanityCheck(
        token === this.flanSCX.address || token === SET.Behodler.address,
        `MetaFlanSCX pair incorrectly setup. Token: ${token}, this.flanSCX: ${this.flanSCX.address}, SCX: ${SET.Behodler.address}`,
        "LP of SCX / (FLN/SCX) successfully tested for token " + i
      ); //Uniswap checks for token0===token1 so no need for me to replicate that
    });

    await simpleTrade(this.dai, this.daiSCX);
    await simpleTrade(SET.Behodler, this.flanSCX);
    await simpleTrade(SET.Behodler, SCX_fln_scx);

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
    this.limbo = await LimboFactory.deploy(
      this.flan.address,
      //  10000000,
      this.limboDAO.address
    );

    //enable flash governance on Limbo
    await this.flashGovernance.setGoverned([this.limbo.address], [true]);

    await this.flan.whiteListMinting(this.limbo.address, true);
    await this.flan.whiteListMinting(SET.owner.address, true);
    // await this.flan.endConfiguration(this.limboDAO.address);

    const firstProposalFactory = await ethers.getContractFactory("ToggleWhitelistProposalProposal");
    this.whiteListingProposal = await firstProposalFactory.deploy(this.limboDAO.address, "toggle whitelist");

    const LimboOracleFactory = await ethers.getContractFactory("LimboOracle");
    this.sushiOracle = await LimboOracleFactory.deploy(this.sushiSwapFactory.address, this.limboDAO.address);
    this.uniOracle = await LimboOracleFactory.deploy(this.uniswapFactory.address, this.limboDAO.address);

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
      this.limboDAO.address,
      "hello",
      this.limbo.address,
      this.morgothTokenApprover.address
    );

    //  const flanSCXPair = await this.sushiSwapFactory.
    this.ProposalFactoryFactory = await ethers.getContractFactory("ProposalFactory");
    this.proposalFactory = await this.ProposalFactoryFactory.deploy(
      this.limboDAO.address,
      this.whiteListingProposal.address,
      this.soulUpdateProposal.address
    );

    await this.limboDAO.seed(
      this.limbo.address,
      this.flan.address,
      this.eye.address,
      this.proposalFactory.address,
      this.sushiOracle.address,
      this.uniOracle.address,
      [this.metadaieyeSLP.address, this.metalinkeyeSLP.address, this.metasushieyeSLP.address],
      [this.metadaieyeULP.address, this.metalinkeyeULP.address, this.metasushieyeULP.address]
    );
    SET.DAO = this.limboDAO;
    SET.Limbo = this.limbo;
    const RegistryFactory = await ethers.getContractFactory("TokenProxyRegistry");
    SET.Registry = await deploy<Types.TokenProxyRegistry>(RegistryFactory, SET.DAO.address,SET.Behodler.address);

    const limboProxyFactory = await ethers.getContractFactory("LimboProxy");
    SET.LimboProxy = await deploy<Types.LimboProxy>(
      limboProxyFactory,
      SET.BaseToken.address,
      "horse",
      "h1",
      SET.Registry.address,
      SET.Limbo.address,
      SET.Flan.address,
      SET.ONE
    );
    await SET.LimboProxy.approveLimbo();

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
        this.limboDAO.address,
        "115792089237316195423570985008687907853269984665640564039457584007913129639935"
      );
    }
    await this.limbo.setDAO(this.limboDAO.address);

    await this.limboDAO.makeLive();

    const addTokenPowerFactory = await ethers.getContractFactory("MockAddTokenPower");
    this.addTokenPower = await addTokenPowerFactory.deploy(
      this.mockAngband.address,
      this.limbo.address,
      "0x0000000000000000000000000000000000000000"
    );

    await this.addTokenPower.seed(this.mockBehodler.address, this.limbo.address);
    await SET.Behodler.setTokenPower(this.addTokenPower.address);

    const SoulReaderFactory = await ethers.getContractFactory("SoulReader");
    this.soulReader = await SoulReaderFactory.deploy();

    const UniswapHelperFactory = await ethers.getContractFactory("UniswapHelper");
    this.uniswapHelper = await UniswapHelperFactory.deploy(this.limbo.address, this.limboDAO.address) as Types.UniswapHelper
    await this.flan.whiteListMinting(this.uniswapHelper.address, true);

    const migrationTokenPairFactory = await ethers.getContractFactory("MockMigrationUniPair");
    this.migrationTokenPair = await migrationTokenPairFactory.deploy("uni", "uni");
    await this.migrationTokenPair.setReserves(1000, 3000);

    await this.uniswapHelper.setDAI(this.dai.address);
    await advanceTime(1000);
    await this.uniswapHelper.configure(
      this.limbo.address,
      this.mockBehodler.address,
      this.flan.address,
      0,
      this.uniOracle.address
    );

    await this.limbo.configureCrossingParameters(this.aave.address, 1, 1, true, 10000010);

    await this.limbo.configureCrossingConfig(
      this.mockBehodler.address,
      this.mockAngband.address,
      this.uniswapHelper.address,
      this.addTokenPower.address,
      10000000,
      10000
    );

    toggleWhiteList = toggleWhiteListFactory(this.eye, this.limboDAO, this.whiteListingProposal, this.proposalFactory);

    const TokenProxyRegistry = await ethers.getContractFactory("TokenProxyRegistry");
    this.registry = await TokenProxyRegistry.deploy(this.limboDAO.address, this.mockBehodler.address);
    await SET.Limbo.configureSoul(SET.LimboProxy.address, SET.TEN, 1, 1, 0, 10000000);
    console.log("end of setup");
  });

  const sanityCheckMaker = (canLog) => (condition: boolean, fail_message?: string, success_message?: string) => {
    const logger = logFactory(canLog);
    if (!condition) throw fail_message;
    success_message = !success_message ? "" : " : " + success_message;
    logger(`SANITY CHECK PASSED${success_message}`);
  };

  const metaPairFactory = async (eye, factory, canLog?: boolean) => {
    const log = logFactory(canLog);
    const UniswapFactoryFactory = await ethers.getContractFactory("UniswapV2Factory");
    const uniFactory = await UniswapFactoryFactory.attach(factory.address);
    const nameLogger = printNamedAddress(canLog);
    let eyeBase = 1;
    return async (LP) => {
      log("*********metapair************");
      await nameLogger(eye.address, "outer token");
      await nameLogger(LP.address, "inner token");
      const length = await uniFactory.allPairsLength();
      await uniFactory.createPair(eye.address, LP.address);
      const metaPairAddress = await uniFactory.getPair(eye.address, LP.address);
      await nameLogger(metaPairAddress, "metapair");

      const LPBalance = await LP.balanceOf(SET.owner.address);
      log(`LP balance ${await LP.balanceOf(SET.owner.address)}, eye balance ${await eye.balanceOf(SET.owner.address)}`);

      await LP.transfer(metaPairAddress, LPBalance.div(10));

      const eyeBalance = await eye.balanceOf(SET.owner.address);

      log("eye balance " + (await eye.balanceOf(SET.owner.address)).toString());
      await eye.transfer(metaPairAddress, `${eyeBalance.div(10)}`);
      log("post transfer");
      const PairFactory = await ethers.getContractFactory("UniswapV2Pair");
      const metaPair = await PairFactory.attach(metaPairAddress);
      log("mint");
      await metaPair.mint(SET.owner.address);
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
    const UniswapV2PairFactory = (await ethers.getContractFactory("UniswapV2Pair")) as ContractFactory;
    return UniswapV2PairFactory.attach(pairAddress);
  };

  const simpleTrade = async (inputToken, pair) => {
    const balanceOfInputBefore = await inputToken.balanceOf(SET.owner.address);
    expect(balanceOfInputBefore.gt(100000)).to.be.true;
    await inputToken.transfer(pair.address, balanceOfInputBefore.div(100));
    try {
      await pair.swap("0", balanceOfInputBefore.div(10000), SET.owner.address, []);
    } catch (e) {
      try {
        await pair.swap(balanceOfInputBefore.div(10000), "0", SET.owner.address, []); // ordering issue
      } catch (inner) {
        throw "simpleTrade failed " + inner; // get 5stake trace
      }
    }
    //
    const balanceOfInptAfter = await inputToken.balanceOf(SET.owner.address);

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
      await uniPair.swap("0", "10000000000000000000", SET.owner.address, []);
      //not working from here

      //trade metaLP
      const metaPair = await UniswapPairFactory.attach(metaPairAddress);

      await commonToken.transfer(metaPairAddress, "1000000000000000000000");
      await metaPair.swap("0", "10000000000000000000", SET.owner.address, []);
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

  const logFactory = (log) => {
    let counter = 0;
    return (message) => {
      if (log) console.log(`${counter++}: ${message}`);
    };
  };

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

  it("t0. setup test", async function () {});

  it("t1. staking and unstaking works correctly", async function () {
    const baseTokenBalanceBeforeStake = await SET.BaseToken.balanceOf(SET.owner.address);
    await SET.BaseToken.approve(SET.LimboProxy.address, SET.TEN_K);
    await SET.LimboProxy.stake(SET.ONE);
    const baseTokenBalanceAfterStake = await SET.BaseToken.balanceOf(SET.owner.address);
    expect(baseTokenBalanceBeforeStake.sub(baseTokenBalanceAfterStake).toString()).to.equal(SET.ONE.toString());

    const userInfoBefore = await SET.Limbo.userInfo(SET.LimboProxy.address, SET.owner.address, 0);
    expect(userInfoBefore.stakedAmount).to.equal(SET.ONE);

    await SET.Limbo.approveUnstake(SET.LimboProxy.address, SET.LimboProxy.address, SET.TWO);

    await SET.LimboProxy.unstake(SET.ONE,0);
    const baseTokenBalanceAfterUnstake = await SET.BaseToken.balanceOf(SET.owner.address);
    expect(baseTokenBalanceAfterUnstake.sub(baseTokenBalanceAfterStake).toString()).to.equal(SET.ONE.toString());

    const userInfoAfter = await SET.Limbo.userInfo(SET.LimboProxy.address, SET.owner.address, 0);
    expect(userInfoAfter.stakedAmount).to.equal(SET.ZERO);
  });

  it("t2. Staked user can still claim rewards", async function () {
    const flanBalanceBeforeStake = await SET.Flan.balanceOf(SET.owner.address);
    await SET.BaseToken.approve(SET.LimboProxy.address, SET.TEN_K);
    await SET.LimboProxy.stake(SET.ONE);

    await advanceTime(100000);

    await SET.Limbo.claimReward(SET.LimboProxy.address, 0);

    const flanBalanceAfterClaim = await SET.Flan.balanceOf(SET.owner.address);
    expect(flanBalanceAfterClaim.gt(flanBalanceBeforeStake)).to.be.true;

    const difference = flanBalanceAfterClaim.sub(flanBalanceBeforeStake);

    await advanceTime(100000);

    await SET.Limbo.approveUnstake(SET.LimboProxy.address, SET.LimboProxy.address, SET.TWO);
    await SET.LimboProxy.unstake(SET.ONE,0);

    const flanBalanceAfterUnstake = await SET.Flan.balanceOf(SET.owner.address);
    expect(flanBalanceAfterUnstake.gt(flanBalanceAfterClaim)).to.be.true;
  });
});
