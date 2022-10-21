// const { expect, assert } = require("chai");
const { create } = require("domain");
import { ethers, network } from "hardhat";
import { expect } from "chai";
import { executionResult, IExecutionResult, numberClose, queryChain } from "./helpers";
import * as TypeChainTypes from "../typechain";
import { BigNumber } from "ethers";
const requireCondition = (condition, message) => {
  if (!condition) throw message;
};


describe("DAO staking", function () {
  let owner, secondPerson, proposalFactory, feeSetter, dai, eye, link, sushi;
  let daiEYESLP, linkEYESLP, sushiEYESLP, daiSushiSLP;
  let daiEYEULP, linkEYEULP, sushiEYEULP, daiSushiULP;
  let GovernableStubFactory, sushiSwapFactory, uniswapFactory, flashGovernance;
  let dao: TypeChainTypes.LimboDAO = {} as TypeChainTypes.LimboDAO
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

    dao = await daoFactory.deploy() as TypeChainTypes.LimboDAO;

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
    await eye.mint("1000000000000000000000000");
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
    const ONE = 1000000000000000000n;
    await dao.makeLive();

    /*
    NOTE: in the WatchPug follow up audit, it was found that staking the same amount multiple times allows an attacker to inflate their fate per day.
    The call should be idempotent. In other words, multiple calls to stake for a given amount should not change the fate per day 
    (to pedantic readers, multiple calls is included in the definition of idempotent)
    @dev we use number close for fateBalance because of minor non deterministic timestamp variance
    */
    let iterations = Math.floor(Math.random() * 4 + 2) // random amount of runs between 2 and 6 times
    console.log('stake run on first stake ' + iterations + ' times')
    let result: IExecutionResult = {} as IExecutionResult
    for (let i = 0; i < iterations; i++) {
      result = await executionResult(dao.setEYEBasedAssetStake(10000, 10000, 100, eye.address, false));
      expect(result.success).to.equal(true, result.error);
    }

    await advanceTime(21600); // 6 hours

    result = await executionResult(dao.incrementFateFor(owner.address));
    expect(result.success).to.equal(true, result.error);

    let fateState = await dao.fateState(owner.address);
    expect(numberClose(fateState.fateBalance, "25001157407", 10n)).to.equal(true, `expected close to: ${25001157407}, actual: ${fateState.fateBalance}`);

    result = await executionResult(dao.setEYEBasedAssetStake(400n * ONE, 400n * ONE, 20000000000n, eye.address, false));
    expect(result.success).to.equal(true, result.error);

    await advanceTime(172800); //2 days
    result = await executionResult(dao.incrementFateFor(owner.address));
    expect(result.success).to.equal(true, result.error);

    fateState = await dao.fateState(owner.address);
    expect(fateState.fatePerDay.toString()).to.equal("20000000000000000000");
    expect(numberClose(fateState.fateBalance, '40000231706484953502', 10n)).to.equal(true, `expected close to: ${40000231706484953502}, actual: ${fateState.fateBalance}`);

    iterations = Math.floor(Math.random() * 4 + 2) // random amount of runs between 2 and 6 times
    console.log('stake run on second stake ' + iterations + ' times')
    for (let i = 0; i < iterations; i++) {
      result = await executionResult(
        dao.setEYEBasedAssetStake(62500n * ONE, 62500n * ONE, 250000000000n, eye.address, false)
      );
      expect(result.success).to.equal(true, result.error);
    }

    await advanceTime(28800); //8 hours

    result = await executionResult(dao.incrementFateFor(owner.address));
    expect(result.success).to.equal(true, result.error);

    fateState = await dao.fateState(owner.address);
    expect(numberClose(fateState.fateBalance, '123345601876857638883', 10n)).to.equal(true, `expected close to ${123345601876857638883}, actual: ${fateState.fateBalance}`);
  });

  it("5. Staking LP set growth to 2 root eye balance", async function () {
    await dao.makeLive();
    const finalEyeBalance = 30n * ONE;
    const finalAssetBalance = 5n * ONE;
    const lpBalanceBefore = await daiEYESLP.balanceOf(owner.address);
    advanceTime(10000);

    await dao.incrementFateFor(owner.address)
    let result = await executionResult(
      dao.setEYEBasedAssetStake(finalAssetBalance, finalEyeBalance.toString(), "5477225575", daiEYESLP.address, false)
    );
    expect(result.success).to.equal(true, result.error);

    const lpBalanceAfter = await daiEYESLP.balanceOf(owner.address);
    expect(lpBalanceBefore.sub(lpBalanceAfter).toString()).to.equal(finalAssetBalance.toString());

    let fateState = await dao.fateState(owner.address);
    expect(fateState.fatePerDay.toString()).to.equal((5477225575000000000n * 2n).toString());

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
    /*
   NOTE: in the WatchPug follow up audit, it was found that staking the same amount multiple times allows an attacker to inflate their fate per day.
   The call should be idempotent. In other words, multiple calls to stake for a given amount should not change the fate per day 
   (to pedantic readers, multiple calls is included in the definition of idempotent)
   @dev we use number close for fateBalance because of minor non deterministic timestamp variance
   */
    let iterations = Math.floor(Math.random() * 4 + 2) // random amount of runs between 2 and 6 times
    console.log('stake run on first stake ' + iterations + ' times')
    let result: IExecutionResult = {} as IExecutionResult
    for (let i = 0; i < iterations; i++) {
      const fateBefore = (await dao.fateState(owner.address)).fateBalance
      const fatePerDayBefore = (await dao.fateState(owner.address)).fatePerDay
      result = await executionResult(dao.setEYEBasedAssetStake(
        finalAssetBalance,
        finalEyeBalance.toString(),
        rootEYEOfLP.toString(),
        daiEYEULP.address,
        true
      ))
      expect(result.success).to.equal(true, result.error)
      const fateAfter = (await dao.fateState(owner.address)).fateBalance
      const fatePerDayAfter = (await dao.fateState(owner.address)).fatePerDay
      if (i > 1) {
        expect(numberClose(fateBefore, fateAfter))
        expect(numberClose(fatePerDayBefore, fatePerDayAfter, 10n))
      }

    }
    await advanceTime(432000) // 5 days
    await dao.incrementFateFor(owner.address)
    const fateAfter5Days = (await dao.fateState(owner.address)).fateBalance
    expect(numberClose(fateAfter5Days, '54772636112887152775', 10n)).to.equal(true, `expected close to ${'54772636112887152775'}, actual ${fateAfter5Days}`)

    const balanceOfDaiEYESLPAftertake = await daiEYEULP.balanceOf(owner.address);

    expect(balanceOfDaiEYESLPBeforeStake.sub(balanceOfDaiEYESLPAftertake).toString()).to.equal(
      finalAssetBalance.toString()
    );

    const eyeBalanceBeforeStake = await eye.balanceOf(owner.address);
    await dao.setEYEBasedAssetStake(100, 100, 10, eye.address, false);
    const eyeBalanceAfterStake = await eye.balanceOf(owner.address);
    expect(eyeBalanceBeforeStake.sub(eyeBalanceAfterStake).toString()).to.equal("100");

    let fateState = await dao.fateState(owner.address);
    let expectedFateWeight = 10n + rootEYEOfLP * 2n * 1000000000n;
    expect(numberClose(fateState.fatePerDay, expectedFateWeight)).to.be.true;

    await dao.setEYEBasedAssetStake(81, 81, 9, eye.address, false);

    const eyeBalanceAfterReducedStake = await eye.balanceOf(owner.address);
    expect(eyeBalanceAfterReducedStake.sub(eyeBalanceAfterStake).toString()).to.equal("19");

    fateState = await dao.fateState(owner.address);
    expectedFateWeight -= 1n;
    expect(numberClose(fateState.fatePerDay, expectedFateWeight)).to.equal(true);

    finalEyeBalance = 21428571428000000000n;
    finalAssetBalance = 3571428571435555566n;
    rootEYEOfLP = 4629100498n;


    await dao.setEYEBasedAssetStake(
      finalAssetBalance,
      finalEyeBalance.toString(),
      rootEYEOfLP.toString(),
      daiEYESLP.address,
      false
    )



    const daiEYESLPBalanceAfterReducedStake = await daiEYESLP.balanceOf(owner.address);
    const difference = BigInt(daiEYESLPBalanceAfterReducedStake.sub(balanceOfDaiEYESLPAftertake).toString());
    expect(difference >= 2075527328640318845352n).to.be.true;

    expectedFateWeight = rootEYEOfLP * 2n;
    let clout = await dao.stakedUserAssetWeight(owner.address, daiEYESLP.address);
    expect(clout.fateWeight.toString()).to.equal(expectedFateWeight.toString());


  });

  it("7. burn eye gives 10x fate", async function () {
    await dao.makeLive();
    const fateBefore = await dao.fateState(owner.address);
    await expect(fateBefore[1].toString()).to.equal("0");

    const eyeSupplyBefore = await eye.totalSupply();
    const lpBalanceOfDAOBefore = await linkEYEULP.balanceOf(dao.address);
    advanceTime(10000);
    await dao.incrementFateFor(owner.address)

    await dao.burnAsset(eye.address, 1000, false); //1000* 10 => 10000 Fate
    await dao.burnAsset(linkEYEULP.address, 64, true); //14 EYE => 280 FATE
    const lpBalanceOfDAOAfter = await linkEYEULP.balanceOf(dao.address);
    const eyeSupplyAfter = await eye.totalSupply();

    expect(eyeSupplyBefore.sub(eyeSupplyAfter).toString()).to.equal("1000");
    expect(lpBalanceOfDAOAfter.sub(lpBalanceOfDAOBefore).toString()).to.equal("64");

    const fateAfter = await dao.fateState(owner.address);

    await expect(numberClose(fateAfter[1].sub(fateBefore[1]), "16400", 10n)).to.equal(true);
  });

  it("8. Fate spender can burn or transfer fate balance", async function () {
    //ARRANGE
    //deploy SimpleFateSpender
    const limboDAO: TypeChainTypes.LimboDAO = dao as TypeChainTypes.LimboDAO;
    const simpleFactory: TypeChainTypes.SimpleFateSpender__factory = (await ethers.getContractFactory(
      "SimpleFateSpender"
    )) as TypeChainTypes.SimpleFateSpender__factory;
    const simpleFateSpender: TypeChainTypes.SimpleFateSpender = (await simpleFactory.deploy(
      limboDAO.address
    )) as TypeChainTypes.SimpleFateSpender;
    const EYE = eye as TypeChainTypes.ERC20Burnable;
    await limboDAO.setFateSpender(simpleFateSpender.address, true);

    await limboDAO.makeLive();

    await EYE.approve(limboDAO.address, "10000000000000");
    await limboDAO.burnAsset(EYE.address, "10000000000000", false);

    const fateStateOfOwnerBeforeBurn = await limboDAO.fateState(owner.address);

    const fateStateOfSecondPersonBeforeBurn = await limboDAO.fateState(secondPerson.address);

    //ACT
    await simpleFateSpender.reduceBalance(owner.address);

    const fateStateOfOwnerAfterBurn = await limboDAO.fateState(owner.address);
    console.log("fateStateAfter", fateStateOfOwnerAfterBurn.fateBalance.toString());
    const fateStateOfSecondPersonAfterBurn = await limboDAO.fateState(secondPerson.address);
    console.log("fateStateAfter", fateStateOfSecondPersonAfterBurn.fateBalance.toString());

    await simpleFateSpender.transfer(owner.address, secondPerson.address, 2000);

    const fateStateOfOwnerAfterTransfer = await limboDAO.fateState(owner.address);
    console.log("fateStateAfter", fateStateOfOwnerAfterTransfer.fateBalance.toString());
    const fateStateOfSecondPersonAfterTransfer = await limboDAO.fateState(secondPerson.address);
    console.log("fateStateAfter", fateStateOfSecondPersonAfterTransfer.fateBalance.toString());

    //ASSERT
    const expectedPostBurnBalance = BigNumber.from(fateStateOfOwnerBeforeBurn.fateBalance.toString()).div(2);
    expect(fateStateOfOwnerAfterBurn.fateBalance.toString()).to.equal(expectedPostBurnBalance.toString());

    expect(fateStateOfSecondPersonAfterBurn.fateBalance.toNumber()).to.equal(0);

    expect(fateStateOfOwnerAfterTransfer.fateBalance.toString()).to.equal(expectedPostBurnBalance.sub(2000).toString());
    expect(fateStateOfSecondPersonAfterTransfer.fateBalance.toNumber()).to.equal(2000);
  });
});
