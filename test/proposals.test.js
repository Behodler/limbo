const { expect, assert } = require("chai");
const { ethers } = require("hardhat");
describe("Proposals", function () {
  let owner, secondPerson, flanInstance,limboInstance, eyeInstance
  const zero = '0x0000000000000000000000000000000000000000'
  beforeEach(async function () {
    [owner, secondPerson] = await ethers.getSigners();
    const FlanFactory  = await ethers.getContractFactory('Flan')
    flanInstance = await FlanFactory.deploy()
    const LimboFactory= await ethers.getContractFactory("Limbo")
    const limboInstance = await LimboFactory.deploy()

    const TokenFactory = await ethers.getContractFactory('ERC677')
    const eyeInstance = await TokenFactory.deploy('EYE','EYE')

    //TODO: proposal factory
    const DAOfactory = await ethers.getContractFactory('LimboDAO')
    const daoInstance = await DAOfactory.deploy(limboInstance.address,flanInstance.address,eyeInstance.address)

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
