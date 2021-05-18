const { expect, assert } = require("chai");
const { ethers } = require("hardhat");
describe("MintingModule", function () {
  let owner, secondPerson, feeSetter, mintingModule, uniswapRouter, MockToken, scx, eye, dai, uniSwapFactory, reward, weth, ironCrown
  const zero = '0x0000000000000000000000000000000000000000'
  beforeEach(async function () {
    [owner, secondPerson, feeSetter] = await ethers.getSigners();
    const WETHFactory = await ethers.getContractFactory('WETH')
    weth = await WETHFactory.deploy()
    const UniswapFactory = await ethers.getContractFactory("UniswapV2Factory")
    uniSwapFactory = await UniswapFactory.deploy(feeSetter.address)
    const RouterFactory = await ethers.getContractFactory('UniswapV2Router02')
    uniswapRouter = await RouterFactory.deploy(uniSwapFactory.address, weth.address)
  })

  it("blank test", async function () {
    const Limbo = await ethers.getContractFactory("Limbo");
    const limbo = await Limbo.deploy();

    await limbo.deployed();
  });
});
