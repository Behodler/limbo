import { deploy, executionResult, numberClose, queryChain } from "../helpers";

const { expect, assert } = require("chai");
import { ethers, network } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import * as Types from "../../typechain";
import { BigNumber } from "ethers";
const web3 = require("web3");

interface TestSet {
  BaseToken: Types.MockToken;
  LimboProxy: Types.LimboProxy;
  Limbo: Types.LimboForProxyMock;
  CliffFace: Types.CliffFace;
  Behodler: Types.RegistryBehodler;
  Registry: Types.TokenProxyRegistry;
  DAO: Types.ProxyDAO;
  ZERO: BigNumber;
  NULL_ADDRESS: string;
  ONE: BigNumber;
  TWO: BigNumber;
  HALF: BigNumber;
  MILLION: BigNumber;
  FINNEY: BigNumber;
  owner: SignerWithAddress;
  secondary: SignerWithAddress;
}

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
    SET.NULL_ADDRESS = "0x0000000000000000000000000000000000000000";
    const LimboMockFactory = await ethers.getContractFactory("LimboForProxyMock");
    SET.Limbo = await deploy<Types.LimboForProxyMock>(LimboMockFactory)
    const registryBehodlerFactory = await ethers.getContractFactory("RegistryBehodler");
    SET.Behodler = await deploy<Types.RegistryBehodler>(registryBehodlerFactory);

    const daoFactory = await ethers.getContractFactory("ProxyDAO");

    SET.DAO = await deploy<Types.ProxyDAO>(daoFactory);

    const registryFactory = await ethers.getContractFactory("TokenProxyRegistry");
    SET.Registry = await deploy<Types.TokenProxyRegistry>(registryFactory, SET.DAO.address, SET.Behodler.address);

    await SET.Registry.setPower(SET.owner.address);
    const MockTokenFactory = await ethers.getContractFactory("MockToken");

    SET.BaseToken = await deploy<Types.MockToken>(MockTokenFactory, "MockToken", "MT", [], []);
    await SET.BaseToken.mint(SET.TWO.mul(20));

    const cliffFaceFactory = await ethers.getContractFactory("CliffFace");
    SET.CliffFace = await deploy<Types.CliffFace>(
      cliffFaceFactory,
      SET.BaseToken.address,
      "horse",
      "gt",
      SET.Registry.address,
      SET.BaseToken.address,
      SET.ONE,
      SET.Behodler.address,
      SET.ONE
    );

    const limboProxyFactory = await ethers.getContractFactory("LimboProxy");
    SET.LimboProxy = await deploy<Types.LimboProxy>(
      limboProxyFactory,
      SET.BaseToken.address,
      "horse",
      "gt",
      SET.Registry.address,
      SET.Limbo.address,
      SET.Behodler.address,
      SET.ONE
    );

    await SET.LimboProxy.approveLimbo()
  });

  it("t0", async function () { });

  it("t1. call transfer as not morgoth power fails ", async function () {
    await expect(
      SET.Registry.connect(SET.secondary).TransferFromLimboTokenToBehodlerToken(SET.BaseToken.address)
    ).to.be.revertedWith(`NotMorgothPower("${SET.secondary.address}", "${SET.owner.address}")`);
  });

  it("t2. limbo proxy to base mapping unwraps proxy and sends base balance to Behodler", async function () {
    //Register limbo and base token for Behodler
    await SET.Registry.setProxy(SET.BaseToken.address, SET.LimboProxy.address, SET.NULL_ADDRESS)
    await SET.BaseToken.approve(SET.LimboProxy.address, SET.MILLION)
    await SET.LimboProxy.stake(SET.ONE)
    await SET.Limbo.migrate(SET.LimboProxy.address)

    const balanceOfProxy = await SET.LimboProxy.balanceOf(SET.owner.address)
    expect(balanceOfProxy.toString()).to.equal(SET.ONE.toString())

    await SET.LimboProxy.transfer(SET.Registry.address, balanceOfProxy)

    //ACT
    await SET.Registry.TransferFromLimboTokenToBehodlerToken(SET.LimboProxy.address);

    // //ASSERT
    const scxBalance = await SET.Behodler.balanceOf(SET.owner.address)
    expect(scxBalance.toString()).to.equal(SET.ONE.mul(98).div(100).div(10))

    const baseBalanceOnBehodler = await SET.BaseToken.balanceOf(SET.Behodler.address)
    expect(baseBalanceOnBehodler.toString()).to.equal(SET.ONE.toString())

    const behodlerProxyBalanceOnBehodler = await SET.CliffFace.balanceOf(SET.Behodler.address)
    expect(behodlerProxyBalanceOnBehodler).to.equal(SET.ZERO)

    const behodlerProxyBalanceOnLimbo = await SET.CliffFace.balanceOf(SET.Limbo.address)
    expect(behodlerProxyBalanceOnLimbo).to.equal(SET.ZERO)

    const limboProxyBalanceOnBehodler = await SET.LimboProxy.balanceOf(SET.Behodler.address)
    expect(limboProxyBalanceOnBehodler.toString()).to.equal(SET.ZERO)

    const limboProxyBalanceOnLimbo = await SET.LimboProxy.balanceOf(SET.Limbo.address)
    expect(limboProxyBalanceOnLimbo).to.equal(SET.ZERO)
  });

  it("t3 base token to behodler transfers correctly", async function () {
    //Register limbo and base token for Behodler
    await SET.Registry.setProxy(SET.BaseToken.address, SET.NULL_ADDRESS, SET.CliffFace.address)
    await SET.BaseToken.approve(SET.Limbo.address, SET.MILLION)
    await SET.Limbo.stakeFor(SET.BaseToken.address, SET.ONE, SET.owner.address)

    const balanceOfBaseBeforeMigrate = await SET.BaseToken.balanceOf(SET.owner.address)
    await SET.Limbo.migrate(SET.BaseToken.address)


    const balanceOfBaseTokenAfterMigrate = await SET.BaseToken.balanceOf(SET.owner.address)
    const receivedBaseToken = balanceOfBaseTokenAfterMigrate.sub(balanceOfBaseBeforeMigrate)
    expect(receivedBaseToken.toString()).to.equal(SET.ONE.toString())

    await SET.BaseToken.transfer(SET.Registry.address, receivedBaseToken)

    //ACT
    await SET.Registry.TransferFromLimboTokenToBehodlerToken(SET.BaseToken.address);

    // //ASSERT
    const scxBalance = await SET.Behodler.balanceOf(SET.owner.address)
    expect(scxBalance.toString()).to.equal(SET.ONE.mul(98).div(100).div(10))

    const baseBalanceOnBehodler = await SET.BaseToken.balanceOf(SET.Behodler.address)
    expect(baseBalanceOnBehodler.toString()).to.equal(SET.ZERO.toString())

    const behodlerProxyBalanceOnBehodler = await SET.CliffFace.balanceOf(SET.Behodler.address)
    expect(behodlerProxyBalanceOnBehodler).to.equal(SET.ONE)

    const behodlerProxyBalanceOnLimbo = await SET.CliffFace.balanceOf(SET.Limbo.address)
    expect(behodlerProxyBalanceOnLimbo).to.equal(SET.ZERO)

    const limboProxyBalanceOnBehodler = await SET.LimboProxy.balanceOf(SET.Behodler.address)
    expect(limboProxyBalanceOnBehodler.toString()).to.equal(SET.ZERO)

    const limboProxyBalanceOnLimbo = await SET.LimboProxy.balanceOf(SET.Limbo.address)
    expect(limboProxyBalanceOnLimbo).to.equal(SET.ZERO)
  });

  it("t4. limbo proxy to behodler transfers correctly", async function () {
    //Register limbo and base token for Behodler
    await SET.Registry.setProxy(SET.BaseToken.address, SET.LimboProxy.address, SET.CliffFace.address)
    await SET.BaseToken.approve(SET.LimboProxy.address, SET.MILLION)
    await SET.LimboProxy.stake(SET.ONE)

    const balanceOfProxyBeforeMigrate = await SET.LimboProxy.balanceOf(SET.owner.address)
    await SET.Limbo.migrate(SET.LimboProxy.address)


    const balanceOfProxyTokenAfterMigrate = await SET.LimboProxy.balanceOf(SET.owner.address)
    const receivedProxyToken = balanceOfProxyTokenAfterMigrate.sub(balanceOfProxyBeforeMigrate)
    expect(receivedProxyToken.toString()).to.equal(SET.ONE.toString())

    await SET.LimboProxy.transfer(SET.Registry.address, receivedProxyToken)

    //ACT
    await SET.Registry.TransferFromLimboTokenToBehodlerToken(SET.LimboProxy.address);

    // //ASSERT
    const scxBalance = await SET.Behodler.balanceOf(SET.owner.address)
    expect(scxBalance.toString()).to.equal(SET.ONE.mul(98).div(100).div(10))

    const baseBalanceOnBehodler = await SET.BaseToken.balanceOf(SET.Behodler.address)
    expect(baseBalanceOnBehodler.toString()).to.equal(SET.ZERO.toString())

    const behodlerProxyBalanceOnBehodler = await SET.CliffFace.balanceOf(SET.Behodler.address)
    expect(behodlerProxyBalanceOnBehodler).to.equal(SET.ONE)

    const behodlerProxyBalanceOnLimbo = await SET.CliffFace.balanceOf(SET.Limbo.address)
    expect(behodlerProxyBalanceOnLimbo).to.equal(SET.ZERO)

    const limboProxyBalanceOnBehodler = await SET.LimboProxy.balanceOf(SET.Behodler.address)
    expect(limboProxyBalanceOnBehodler.toString()).to.equal(SET.ZERO)

    const limboProxyBalanceOnLimbo = await SET.LimboProxy.balanceOf(SET.Limbo.address)
    expect(limboProxyBalanceOnLimbo).to.equal(SET.ZERO)
  });

  it("t5. base token to base token transfers correctly", async function () {
    //Register limbo and base token for Behodler
    await SET.Registry.setProxy(SET.BaseToken.address, SET.NULL_ADDRESS, SET.NULL_ADDRESS)
    await SET.BaseToken.approve(SET.Limbo.address, SET.MILLION)
    await SET.Limbo.stakeFor(SET.BaseToken.address, SET.ONE, SET.owner.address)

    const balanceOfBaseBeforeMigrate = await SET.BaseToken.balanceOf(SET.owner.address)
    await SET.Limbo.migrate(SET.BaseToken.address)


    const balanceOfBaseTokenAfterMigrate = await SET.BaseToken.balanceOf(SET.owner.address)
    const receivedBaseToken = balanceOfBaseTokenAfterMigrate.sub(balanceOfBaseBeforeMigrate)
    expect(receivedBaseToken.toString()).to.equal(SET.ONE.toString())

    await SET.BaseToken.transfer(SET.Registry.address, receivedBaseToken)

    //ACT
    await SET.Registry.TransferFromLimboTokenToBehodlerToken(SET.BaseToken.address);

    // //ASSERT
    const scxBalance = await SET.Behodler.balanceOf(SET.owner.address)
    expect(scxBalance.toString()).to.equal(SET.ONE.mul(98).div(100).div(10))

    const baseBalanceOnBehodler = await SET.BaseToken.balanceOf(SET.Behodler.address)
    expect(baseBalanceOnBehodler.toString()).to.equal(SET.ONE.toString())

    const behodlerProxyBalanceOnBehodler = await SET.CliffFace.balanceOf(SET.Behodler.address)
    expect(behodlerProxyBalanceOnBehodler).to.equal(SET.ZERO)

    const behodlerProxyBalanceOnLimbo = await SET.CliffFace.balanceOf(SET.Limbo.address)
    expect(behodlerProxyBalanceOnLimbo).to.equal(SET.ZERO)

    const limboProxyBalanceOnBehodler = await SET.LimboProxy.balanceOf(SET.Behodler.address)
    expect(limboProxyBalanceOnBehodler.toString()).to.equal(SET.ZERO)

    const limboProxyBalanceOnLimbo = await SET.LimboProxy.balanceOf(SET.Limbo.address)
    expect(limboProxyBalanceOnLimbo).to.equal(SET.ZERO)
  });
});
