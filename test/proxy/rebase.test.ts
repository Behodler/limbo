import { executionResult, numberClose, queryChain } from "../helpers";

const { expect, assert } = require("chai");
import { ethers, network } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
const web3 = require("web3");

interface TestSet {
  MockRebaseToken: any;
  Proxy: any;
  ONE: string;
  TWO: string;
  HALF: string;
  MILLION: string;
  FINNEY: string;
  owner: SignerWithAddress;
  secondary: SignerWithAddress;
}

//NOTE on my terminology: A rebase up event is when a token supply increases. Eg. When OUSD earns interest
//Conversely, a rebase down is when the supply drops and it appears that user balances are slashed.
//To test rebase behaviour, we don't actually need a rebase token; we just need to manipulate supply of a token with mint and burn
describe("rebase proxy test", function () {
  let SET = {} as TestSet;

  this.beforeEach(async function () {
    [SET.owner, SET.secondary] = await ethers.getSigners();
    SET.MILLION = "1000000000000000000000000";
    SET.ONE = "1000000000000000000";
    SET.HALF = "500000000000000000";
    SET.TWO = "2000000000000000000";
    SET.FINNEY = "1000000000000000";
    const MockRebaseTokenFactory = await ethers.getContractFactory("MockToken");
    let query = await queryChain(MockRebaseTokenFactory.deploy("MockToken", "MT", [], []));
    expect(query.success).to.equal(true, query.error);
    SET.MockRebaseToken = query.result;

    const RebaseProxyFactory = await ethers.getContractFactory("RebaseProxy");
    query = await queryChain(RebaseProxyFactory.deploy(SET.MockRebaseToken.address, "Proxy", "PRX"));
    expect(query.success).to.equal(true, query.error);
    SET.Proxy = query.result;
   
    let result = await executionResult(SET.MockRebaseToken.approve(SET.Proxy.address, SET.MILLION));
    expect(result.success).to.equal(true, result.error);

    result = await executionResult(SET.MockRebaseToken.connect(SET.secondary).approve(SET.Proxy.address, SET.MILLION));
    expect(result.success).to.equal(true, result.error);
  });

  it("t1. initial redeem rate is ONE, redeeming all returns to ONE", async function () {
    let query = await queryChain(SET.Proxy.redeemRate());
    expect(query.success).to.equal(true, query.error);
    expect(query.result.toString()).to.equal(SET.ONE);

    let result = await executionResult(SET.Proxy.mint(SET.owner.address, 1000000));
    expect(result.success).to.equal(true, result.error);

    query = await queryChain(SET.Proxy.balanceOf(SET.owner.address));
    expect(query.success).to.equal(true, query.error);
    let balance = query.result;
    expect(balance.gt("0")).to.equal(true, balance.toString());

    result = await executionResult(SET.Proxy.redeem(SET.owner.address, balance));
    expect(result.success).to.equal(true, result.error);

    query = await queryChain(SET.Proxy.balanceOf(SET.owner.address));
    expect(query.success).to.equal(true, query.error);
    expect(query.result.toString()).to.equal("0");

    query = await queryChain(SET.Proxy.redeemRate());
    expect(query.success).to.equal(true, query.error);
    expect(query.result.toString()).to.equal(SET.ONE);
  });

  it("t2. minting and redeeming without rebase events keeps redeem rate at 1:1", async function () {
    let result = await executionResult(SET.Proxy.mint(SET.owner.address, SET.ONE));
    expect(result.success).to.equal(true, result.error);

    let query = await queryChain(SET.Proxy.balanceOf(SET.owner.address));
    expect(query.success).to.equal(true, query.error);
    expect(query.result.toString()).to.equal(SET.ONE);

    result = await executionResult(SET.Proxy.redeem(SET.owner.address, SET.FINNEY));
    expect(result.success).to.equal(true, result.error);

    result = await executionResult(SET.Proxy.redeem(SET.owner.address, SET.FINNEY));
    expect(result.success).to.equal(true, result.error);

    query = await queryChain(SET.Proxy.redeemRate());
    expect(query.success).to.equal(true, query.error);
    expect(query.result.toString()).to.equal(SET.ONE);

    query = await queryChain(SET.Proxy.balanceOf(SET.owner.address));
    expect(query.success).to.equal(true, query.error);
    const balanceBefore = query.result;

    result = await executionResult(SET.Proxy.mint(SET.owner.address, SET.ONE));
    expect(result.success).to.equal(true, result.error);

    query = await queryChain(SET.Proxy.balanceOf(SET.owner.address));
    expect(query.success).to.equal(true, query.error);
    const balanceAfter = query.result;

    expect(balanceAfter.sub(balanceBefore)).to.equal(SET.ONE);

    query = await queryChain(SET.Proxy.redeemRate());
    expect(query.success).to.equal(true, query.error);
    expect(query.result.toString()).to.equal(SET.ONE);
  });

  it("t3. Redeeming proxy after rebase up event gives more base tokens", async function () {
    //ARRANGE
    let result = await executionResult(SET.Proxy.mint(SET.owner.address, SET.ONE));
    expect(result.success).to.equal(true, result.error);

    let query = await queryChain(SET.Proxy.balanceOf(SET.owner.address));
    expect(query.success).to.equal(true, query.error);
    expect(query.result.toString()).to.equal(SET.ONE);

    query = await queryChain(SET.MockRebaseToken.balanceOf(SET.Proxy.address));
    expect(query.success).to.equal(true, query.error);
    const proxyBalanceBeforeRebase = query.result;

    result = await executionResult(SET.MockRebaseToken.mint(proxyBalanceBeforeRebase));
    expect(result.success).to.equal(true, result.error);

    //REBASE EVENT
    result = await executionResult(SET.MockRebaseToken.transfer(SET.Proxy.address, proxyBalanceBeforeRebase));
    expect(result.success).to.equal(true, result.error);

    query = await queryChain(SET.MockRebaseToken.balanceOf(SET.Proxy.address));
    expect(query.success).to.equal(true, query.error);
    const proxyBalanceAfterRebase = query.result;

    expect(proxyBalanceAfterRebase.sub(proxyBalanceBeforeRebase)).to.equal(proxyBalanceBeforeRebase);

    query = await queryChain(SET.MockRebaseToken.balanceOf(SET.owner.address));
    expect(query.success).to.equal(true, query.error);
    const balanceOfBaseBeforeRedeem = query.result;

    //ACT
    result = await executionResult(SET.Proxy.redeem(SET.owner.address, SET.ONE));
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

    result = await executionResult(SET.Proxy.connect(SET.secondary).mint(SET.secondary.address, SET.ONE));
    expect(result.success).to.equal(true, result.error);

    let query = await queryChain(SET.Proxy.balanceOf(SET.secondary.address));
    expect(query.success).to.equal(true, query.error);
    expect(query.result.toString()).to.equal(SET.ONE);

    query = await queryChain(SET.MockRebaseToken.balanceOf(SET.Proxy.address));
    expect(query.success).to.equal(true, query.error);
    const proxyBalanceBeforeRebase = query.result;

    result = await executionResult(SET.MockRebaseToken.mint(proxyBalanceBeforeRebase));
    expect(result.success).to.equal(true, result.error);

    //REBASE EVENT
    result = await executionResult(SET.MockRebaseToken.transfer(SET.Proxy.address, proxyBalanceBeforeRebase));
    expect(result.success).to.equal(true, result.error);

    //ACT
    result = await executionResult(SET.Proxy.mint(SET.owner.address, SET.ONE));
    expect(result.success).to.equal(true, result.error);

    //ASSERT
    query = await queryChain(SET.Proxy.balanceOf(SET.owner.address));
    expect(query.success).to.equal(true, query.error);
    expect(query.result).to.equal(SET.HALF);
  });

  it("t5. Redeeming proxy after rebase down event gives fewer base tokens", async function () {
    //ARRANGE
    let result = await executionResult(SET.Proxy.mint(SET.owner.address, SET.TWO));
    expect(result.success).to.equal(true, result.error);

    let query = await queryChain(SET.Proxy.balanceOf(SET.owner.address));
    expect(query.success).to.equal(true, query.error);
    expect(query.result.toString()).to.equal(SET.TWO);

    query = await queryChain(SET.MockRebaseToken.balanceOf(SET.Proxy.address));
    expect(query.success).to.equal(true, query.error);
    const proxyBalanceBeforeRebase = query.result;

    result = await executionResult(SET.MockRebaseToken.mint(proxyBalanceBeforeRebase));
    expect(result.success).to.equal(true, result.error);

    //REBASE EVENT
    const burnAmount = proxyBalanceBeforeRebase.div("2");
    result = await executionResult(SET.MockRebaseToken.burnFrom(SET.Proxy.address, burnAmount));
    expect(result.success).to.equal(true, result.error);

    query = await queryChain(SET.MockRebaseToken.balanceOf(SET.Proxy.address));
    expect(query.success).to.equal(true, query.error);
    const proxyBalanceAfterRebase = query.result;

    expect(proxyBalanceBeforeRebase.sub(proxyBalanceAfterRebase)).to.equal(burnAmount);

    query = await queryChain(SET.MockRebaseToken.balanceOf(SET.owner.address));
    expect(query.success).to.equal(true, query.error);
    const balanceOfBaseBeforeRedeem = query.result;

    //ACT
    result = await executionResult(SET.Proxy.redeem(SET.owner.address, SET.ONE));
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

    result = await executionResult(SET.Proxy.connect(SET.secondary).mint(SET.secondary.address, SET.ONE));
    expect(result.success).to.equal(true, result.error);

    let query = await queryChain(SET.Proxy.balanceOf(SET.secondary.address));
    expect(query.success).to.equal(true, query.error);
    expect(query.result.toString()).to.equal(SET.ONE);

    query = await queryChain(SET.MockRebaseToken.balanceOf(SET.Proxy.address));
    expect(query.success).to.equal(true, query.error);
    const proxyBalanceBeforeRebase = query.result;

    result = await executionResult(SET.MockRebaseToken.mint(proxyBalanceBeforeRebase));
    expect(result.success).to.equal(true, result.error);

    const burnAmount = proxyBalanceBeforeRebase.div("2");

    //REBASE EVENT
    result = await executionResult(SET.MockRebaseToken.burnFrom(SET.Proxy.address, burnAmount));
    expect(result.success).to.equal(true, result.error);

    //ACT
    result = await executionResult(SET.Proxy.mint(SET.owner.address, SET.ONE));
    expect(result.success).to.equal(true, result.error);

    //ASSERT
    query = await queryChain(SET.Proxy.balanceOf(SET.owner.address));
    expect(query.success).to.equal(true, query.error);
    expect(query.result).to.equal(SET.TWO);
  });
});
