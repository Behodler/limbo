import { deploy, executionResult, numberClose, queryChain } from "../helpers";

const { expect, assert } = require("chai");
import { ethers, network } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import * as Types from "../../typechain";
import { BigNumber } from "ethers";
const web3 = require("web3");

interface TestSet {
  MockRebaseToken: Types.MockToken;
  MockFOTtoken: Types.MockFOTToken;
  RebaseProxy: Types.VanillaProxy;
  FOTProxy: Types.VanillaProxy;
  Registry: Types.TokenProxyRegistry;
  DAO: Types.ProxyDAO;
  ZERO: BigNumber;
  ONE: BigNumber;
  TWO: BigNumber;
  HALF: BigNumber;
  MILLION: BigNumber;
  FINNEY: BigNumber;
  owner: SignerWithAddress;
  secondary: SignerWithAddress;
}

//NOTE on terminology: A rebase up event is when a token supply increases. Eg. When OUSD earns interest
//Conversely, a rebase down is when the supply drops and it appears that user balances are slashed.
//To test rebase behaviour, we don't actually need a rebase token; we just need to manipulate supply of a token with mint and burn
describe("token proxy test", function () {
  let SET = {} as TestSet;

  this.beforeEach(async function () {
    [SET.owner, SET.secondary] = await ethers.getSigners();
    SET.MILLION = BigNumber.from("1000000000000000000000000");
    SET.ONE = BigNumber.from("1000000000000000000");
    SET.HALF = BigNumber.from("500000000000000000");
    SET.TWO = BigNumber.from("2000000000000000000");
    SET.FINNEY = BigNumber.from("1000000000000000");
    SET.ZERO = BigNumber.from(0);
    const MockTokenFactory = await ethers.getContractFactory("MockToken");
    let query = await queryChain(MockTokenFactory.deploy("MockToken", "MT", [], []));
    expect(query.success).to.equal(true, query.error);
    SET.MockRebaseToken = query.result;

    const MockFoTTokenFactory = await ethers.getContractFactory("MockFOTToken");
    SET.MockFOTtoken = await deploy<Types.MockFOTToken>(MockFoTTokenFactory, "FOT", "FOT", 25);

    const proxyDAOFactory = (await ethers.getContractFactory("ProxyDAO")) as Types.ProxyDAO__factory;
    SET.DAO = await deploy<Types.ProxyDAO>(proxyDAOFactory);
    const TokenProxyRegistryFactory = (await ethers.getContractFactory(
      "TokenProxyRegistry"
    )) as Types.TokenProxyBase__factory;
    SET.Registry = await deploy<Types.TokenProxyRegistry>(TokenProxyRegistryFactory, SET.DAO.address);

    const VanillaProxyFactory = await ethers.getContractFactory("VanillaProxy");
    SET.RebaseProxy = await deploy<Types.VanillaProxy>(
      VanillaProxyFactory,
      SET.MockRebaseToken.address,
      "Proxy",
      "PRX",
      SET.Registry.address
    );

    await SET.Registry.setProxy(SET.MockRebaseToken.address, SET.RebaseProxy.address, true);

    let result = await executionResult(SET.MockRebaseToken.approve(SET.RebaseProxy.address, SET.MILLION));
    expect(result.success).to.equal(true, result.error);

    result = await executionResult(
      SET.MockRebaseToken.connect(SET.secondary).approve(SET.RebaseProxy.address, SET.MILLION)
    );
    expect(result.success).to.equal(true, result.error);

    await SET.RebaseProxy.setRAmpFinney(1000); //ONE

    SET.FOTProxy = await deploy<Types.VanillaProxy>(
      VanillaProxyFactory,
      SET.MockFOTtoken.address,
      "ProxyG",
      "PRX",
      SET.Registry.address
    );

    result = await executionResult(SET.MockFOTtoken.approve(SET.FOTProxy.address, SET.MILLION));
    expect(result.success).to.equal(true, result.error);

    result = await executionResult(SET.MockFOTtoken.connect(SET.secondary).approve(SET.FOTProxy.address, SET.MILLION));
    expect(result.success).to.equal(true, result.error);

    await SET.FOTProxy.setRAmpFinney(1000); //ONE

    await SET.Registry.setProxy(SET.MockFOTtoken.address, SET.FOTProxy.address, false);
  });

  it("t1. initial redeem rate is ONE, redeeming all returns to ONE", async function () {
    let query = await queryChain(SET.RebaseProxy.redeemRate());
    expect(query.success).to.equal(true, query.error);
    expect(query.result.toString()).to.equal(SET.ONE);

    let result = await executionResult(SET.RebaseProxy.mint(SET.owner.address, SET.owner.address, 1000000));
    expect(result.success).to.equal(true, result.error);

    query = await queryChain(SET.RebaseProxy.balanceOf(SET.owner.address));
    expect(query.success).to.equal(true, query.error);
    let balance = query.result;
    expect(balance.gt("0")).to.equal(true, balance.toString());

    result = await executionResult(SET.RebaseProxy.redeemSelf(SET.owner.address, balance));
    expect(result.success).to.equal(true, result.error);

    query = await queryChain(SET.RebaseProxy.balanceOf(SET.owner.address));
    expect(query.success).to.equal(true, query.error);
    expect(query.result.toString()).to.equal("0");

    query = await queryChain(SET.RebaseProxy.redeemRate());
    expect(query.success).to.equal(true, query.error);
    expect(query.result.toString()).to.equal(SET.ONE);
  });

  it("t2. minting and redeeming without rebase events keeps redeem rate at 1:1", async function () {
    let result = await executionResult(SET.RebaseProxy.mint(SET.owner.address, SET.owner.address, SET.ONE));
    expect(result.success).to.equal(true, result.error);

    let query = await queryChain(SET.RebaseProxy.balanceOf(SET.owner.address));
    expect(query.success).to.equal(true, query.error);
    expect(query.result.toString()).to.equal(SET.ONE);

    result = await executionResult(SET.RebaseProxy.redeem(SET.owner.address, SET.owner.address, SET.FINNEY));
    expect(result.success).to.equal(true, result.error);

    result = await executionResult(SET.RebaseProxy.redeem(SET.owner.address, SET.owner.address, SET.FINNEY));
    expect(result.success).to.equal(true, result.error);

    query = await queryChain(SET.RebaseProxy.redeemRate());
    expect(query.success).to.equal(true, query.error);
    expect(query.result.toString()).to.equal(SET.ONE);

    query = await queryChain(SET.RebaseProxy.balanceOf(SET.owner.address));
    expect(query.success).to.equal(true, query.error);
    const balanceBefore = query.result;

    result = await executionResult(SET.RebaseProxy.mint(SET.owner.address, SET.owner.address, SET.ONE));
    expect(result.success).to.equal(true, result.error);

    query = await queryChain(SET.RebaseProxy.balanceOf(SET.owner.address));
    expect(query.success).to.equal(true, query.error);
    const balanceAfter = query.result;

    expect(balanceAfter.sub(balanceBefore)).to.equal(SET.ONE);

    query = await queryChain(SET.RebaseProxy.redeemRate());
    expect(query.success).to.equal(true, query.error);
    expect(query.result.toString()).to.equal(SET.ONE);
  });

  it("t3. Redeeming proxy after rebase up event gives more base tokens", async function () {
    //ARRANGE
    let result = await executionResult(SET.RebaseProxy.mint(SET.owner.address, SET.owner.address, SET.ONE));
    expect(result.success).to.equal(true, result.error);

    let query = await queryChain(SET.RebaseProxy.balanceOf(SET.owner.address));
    expect(query.success).to.equal(true, query.error);
    expect(query.result.toString()).to.equal(SET.ONE);

    query = await queryChain(SET.MockRebaseToken.balanceOf(SET.RebaseProxy.address));
    expect(query.success).to.equal(true, query.error);
    const proxyBalanceBeforeRebase = query.result;

    result = await executionResult(SET.MockRebaseToken.mint(proxyBalanceBeforeRebase));
    expect(result.success).to.equal(true, result.error);

    //REBASE EVENT
    result = await executionResult(SET.MockRebaseToken.transfer(SET.RebaseProxy.address, proxyBalanceBeforeRebase));
    expect(result.success).to.equal(true, result.error);

    query = await queryChain(SET.MockRebaseToken.balanceOf(SET.RebaseProxy.address));
    expect(query.success).to.equal(true, query.error);
    const proxyBalanceAfterRebase = query.result;

    expect(proxyBalanceAfterRebase.sub(proxyBalanceBeforeRebase)).to.equal(proxyBalanceBeforeRebase);

    query = await queryChain(SET.MockRebaseToken.balanceOf(SET.owner.address));
    expect(query.success).to.equal(true, query.error);
    const balanceOfBaseBeforeRedeem = query.result;

    //ACT
    result = await executionResult(SET.RebaseProxy.redeem(SET.owner.address, SET.owner.address, SET.ONE));
    expect(result.success).to.equal(true, result.error);

    //ASSERT
    query = await queryChain(SET.MockRebaseToken.balanceOf(SET.owner.address));
    expect(query.success).to.equal(true, query.error);
    const balanceOfBaseAfterRedeem = query.result;
    expect(balanceOfBaseAfterRedeem.sub(balanceOfBaseBeforeRedeem)).to.equal(SET.TWO);
  });

  it("t4. Minting after rebase up event gives fewer proxy tokens", async function () {
    //ARRANGE
    let result = await executionResult(SET.MockRebaseToken.connect(SET.secondary).mint(SET.ONE));
    expect(result.success).to.equal(true, result.error);

    result = await executionResult(
      SET.RebaseProxy.connect(SET.secondary).mint(SET.secondary.address, SET.secondary.address, SET.ONE)
    );
    expect(result.success).to.equal(true, result.error);

    let query = await queryChain(SET.RebaseProxy.balanceOf(SET.secondary.address));
    expect(query.success).to.equal(true, query.error);
    expect(query.result.toString()).to.equal(SET.ONE);

    query = await queryChain(SET.MockRebaseToken.balanceOf(SET.RebaseProxy.address));
    expect(query.success).to.equal(true, query.error);
    const proxyBalanceBeforeRebase = query.result;

    result = await executionResult(SET.MockRebaseToken.mint(proxyBalanceBeforeRebase));
    expect(result.success).to.equal(true, result.error);

    //REBASE EVENT
    result = await executionResult(SET.MockRebaseToken.transfer(SET.RebaseProxy.address, proxyBalanceBeforeRebase));
    expect(result.success).to.equal(true, result.error);

    //ACT
    result = await executionResult(SET.RebaseProxy.mint(SET.owner.address, SET.owner.address, SET.ONE));
    expect(result.success).to.equal(true, result.error);

    //ASSERT
    query = await queryChain(SET.RebaseProxy.balanceOf(SET.owner.address));
    expect(query.success).to.equal(true, query.error);
    expect(query.result).to.equal(SET.HALF);
  });

  it("t5. Redeeming proxy after rebase down event gives fewer base tokens", async function () {
    //ARRANGE
    let result = await executionResult(SET.RebaseProxy.mint(SET.owner.address, SET.owner.address, SET.TWO));
    expect(result.success).to.equal(true, result.error);

    let query = await queryChain(SET.RebaseProxy.balanceOf(SET.owner.address));
    expect(query.success).to.equal(true, query.error);
    expect(query.result.toString()).to.equal(SET.TWO);

    query = await queryChain(SET.MockRebaseToken.balanceOf(SET.RebaseProxy.address));
    expect(query.success).to.equal(true, query.error);
    const proxyBalanceBeforeRebase = query.result;

    result = await executionResult(SET.MockRebaseToken.mint(proxyBalanceBeforeRebase));
    expect(result.success).to.equal(true, result.error);

    //REBASE EVENT
    const burnAmount = proxyBalanceBeforeRebase.div("2");
    result = await executionResult(SET.MockRebaseToken.burnFrom(SET.RebaseProxy.address, burnAmount));
    expect(result.success).to.equal(true, result.error);

    query = await queryChain(SET.MockRebaseToken.balanceOf(SET.RebaseProxy.address));
    expect(query.success).to.equal(true, query.error);
    const proxyBalanceAfterRebase = query.result;

    expect(proxyBalanceBeforeRebase.sub(proxyBalanceAfterRebase)).to.equal(burnAmount);

    query = await queryChain(SET.MockRebaseToken.balanceOf(SET.owner.address));
    expect(query.success).to.equal(true, query.error);
    const balanceOfBaseBeforeRedeem = query.result;

    //ACT
    result = await executionResult(SET.RebaseProxy.redeem(SET.owner.address, SET.owner.address, SET.ONE));
    expect(result.success).to.equal(true, result.error);

    //ASSERT
    query = await queryChain(SET.MockRebaseToken.balanceOf(SET.owner.address));
    expect(query.success).to.equal(true, query.error);
    const balanceOfBaseAfterRedeem = query.result;

    expect(balanceOfBaseAfterRedeem.sub(balanceOfBaseBeforeRedeem)).to.equal(SET.HALF);
  });

  it("t6. Minting after rebase down event gives more proxy tokens", async function () {
    //ARRANGE
    let result = await executionResult(SET.MockRebaseToken.connect(SET.secondary).mint(SET.ONE));
    expect(result.success).to.equal(true, result.error);

    result = await executionResult(
      SET.RebaseProxy.connect(SET.secondary).mint(SET.secondary.address, SET.secondary.address, SET.ONE)
    );
    expect(result.success).to.equal(true, result.error);

    let query = await queryChain(SET.RebaseProxy.balanceOf(SET.secondary.address));
    expect(query.success).to.equal(true, query.error);
    expect(query.result.toString()).to.equal(SET.ONE);

    query = await queryChain(SET.MockRebaseToken.balanceOf(SET.RebaseProxy.address));
    expect(query.success).to.equal(true, query.error);
    const proxyBalanceBeforeRebase = query.result;

    result = await executionResult(SET.MockRebaseToken.mint(proxyBalanceBeforeRebase));
    expect(result.success).to.equal(true, result.error);

    const burnAmount = proxyBalanceBeforeRebase.div("2");

    //REBASE EVENT
    result = await executionResult(SET.MockRebaseToken.burnFrom(SET.RebaseProxy.address, burnAmount));
    expect(result.success).to.equal(true, result.error);

    //ACT
    result = await executionResult(SET.RebaseProxy.mint(SET.owner.address, SET.owner.address, SET.ONE));
    expect(result.success).to.equal(true, result.error);

    //ASSERT
    query = await queryChain(SET.RebaseProxy.balanceOf(SET.owner.address));
    expect(query.success).to.equal(true, query.error);
    expect(query.result).to.equal(SET.TWO);
  });

  it("t7. minting FOT gives correct amount", async function () {
    const secondaryProxyBalanceBefore = await SET.FOTProxy.balanceOf(SET.secondary.address);
    const ownerBaseBalanceBefore = await SET.MockFOTtoken.balanceOf(SET.owner.address);
    await SET.FOTProxy.mint(SET.secondary.address, SET.owner.address, SET.TWO);
    const ownerBaseBalanceAfter = await SET.MockFOTtoken.balanceOf(SET.owner.address);
    const secondaryProxyBalanceAfter = await SET.FOTProxy.balanceOf(SET.secondary.address);

    const fee = SET.TWO.mul(25).div(1000);
    const expectedAmount = SET.TWO.sub(fee);
    expect(secondaryProxyBalanceAfter.sub(secondaryProxyBalanceBefore).toString()).to.equal(expectedAmount.toString());

    expect(ownerBaseBalanceBefore.sub(ownerBaseBalanceAfter)).to.equal(SET.TWO);

    const redeemRate = await SET.FOTProxy.redeemRate();
    expect(redeemRate).to.equal(SET.ONE);
  });

  it("t8. Redeeming FOT doesn't change redeem rate", async function () {
    await SET.FOTProxy.mint(SET.owner.address, SET.owner.address, SET.ONE);

    const ownerMockFOTBalanceBeforeRedeem = await SET.MockFOTtoken.balanceOf(SET.owner.address);
    await SET.FOTProxy.redeem(SET.owner.address, SET.owner.address, SET.FINNEY);

    const fee = SET.ONE.mul(25).div(1000);
    const expectedProxyBalanceBeforeRedeem = SET.ONE.sub(fee);
    const expectedProxyBalanceAfterRedeem = expectedProxyBalanceBeforeRedeem.sub(SET.FINNEY);

    const ownerFOTPRoxyBalance = await SET.FOTProxy.balanceOf(SET.owner.address);

    await expect(ownerFOTPRoxyBalance).to.equal(expectedProxyBalanceAfterRedeem);

    const redeemRate = await SET.FOTProxy.redeemRate();
    console.log("redeem rate " + redeemRate);
    await expect(redeemRate).to.equal(SET.ONE);

    const redeemFee = SET.FINNEY.mul(25).div(1000);
    const expectedMockFOTRedeemed = SET.FINNEY.sub(redeemFee);
    const ownerMockFOTBalanceAfterRedeem = await SET.MockFOTtoken.balanceOf(SET.owner.address);

    expect(ownerMockFOTBalanceAfterRedeem.sub(ownerMockFOTBalanceBeforeRedeem)).to.equal(expectedMockFOTRedeemed);
  });

  it("t9. Redeeming final FOT clears reserve and sets redeem rate to ONE", async function () {
    await SET.FOTProxy.mint(SET.owner.address, SET.owner.address, SET.ONE);
    const fOTProxyReserveBefore = await SET.MockFOTtoken.balanceOf(SET.FOTProxy.address);
    const fee = SET.ONE.mul(25).div(1000);

    const expectedBalanceOfReserve = SET.ONE.sub(fee);
    expect(fOTProxyReserveBefore).to.equal(expectedBalanceOfReserve);

    await SET.FOTProxy.redeem(SET.owner.address, SET.owner.address, expectedBalanceOfReserve);
    const ownerFOTProxyBalance = await SET.FOTProxy.balanceOf(SET.owner.address);

    expect(ownerFOTProxyBalance).to.equal(SET.ZERO);

    const fotProxyTotalSupply = await SET.FOTProxy.totalSupply();
    expect(fotProxyTotalSupply).to.equal(0);

    const reserveAfterRedeem = await SET.MockFOTtoken.balanceOf(SET.FOTProxy.address);
    expect(reserveAfterRedeem).to.equal(SET.ZERO);

    const redeemRateAfter = await SET.FOTProxy.redeemRate();
    expect(redeemRateAfter).to.equal(SET.ONE);
  });

  it("t10. changing R_amp affects marginal and average redeem rate predictably", async function () {
    await SET.RebaseProxy.mint(SET.owner.address, SET.owner.address, SET.ONE);

    await SET.RebaseProxy.setRAmpFinney(2000);

    const expectedMarginalRedeemRate = SET.TWO;

    const expectedMinted = SET.ONE.mul(SET.ONE).div(expectedMarginalRedeemRate);

    const balanceBefore = await SET.RebaseProxy.balanceOf(SET.owner.address);
    await SET.RebaseProxy.mint(SET.owner.address, SET.owner.address, SET.ONE);
    const balanceAfter = await SET.RebaseProxy.balanceOf(SET.owner.address);

    expect(balanceAfter.sub(balanceBefore)).to.equal(expectedMinted);

    const expectedRedeemRateAfter = SET.TWO.mul(SET.ONE).div(expectedMinted.add(SET.ONE));

    const actualRedeemRateAfter = await SET.RebaseProxy.redeemRate();
    expect(actualRedeemRateAfter.toString()).to.equal(expectedRedeemRateAfter.toString());
  });

  for (let i = 0; i < 2; i++) {
    const testType: string = i == 0 ? "rebase" : "fot";
    it(`t${"11." + (i + 1)}. ${testType} mint and redeem source and destinations differ`, async function () {
      const ownerAddress = SET.owner.address;
      const seconaryAddress = SET.secondary.address;

      let proxyBalancesBefore: BigNumber[] = [];
      let baseBalancesBefore: BigNumber[] = [];

      let proxyBalancesAfter: BigNumber[] = [];
      let baseBalancesAfter: BigNumber[] = [];

      const proxyToken = i == 0 ? SET.RebaseProxy : SET.FOTProxy;

      const baseAddress = await SET.Registry.tokenProxy(proxyToken.address);

      const baseToken = i == 0 ? SET.MockRebaseToken : SET.MockFOTtoken;

      expect(baseAddress[0]).to.equal(baseToken.address);

      proxyBalancesBefore.push(await proxyToken.balanceOf(ownerAddress));
      proxyBalancesBefore.push(await proxyToken.balanceOf(seconaryAddress));

      baseBalancesBefore.push(await baseToken.balanceOf(ownerAddress));
      baseBalancesBefore.push(await baseToken.balanceOf(seconaryAddress));

      await proxyToken.mint(seconaryAddress, ownerAddress, SET.TWO);

      const fee = i == 0 ? SET.ZERO : SET.TWO.mul(25).div(1000);

      const mintedAmount = SET.TWO.sub(fee);

      proxyBalancesAfter.push(await proxyToken.balanceOf(ownerAddress));
      proxyBalancesAfter.push(await proxyToken.balanceOf(seconaryAddress));

      baseBalancesAfter.push(await baseToken.balanceOf(ownerAddress));
      baseBalancesAfter.push(await baseToken.balanceOf(seconaryAddress));

      //Assert Owner Base balance decreased by TWO
      expect(baseBalancesBefore[0].sub(baseBalancesAfter[0])).to.equal(SET.TWO);

      //assert owner proxy balance did not increase
      expect(proxyBalancesAfter[0].sub(proxyBalancesBefore[0])).to.equal(SET.ZERO);

      //assert secondary proxy balance increase by TWO minus fee
      expect(proxyBalancesAfter[1].sub(proxyBalancesBefore[1])).to.equal(mintedAmount);
      //assert secondary base balance did not change

      expect(baseBalancesAfter[1].sub(baseBalancesBefore[1])).to.equal(SET.ZERO);
    });
  }
});
