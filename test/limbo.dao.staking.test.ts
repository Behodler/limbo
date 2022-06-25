// const { expect, assert } = require("chai");
const { create } = require("domain");
import { ethers, network } from "hardhat";
import { expect } from "chai";
import { executionResult, numberClose, queryChain } from "./helpers";

const requireCondition = (condition, message) => {
  if (!condition) throw message;
};

describe("DAO staking", function () {
  let owner, secondPerson, proposalFactory, feeSetter, dai, eye, link, sushi;
  let daiEYESLP, linkEYESLP, sushiEYESLP, daiSushiSLP;
  let daiEYEULP, linkEYEULP, sushiEYEULP, daiSushiULP;
  let dao, GovernableStubFactory, sushiSwapFactory, uniswapFactory, flashGovernance;
  const zero = "0x0000000000000000000000000000000000000000";
  const maxUINT = "1157920892373161954235709850086879078532699846656405640394575840079131296";
  beforeEach(async function () {
    [owner, secondPerson, proposalFactory] = await ethers.getSigners();
    const UniswapFactoryFactory = await ethers.getContractFactory("UniswapV2Factory");
    const UniswapPairFactory = await ethers.getContractFactory("UniswapV2Pair");

    sushiSwapFactory = await UniswapFactoryFactory.deploy(owner.address);
    uniswapFactory = await UniswapFactoryFactory.deploy(owner.address);
    requireCondition(sushiSwapFactory.address !== uniswapFactory.address, "factories cannot be the same contract");

    const RouterFactory = await ethers.getContractFactory("UniswapV2Router02");
    const sushiRouter = await RouterFactory.deploy(sushiSwapFactory.address, owner.address);
    const uniRouter = await RouterFactory.deploy(uniswapFactory.address, owner.address);

    const TokenFactory = await ethers.getContractFactory("SimpleMockTokenToken");
    dai = await TokenFactory.deploy("DAI", "DAI");
    link = await TokenFactory.deploy("LINK", "LINK");
    sushi = await TokenFactory.deploy("SUSHI", "SUSHI");
    eye = await TokenFactory.deploy("EYE", "EYE");
    const createSLP = await metaPairFactory(eye, sushiSwapFactory, false);
    daiEYESLP = await createSLP(dai);
    linkEYESLP = await createSLP(link);
    sushiEYESLP = await createSLP(sushi);

    const createDAISLP = await metaPairFactory(dai, sushiSwapFactory);
    daiSushiSLP = await createDAISLP(sushi);

    const createULP = await metaPairFactory(eye, uniswapFactory);
    daiEYEULP = await createULP(dai);
    linkEYEULP = await createULP(link);
    sushiEYEULP = await createULP(sushi);

    const createDAIULP = await metaPairFactory(dai, uniswapFactory);
    daiSushiULP = await createDAIULP(sushi);

    const SafeERC20Factory = await ethers.getContractFactory("SafeERC20");
    const daoFactory = await ethers.getContractFactory("LimboDAO", {});

    dao = await daoFactory.deploy();

    const flashGovernanceFactory = await ethers.getContractFactory("FlashGovernanceArbiter");
    flashGovernance = await flashGovernanceFactory.deploy(dao.address);
    await dao.setFlashGoverner(flashGovernance.address);
    GovernableStubFactory = await ethers.getContractFactory("GovernableStub");
    const limbo = await GovernableStubFactory.deploy(dao.address);
    const flan = await GovernableStubFactory.deploy(dao.address);

    const LimboOracleFactory = await ethers.getContractFactory("LimboOracle");
    this.sushiOracle = await LimboOracleFactory.deploy(sushiSwapFactory.address, dao.address);
    this.uniOracle = await LimboOracleFactory.deploy(uniswapFactory.address, dao.address);

    const sushiMetaPairCreator = await metaPairFactory(eye, sushiSwapFactory, false);
    this.metaDaiEYESLP = await sushiMetaPairCreator(daiEYESLP);
    this.metaLinkEYESLP = await sushiMetaPairCreator(linkEYESLP);
    this.metaSushiEYESLP = await sushiMetaPairCreator(sushiEYESLP);

    const uniMetaPairCreator = await metaPairFactory(eye, uniswapFactory);
    this.metaDaiEYEULP = await uniMetaPairCreator(daiEYEULP);
    this.metaLinkEYEULP = await uniMetaPairCreator(linkEYEULP);
    this.metaSushiEYEULP = await uniMetaPairCreator(sushiEYEULP);

    this.sushiTrade = await tradeOn(sushiRouter, eye);
    await this.sushiTrade(dai, false);
    await this.sushiTrade(link);
    await this.sushiTrade(sushi);

    this.uniTrade = await tradeOn(uniRouter, eye);
    await this.uniTrade(dai);
    await this.uniTrade(link);
    await this.uniTrade(sushi);

    await dao.seed(
      limbo.address,
      flan.address,
      eye.address,
      proposalFactory.address,
      this.sushiOracle.address,
      this.uniOracle.address,
      [this.metaDaiEYESLP.address, this.metaLinkEYESLP.address, this.metaSushiEYESLP.address],
      [this.metaDaiEYEULP.address, this.metaLinkEYEULP.address, this.metaSushiEYEULP.address]
    );

    const allAssets = [
      daiEYESLP,
      linkEYESLP,
      sushiEYESLP,
      daiSushiSLP,
      daiEYEULP,
      linkEYEULP,
      sushiEYEULP,
      daiSushiULP,
      eye,
    ];
    for (let i = 0; i < allAssets.length; i++) {
      await allAssets[i].approve(
        dao.address,
        "115792089237316195423570985008687907853269984665640564039457584007913129639935"
      );
    }
  });

  const advanceTime = async (seconds) => {
    await network.provider.send("evm_increaseTime", [seconds]); //6 hours
    await network.provider.send("evm_mine");
  };
  const ONE = BigInt("1000000000000000000");
  const NAUGHT_POINT_ONE = ONE / 10n;

  const bigIntify = (num) => {
    return BigInt(num.toString());
  };

  const logFactory = (log) => {
    let counter = 0;
    return (message) => {
      if (log) console.log(`${counter++}: ${message}`);
    };
  };

  const metaPairFactory = async (eye, factory, canLog?: boolean) => {
    const log = logFactory(canLog);
    const UniswapFactoryFactory = await ethers.getContractFactory("UniswapV2Factory");
    const uniFactory = await UniswapFactoryFactory.attach(factory.address);

    let eyeBase = 1;
    return async (LP) => {
      const length = await uniFactory.allPairsLength();
      await uniFactory.createPair(eye.address, LP.address);
      const metaPairAddress = await uniFactory.getPair(eye.address, LP.address);
      const LPBalance = await LP.balanceOf(owner.address);
      log(`LP balance ${await LP.balanceOf(owner.address)}, eye balance ${await eye.balanceOf(owner.address)}`);

      await LP.transfer(metaPairAddress, LPBalance.div(10));

      const eyeBalance = await eye.balanceOf(owner.address);

      await eye.transfer(metaPairAddress, `${eyeBalance.div(10)}`);
      log("post transfer");
      const PairFactory = await ethers.getContractFactory("UniswapV2Pair");
      const metaPair = await PairFactory.attach(metaPairAddress);
      log("mint");
      await metaPair.mint(owner.address);
      log("post mint");
      return metaPair;
    };
  };

  const tradeOn = async (router, eye) => {
    return async (input, canLog) => {
      const log = logFactory(canLog);
      const factoryAddress = await router.factory();
      const UniswapFactoryFactory = await ethers.getContractFactory("UniswapV2Factory");
      const uniFactory = await UniswapFactoryFactory.attach(factoryAddress);

      const baseAddress = await uniFactory.getPair(input.address, eye.address);
      const metaPairAddress = await uniFactory.getPair(baseAddress, eye.address);
      log(`baseAddress ${baseAddress}, metaPairAddress ${metaPairAddress}`);

      const UniswapPairFactory = await ethers.getContractFactory("UniswapV2Pair");
      //trade input
      const uniPair = await UniswapPairFactory.attach(baseAddress);
      await input.transfer(baseAddress, "1000000000000000000000");
      await uniPair.swap("0", "10000000000000000000", owner.address, []);

      //trade metaLP
      const metaPair = await UniswapPairFactory.attach(metaPairAddress);

      await eye.transfer(metaPairAddress, "1000000000000000000000");
      await metaPair.swap("0", "10000000000000000000", owner.address, []);
    };
  };

  it("1. only eye or approved assets can be staked", async function () {
    await dao.makeLive();
    await expect(dao.setEYEBasedAssetStake(100, 400, 20, daiSushiSLP.address, false)).to.be.revertedWith(
      `AssetNotApproved("${daiSushiSLP.address}")`
    );
    await expect(dao.setEYEBasedAssetStake(100, 400, 20, daiSushiULP.address, false)).to.be.revertedWith(
      `AssetNotApproved("${daiSushiULP.address}")`
    );
  });

  it("2. Only live staking", async function () {
    await expect(dao.setEYEBasedAssetStake(100, 400, 20, sushiEYEULP.address, false)).to.be.revertedWith("NotLive()");
  });

  it("3. Staking Eye sets fate per day to root EYE ", async function () {
    const cloutBefore = await dao.stakedUserAssetWeight(owner.address, eye.address);
    expect(cloutBefore[0].toString()).to.equal("0");
    expect(cloutBefore[1].toString()).to.equal("0");
    await dao.makeLive();

    const userBalanceBefore = await eye.balanceOf(owner.address);
    const balanceOfDAObefore = await eye.balanceOf(dao.address);
    await dao.setEYEBasedAssetStake(100, 100, 10, eye.address, false);
    const balanceOfDAOAfter = await eye.balanceOf(dao.address);
    const userBalanceAfter = await eye.balanceOf(owner.address);

    expect(balanceOfDAOAfter.sub(balanceOfDAObefore).toString()).to.equal("100");
    expect(userBalanceBefore.sub(userBalanceAfter).toString()).to.equal("100");

    const cloutAfter = await dao.stakedUserAssetWeight(owner.address, eye.address);
    expect(cloutAfter[0].toString()).to.equal("10");
    expect(cloutAfter[1].toString()).to.equal("100");
  });

  it("4. Staking Eye and wait increases fate correctly", async function () {
    await dao.makeLive();

    let result = await executionResult(dao.setEYEBasedAssetStake(10000, 10000, 100, eye.address, false));
    expect(result.success).to.equal(true, result.error);

    await advanceTime(21600); // 6 hours

    result = await executionResult(dao.incrementFateFor(owner.address));
    expect(result.success).to.equal(true, result.error);

    let fateState = await dao.fateState(owner.address);
    expect(fateState[1].toString()).to.equal("25");

    result = await executionResult(dao.setEYEBasedAssetStake(400, 400, 20, eye.address, false));
    expect(result.success).to.equal(true, result.error);

    await advanceTime(172800); //2 days
    result = await executionResult(dao.incrementFateFor(owner.address));
    expect(result.success).to.equal(true, result.error);

    fateState = await dao.fateState(owner.address);
    expect(fateState[0].toString()).to.equal("20");
    expect(fateState[1].toString()).to.equal("65");

    result = await executionResult(dao.setEYEBasedAssetStake(62500, 62500, 250, eye.address, false));
    expect(result.success).to.equal(true, result.error);

    await advanceTime(28800); //8 hours

    result = await executionResult(dao.incrementFateFor(owner.address));
    expect(result.success).to.equal(true, result.error);

    fateState = await dao.fateState(owner.address);
    expect(fateState[1].toString()).to.equal("148");
  });

  it("5. Staking LP set growth to 2 root eye balance", async function () {
    await dao.makeLive();
    const finalEyeBalance = 30n * ONE;
    const finalAssetBalance = 5n * ONE;
    const lpBalanceBefore = await daiEYESLP.balanceOf(owner.address);
    advanceTime(10000);

    let result = await executionResult(
      dao.setEYEBasedAssetStake(finalAssetBalance, finalEyeBalance.toString(), "5477225575", daiEYESLP.address, false)
    );
    expect(result.success).to.equal(true, result.error);

    const lpBalanceAfter = await daiEYESLP.balanceOf(owner.address);
    expect(lpBalanceBefore.sub(lpBalanceAfter).toString()).to.equal(finalAssetBalance.toString());

    let fateState = await dao.fateState(owner.address);
    expect(fateState[0].toString()).to.equal((5477225575n * 2n).toString());

    await this.sushiTrade(dai);

    const eyeBalanceOfMetaDai = await eye.balanceOf(this.metaDaiEYESLP.address);
    const daiEYEBalanceOfMetaDai = await daiEYESLP.balanceOf(this.metaDaiEYESLP.address);

    const newPrice = await eyeBalanceOfMetaDai.mul(1000000).div(daiEYEBalanceOfMetaDai);

    const reducedAssetBalance = 25n * NAUGHT_POINT_ONE; // 2.5
    //21428890
    const reducedFinalEyeBalance = 18659057500000000000n;
    await advanceTime(90000);

    result = await executionResult(
      dao.setEYEBasedAssetStake(
        reducedAssetBalance,
        reducedFinalEyeBalance.toString(),
        "4319613119",
        daiEYESLP.address,
        false
      )
    );
    expect(result.success).to.equal(true, result.error);
  });

  //Tests staking and unstaking
  it("6. Staking multiple asset types sets fate rate correctly", async function () {
    await dao.makeLive();
    let balanceOfDaiEYESLPBeforeStake = await daiEYEULP.balanceOf(owner.address);

    let finalEyeBalance = 30n * ONE;
    let finalAssetBalance = 5n * ONE;
    let rootEYEOfLP = 5477225575n;

    advanceTime(10000);
    await dao.setEYEBasedAssetStake(
      finalAssetBalance,
      finalEyeBalance.toString(),
      rootEYEOfLP.toString(),
      daiEYEULP.address,
      true
    );

    const balanceOfDaiEYESLPAftertake = await daiEYEULP.balanceOf(owner.address);

    expect(balanceOfDaiEYESLPBeforeStake.sub(balanceOfDaiEYESLPAftertake).toString()).to.equal(
      finalAssetBalance.toString()
    );

    const eyeBalanceBeforeStake = await eye.balanceOf(owner.address);
    await dao.setEYEBasedAssetStake(100, 100, 10, eye.address, false);
    const eyeBalanceAfterStake = await eye.balanceOf(owner.address);
    expect(eyeBalanceBeforeStake.sub(eyeBalanceAfterStake).toString()).to.equal("100");

    let fateState = await dao.fateState(owner.address);
    let expectedFateWeight = 10n + rootEYEOfLP * 2n;
    expect(fateState[0].toString()).to.equal(expectedFateWeight.toString());

    await dao.setEYEBasedAssetStake(81, 81, 9, eye.address, false);

    const eyeBalanceAfterReducedStake = await eye.balanceOf(owner.address);
    expect(eyeBalanceAfterReducedStake.sub(eyeBalanceAfterStake).toString()).to.equal("19");

    fateState = await dao.fateState(owner.address);
    expectedFateWeight -= 1n;
    expect(fateState[0].toString()).to.equal(expectedFateWeight.toString());

    finalEyeBalance = 21428571428000000000n;
    finalAssetBalance = 3571428571435555566n;
    rootEYEOfLP = 4629100498n;

    await dao.setEYEBasedAssetStake(
      finalAssetBalance,
      finalEyeBalance.toString(),
      rootEYEOfLP.toString(),
      daiEYESLP.address,
      false
    );

    const daiEYESLPBalanceAfterReducedStake = await daiEYESLP.balanceOf(owner.address);
    const difference = BigInt(daiEYESLPBalanceAfterReducedStake.sub(balanceOfDaiEYESLPAftertake).toString());
    expect(difference >= 2075527328640318845352n).to.be.true;

    expectedFateWeight = rootEYEOfLP * 2n;
    fateState = await dao.stakedUserAssetWeight(owner.address, daiEYESLP.address);
    expect(fateState[0].toString()).to.equal(expectedFateWeight.toString());
  });

  it("7. burn eye gives 10x fate", async function () {
    await dao.makeLive();
    const fateBefore = await dao.fateState(owner.address);
    await expect(fateBefore[1].toString()).to.equal("0");

    const eyeSupplyBefore = await eye.totalSupply();
    const lpBalanceOfDAOBefore = await linkEYEULP.balanceOf(dao.address);
    advanceTime(10000);

    await dao.burnAsset(eye.address, 1000, false); //1000* 10 => 10000 Fate
    await dao.burnAsset(linkEYEULP.address, 64, true); //14 EYE => 280 FATE
    const lpBalanceOfDAOAfter = await linkEYEULP.balanceOf(dao.address);
    const eyeSupplyAfter = await eye.totalSupply();

    expect(eyeSupplyBefore.sub(eyeSupplyAfter).toString()).to.equal("1000");
    expect(lpBalanceOfDAOAfter.sub(lpBalanceOfDAOBefore).toString()).to.equal("64");

    const fateAfter = await dao.fateState(owner.address);

    await expect(numberClose(fateAfter[1].sub(fateBefore[1]), "16400")).to.equal(true);
  });
});
