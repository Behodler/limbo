import { deploy, executionResult, numberClose, queryChain } from "../helpers";

const { expect, assert } = require("chai");
import { ethers, network } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import * as Types from "../../typechain";
import { BigNumber } from "ethers";
const web3 = require("web3");

interface TestSet {
  BaseToken: Types.MockToken;
  CliffFace: Types.CliffFace;
  SimilarToken: Types.MockToken;
  ReferenceToken: Types.MockToken;
  Lachesis: Types.LachesisLite;
  Behodler: Types.BehodlerLite;
  Registry: Types.TokenProxyRegistry;
  DAO: Types.ProxyDAO;
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
  UniswapFactory: Types.UniswapV2Factory;
  MainPair: Types.UniswapV2Pair;
  UniRouter: Types.UniswapV2Router02;
}

const getBigNumber = (value: string): BigNumber => BigNumber.from(value);

describe("cliffFace proxy test", function () {
  let SET = {} as TestSet;

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

    SET.SimilarToken = await deploy<Types.MockToken>(MockTokenFactory, "Similar", "MT", [], []);

    const LachesisFactory = await ethers.getContractFactory("LachesisLite");
    SET.Lachesis = await deploy<Types.LachesisLite>(LachesisFactory);

    const AddressBalanceCheckLib = await ethers.getContractFactory("AddressBalanceCheck");
    const addressBalanceCheckLibAddress = (await AddressBalanceCheckLib.deploy()).address;
    const BehodlerFactory = await ethers.getContractFactory("BehodlerLite", {
      libraries: {
        AddressBalanceCheck: addressBalanceCheckLibAddress,
      },
    });

    SET.Behodler = await deploy<Types.BehodlerLite>(BehodlerFactory);

    await SET.Lachesis.setBehodler(SET.Behodler.address);
    await SET.Behodler.setLachesis(SET.Lachesis.address);

    SET.ReferenceToken = await deploy<Types.MockToken>(MockTokenFactory, "REf", "MT", [], []);

    await SET.Lachesis.measure(SET.ReferenceToken.address, true, false);
    await SET.Lachesis.updateBehodler(SET.ReferenceToken.address);

    await SET.Lachesis.measure(SET.SimilarToken.address, true, false);
    await SET.Lachesis.updateBehodler(SET.SimilarToken.address);

    const proxyDAOFactory = (await ethers.getContractFactory("ProxyDAO")) as Types.ProxyDAO__factory;
    SET.DAO = await deploy<Types.ProxyDAO>(proxyDAOFactory);
    const TokenProxyRegistryFactory = (await ethers.getContractFactory(
      "TokenProxyRegistry"
    )) as Types.TokenProxyBase__factory;
    SET.Registry = await deploy<Types.TokenProxyRegistry>(
      TokenProxyRegistryFactory,
      SET.DAO.address,
      SET.Behodler.address
    );

    await SET.ReferenceToken.transfer(SET.Behodler.address, SET.TEN_K);

    const CliffFaceFactory = await ethers.getContractFactory("CliffFace");

    SET.CliffFace = await deploy<Types.CliffFace>(
      CliffFaceFactory,
      SET.BaseToken.address,
      "horse",
      "h",
      SET.Registry.address,
      SET.ReferenceToken.address,
      SET.ONE,
      SET.Behodler.address,
      SET.ONE
    );
    await SET.BaseToken.approve(SET.CliffFace.address, SET.MILLION);
    await SET.ReferenceToken.approve(SET.CliffFace.address, SET.MILLION);
    await SET.CliffFace.approve(SET.Behodler.address, SET.MILLION);
    await SET.SimilarToken.approve(SET.Behodler.address, SET.MILLION);
    await SET.Behodler.approve(SET.CliffFace.address, SET.MILLION);

    await SET.Lachesis.measure(SET.CliffFace.address, true, false);
    await SET.Lachesis.updateBehodler(SET.CliffFace.address);

    await SET.Lachesis.measure(SET.SimilarToken.address, true, false);
    await SET.Lachesis.updateBehodler(SET.SimilarToken.address);

    const cliffFaceStartingBalance = SET.TEN_K.sub(SET.ONE.mul(10));

    await SET.SimilarToken.transfer(SET.Behodler.address, cliffFaceStartingBalance);
    await SET.SimilarToken.mint(SET.TEN_K);

    const scxBalanceBefore = await SET.Behodler.balanceOf(SET.owner.address);
    await SET.CliffFace.seedBehodler(cliffFaceStartingBalance, SET.owner.address);
    const scxBalanceAfter = await SET.Behodler.balanceOf(SET.owner.address);
    await SET.Behodler.setSafetParameters("30", "30");
    await SET.CliffFace.approveBehodlerFor(SET.SimilarToken.address);

    const uniswapFactoryFactory = await ethers.getContractFactory("UniswapV2Factory");
    SET.UniswapFactory = await deploy<Types.UniswapV2Factory>(uniswapFactoryFactory, SET.owner.address);
    SET.UniswapFactory.createPair(SET.SimilarToken.address, SET.ReferenceToken.address);

    SET.MainPair = (await ethers.getContractAt(
      "UniswapV2Pair",
      await SET.UniswapFactory.getPair(SET.SimilarToken.address, SET.ReferenceToken.address)
    )) as Types.UniswapV2Pair;

    const fakeWeth = await deploy<Types.MockToken>(MockTokenFactory, "WETH", "WETH", [], []);
    const uniRouterFactory = await ethers.getContractFactory("UniswapV2Router02");
    SET.UniRouter = await deploy<Types.UniswapV2Router02>(
      uniRouterFactory,
      SET.UniswapFactory.address,
      fakeWeth.address
    );

    await SET.SimilarToken.approve(SET.MainPair.address, SET.MILLION);
    await SET.ReferenceToken.approve(SET.MainPair.address, SET.MILLION);

    await SET.SimilarToken.mint(SET.MILLION);
    await SET.ReferenceToken.mint(SET.MILLION);
    await SET.SimilarToken.transfer(SET.MainPair.address, SET.ONE);
    await SET.ReferenceToken.transfer(SET.MainPair.address, SET.ONE.mul(3));
    await SET.MainPair.mint(SET.owner.address);
  });

  it("t0. empty test for setup testing", async function () {
    //nothing to see here
  });

  it("t1. Two swapAsInput calls in the same block reverts", async function () {
    const TwoCliffFaceFactory = await ethers.getContractFactory("TwoCliffFaceCalls");
    const twoCliffFace = await deploy<Types.TwoCliffFaceCalls>(TwoCliffFaceFactory, SET.CliffFace.address);
    await SET.BaseToken.approve(twoCliffFace.address, SET.MILLION);

    await expect(twoCliffFace.doubleSwapIn(SET.ReferenceToken.address, SET.ONE)).to.be.revertedWith(
      "SlippageManipulationPrevention"
    );
  });

  it("t2. swapAsInput when balance of token<reference*multiple is same as pure behodler", async function () {
    //Orchestrate Behodler swap
    const swapAmount = SET.ONE.sub(SET.DECAFINNEY.mul(9));
    const balanceOfReferenceTokenBeforeSwap = await SET.ReferenceToken.balanceOf(SET.Behodler.address);
    const balanceOfSimilarTokenBeforeSwap = await SET.SimilarToken.balanceOf(SET.Behodler.address);
    expect(balanceOfSimilarTokenBeforeSwap.lt(balanceOfReferenceTokenBeforeSwap.mul(SET.ONE.div(10)))).to.be.true;

    await SET.Behodler.swap(SET.SimilarToken.address, SET.ReferenceToken.address, swapAmount, SET.ONE);

    //assert that balance of token<reference*multiple
    const balanceOfSimilarTokenAfterSwap = await SET.SimilarToken.balanceOf(SET.Behodler.address);
    const balanceOfReferenceTokenAfterSwap = await SET.ReferenceToken.balanceOf(SET.Behodler.address);

    expect(balanceOfSimilarTokenAfterSwap.lt(balanceOfReferenceTokenAfterSwap)).to.be.true;

    const changeInReferenceTokenFromSwap = balanceOfReferenceTokenBeforeSwap.sub(balanceOfReferenceTokenAfterSwap);
    await SET.ReferenceToken.transfer(SET.Behodler.address, changeInReferenceTokenFromSwap);
    const balanceOfReferenceTokenBeforeSecondSwap = await SET.ReferenceToken.balanceOf(SET.Behodler.address);

    //reset Behodler for CliffFace Swap
    expect(balanceOfReferenceTokenBeforeSecondSwap.eq(balanceOfReferenceTokenBeforeSwap)).to.be.true;

    //Orchestrate cliffFace swap
    await SET.CliffFace.swapAsInput(SET.owner.address, SET.ReferenceToken.address, SET.ONE, swapAmount);

    //Assert inputs and outputs are the same
    const balanceOfReferenceTokenAfterSecondSwap = await SET.ReferenceToken.balanceOf(SET.Behodler.address);
    expect(balanceOfReferenceTokenAfterSecondSwap.eq(balanceOfReferenceTokenAfterSwap)).to.be.true;

    const balanceOfCliffFaceAfterSwap = await SET.CliffFace.balanceOf(SET.Behodler.address);
    expect(balanceOfSimilarTokenAfterSwap.eq(balanceOfCliffFaceAfterSwap)).to.be.true;
  });

  it("t3. swapAsInput when balance of token>reference*multiple gives less than behodler proportionately", async function () {
    //Orchestrate Behodler swap
    const swapAmount = SET.TEN.mul(2);
    const pureOutAmount = SET.TEN.mul(1998002).div(1000000);

    const balanceOfReferenceTokenBeforeSwap = await SET.ReferenceToken.balanceOf(SET.Behodler.address);
    const balanceOfSimilarTokenBeforeSwap = await SET.SimilarToken.balanceOf(SET.Behodler.address);
    expect(balanceOfSimilarTokenBeforeSwap.lt(balanceOfReferenceTokenBeforeSwap.mul(SET.ONE.div(10)))).to.be.true;

    await SET.Behodler.swap(SET.SimilarToken.address, SET.ReferenceToken.address, swapAmount, pureOutAmount);

    //assert that balance of token<reference*multiple
    const balanceOfSimilarTokenAfterSwap = await SET.SimilarToken.balanceOf(SET.Behodler.address);
    const balanceOfReferenceTokenAfterSwap = await SET.ReferenceToken.balanceOf(SET.Behodler.address);

    expect(balanceOfSimilarTokenAfterSwap.gt(balanceOfReferenceTokenAfterSwap)).to.be.true;

    const changeInReferenceTokenFromSwap = balanceOfReferenceTokenBeforeSwap.sub(balanceOfReferenceTokenAfterSwap);
    await SET.ReferenceToken.transfer(SET.Behodler.address, changeInReferenceTokenFromSwap);
    const balanceOfReferenceTokenBeforeSecondSwap = await SET.ReferenceToken.balanceOf(SET.Behodler.address);

    //reset Behodler for CliffFace Swap
    expect(balanceOfReferenceTokenBeforeSecondSwap.eq(balanceOfReferenceTokenBeforeSwap)).to.be.true;

    //Orchestrate cliffFace swap
    const cliffFaceSlippageEffect = SET.FINNEY.mul(1992).div(100);
    
    await SET.CliffFace.swapAsInput(
      SET.owner.address,
      SET.ReferenceToken.address,
      pureOutAmount.sub(cliffFaceSlippageEffect),
      swapAmount
    );

    //Assert inputs and outputs are the different
    const balanceOfReferenceTokenAfterSecondSwap = await SET.ReferenceToken.balanceOf(SET.Behodler.address);
    expect(balanceOfReferenceTokenAfterSecondSwap.sub(balanceOfReferenceTokenAfterSwap)).to.equal(
      cliffFaceSlippageEffect
    );

    const balanceOfCliffFaceAfterSwap = await SET.CliffFace.balanceOf(SET.Behodler.address);
    expect(balanceOfSimilarTokenAfterSwap.gt(balanceOfCliffFaceAfterSwap)).to.be.true;
  });

  it("t4. swapAsOutput reverts on input as SCX when expectedInputIncorrect", async function () {
    await expect(
      SET.CliffFace.swapAsOuput(SET.owner.address, SET.Behodler.address, SET.TEN.mul(4), "101772565270515100")
    ).to.be.revertedWith("SCXBalanceTooLow");

    await SET.CliffFace.swapAsOuput(SET.owner.address, SET.Behodler.address, SET.TEN.mul(4), "106772565270515100");
  });

  for (let i = 0; i < 2; i++) {
    let wrapper = i == 0 ? "pure Behodler" : "CliffFace";
    let actualOuput;
    it(`t5.${i + 1} SwapOut equivalence: Swapping using ${wrapper}`, async function () {
      actualOuput = SET.ONE.sub(SET.SZABO.mul(100));
      if (i == 0) {
        await SET.Behodler.swap(SET.SimilarToken.address, SET.CliffFace.address, SET.ONE, actualOuput);
      } else {
        await SET.SimilarToken.approve(SET.CliffFace.address, SET.TEN);
        await SET.CliffFace.swapAsOuput(SET.owner.address, SET.SimilarToken.address, actualOuput, SET.ONE);
      }
    });
  }

  //The following tests are for gas benchmarking. For the Uniswap tests, we bypass the router and thereby get best case gas consumption.
  enum AMMType {
    UniswapPair = "UniswapPair",
    Behodler = "Behodler",
    CliffFace = "CliffFace",
  }

  const AMMTypes = [ AMMType.Behodler, AMMType.CliffFace];
  AMMTypes.forEach((amm: AMMType) => {
    let description = `${amm.toString()} BENCHMARK: `;
    switch (amm) {
      case AMMType.UniswapPair:
        it(description + "Mints LP token", async function () {
          await SET.SimilarToken.transfer(SET.MainPair.address, SET.FINNEY);
          await SET.ReferenceToken.transfer(SET.MainPair.address, SET.ONE);
          await SET.MainPair.mint(SET.owner.address);
        });

        it(description + "Performs swap", async function () {
          const inputAmount = SET.FINNEY;
          const initialReserveIn = await SET.SimilarToken.balanceOf(SET.MainPair.address);
          const initialReserveOut = await SET.ReferenceToken.balanceOf(SET.MainPair.address);

          const inputWithFee = inputAmount.mul(997);
          const numerator = inputWithFee.mul(initialReserveOut);
          const denominator = initialReserveIn.mul(1000).add(inputWithFee);
          const amountOut = numerator.div(denominator);
          await SET.ReferenceToken.approve(SET.UniRouter.address, SET.MILLION);
          await SET.SimilarToken.approve(SET.UniRouter.address, inputAmount);
          await SET.SimilarToken.transfer(SET.MainPair.address, inputAmount);
          await SET.MainPair.swap(amountOut, 0, SET.owner.address, []);
        });

        it(description + "burns LP token", async function () {
          const LPbalance = await SET.MainPair.balanceOf(SET.owner.address);
          await SET.MainPair.transfer(SET.MainPair.address, LPbalance);
          await SET.MainPair.burn(SET.owner.address);
        });
        break;
      case AMMType.Behodler:
        it(description + "Mints SCX with SimilarToken", async function () {
          await SET.Behodler.addLiquidity(SET.SimilarToken.address, SET.ONE);
        });
        it(description + "Swaps similar for reference", async function () {
          //Still find it weird that Uniswap and Behodler get the same result with such different routes.
          const inputAmount = SET.ONE;
          const initialReserveIn = await SET.SimilarToken.balanceOf(SET.Behodler.address);
          const initialReserveOut = await SET.ReferenceToken.balanceOf(SET.Behodler.address);

          const inputWithFee = inputAmount.mul(1000);
          const numerator = inputWithFee.mul(initialReserveOut);
          const denominator = initialReserveIn.mul(1000).add(inputWithFee);
          const amountOut = numerator.div(denominator);

          await SET.Behodler.swap(SET.SimilarToken.address, SET.ReferenceToken.address, inputAmount, amountOut);
        });

        it(description + "Withdraw's liquidity for similar", async function () {
          await SET.Behodler.withdrawLiquidity(SET.SimilarToken.address, SET.FINNEY);
        });
        break;
      case AMMType.CliffFace:
        it(description + "Mints SCX with CliffFace", async function () {
          const swapAmount = SET.ONE.sub(SET.DECAFINNEY.mul(9));
          const mintAmount = "2661435933328510";
          await SET.CliffFace.swapAsInput(SET.owner.address, SET.Behodler.address, mintAmount, swapAmount);
        });

        it(description + "Swaps CliffFace for Similar", async function () {
          const inputAmount = SET.ONE;
          const outputAmount = SET.ONE.mul(9999).div(10000);
          const result = await executionResult(
            SET.CliffFace.swapAsInput(SET.owner.address, SET.SimilarToken.address, outputAmount, inputAmount)
          );
          let errorStartIndex = result.error.toString().indexOf("(");
          let errorEndIndex = result.error.toString().indexOf(")");
          let message = result.error.toString().substring(errorStartIndex + 1, errorEndIndex);
          let commaIndex = message.indexOf(",");
          let before = message.substring(0, commaIndex).trim();
          let after = message.substring(commaIndex + 1).trim();
          let newMessage = before + "\n" + after;
          console.log(newMessage + (parseInt(before) < parseInt(after) ? " LHS smaller" : " LHS bigger"));
          console.log("difference: " + Math.abs(parseInt(after) - parseInt(before)));
          expect(result.success).to.equal(true, result.error);
        });

        it(description + "Withdraws liquidity for CliffFace", async function () {
          const output = SET.ONE.sub(SET.DECAFINNEY.mul(9));
          const scxAmount = "2940000000000000";
          const scxBalanceBefore = await SET.Behodler.balanceOf(SET.owner.address);

          await SET.CliffFace.swapAsOuput(SET.owner.address, SET.Behodler.address, output, scxAmount);
          const scxBalanceAfter = await SET.Behodler.balanceOf(SET.owner.address);
          expect(scxBalanceBefore.sub(scxBalanceAfter).lt(3000000000000000));
        });
        break;
      default:
        break;
    }
  });
});
