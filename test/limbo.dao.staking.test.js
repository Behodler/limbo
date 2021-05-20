const { expect, assert } = require("chai");
const { ethers } = require("hardhat");

const requireCondition = (condition, message) => {
  if (!condition)
    throw message;
}
describe("DAO", function () {
  let owner, secondPerson, feeSetter, dai, eye, link, sushi
  let daiEYESLP, linkEYESLP, sushiEYESLP, daiSushiSLP
  let daiEYEULP, linkEYEULP, sushiEYEULP, daiSushiULP
  let dao
  const zero = '0x0000000000000000000000000000000000000000'
  beforeEach(async function () {
    [owner, secondPerson, proposalFactory] = await ethers.getSigners();
    const UniswapFactoryFactory = await ethers.getContractFactory('UniswapFactory')
    const UniswapPairFactory = await ethers.getContractFactory('UniswapPair')

    const sushiSwapFactory = await UniswapFactoryFactory.deploy()
    const uniswapFactory = await UniswapFactoryFactory.deploy()
    requireCondition(sushiSwapFactory.address !== uniswapFactory.address)

    daiEYESLP = await UniswapPairFactory.deploy(sushiSwapFactory.address, "Univ2", "Uv2")
    linkEYESLP = await UniswapPairFactory.deploy(sushiSwapFactory.address, "Univ2", "Uv2")
    sushiEYESLP = await UniswapPairFactory.deploy(sushiSwapFactory.address, "Univ2", "Uv2")
    daiSushiSLP = await UniswapPairFactory.deploy(sushiSwapFactory.address, "Univ2", "Uv2")

    daiEYEULP = await UniswapPairFactory.deploy(uniswapFactory.address, "Univ2", "Uv2")
    linkEYEULP = await UniswapPairFactory.deploy(uniswapFactory.address, "Univ2", "Uv2")
    sushiEYEULP = await UniswapPairFactory.deploy(uniswapFactory.address, "Univ2", "Uv2")
    daiSushiULP = await UniswapPairFactory.deploy(uniswapFactory.address, "Univ2", "Uv2")

    const TokenFactory = await ethers.getContractFactory("MockToken")
    dai = await TokenFactory.deploy("dai", "dai", [daiEYESLP.address, daiSushiSLP.address, daiEYEULP.address, daiSushiULP.address], [120, 400, 500, 66])
    eye = await TokenFactory.deploy("eye", "eye", [daiEYESLP.address, linkEYESLP.address, sushiEYESLP.address,
    daiEYEULP.address, linkEYEULP.address, sushiEYEULP.address], [112, 332, 554, 33, 22, 121])
    link = await TokenFactory.deploy("link", "link", [linkEYESLP.address, linkEYEULP.address], [1123, 9])
    sushi = await TokenFactory.deploy("sushi", "sushi", [sushiEYESLP.address, daiSushiSLP.address, sushiEYEULP.address, daiSushiULP.address],
      [3322, 5543, 22, 112])

    const TransferHelperFactory = await ethers.getContractFactory("TransferHelper")
    const daoFactory = await ethers.getContractFactory("LimboDAO", {
      libraries: {
        TransferHelper: (await TransferHelperFactory.deploy()).address
      }
    })
    const OwnableStubFactory = await ethers.getContractFactory('OwnableStub')
    const limbo = await OwnableStubFactory.deploy()
    const flan = await OwnableStubFactory.deploy()

    dao = await daoFactory.deploy(limbo.address, flan.address, eye.address, proposalFactory.address, sushiSwapFactory.address, uniswapFactory.address,
      [daiEYESLP.address, linkEYESLP.address, sushiEYESLP.address],
      [daiEYEULP.address, linkEYEULP.address, sushiEYEULP.address])
    await limbo.transferOwnership(dao.address)
    await flan.transferOwnership(dao.address)

    const allAssets = [
      daiEYESLP,
      linkEYESLP,
      sushiEYESLP,
      daiSushiSLP,
      daiEYEULP,
      linkEYEULP,
      sushiEYEULP,
      daiSushiULP,
      eye
    ]
    for (let i = 0; i < allAssets.length; i++) {
      await allAssets[i].approve(dao.address, '115792089237316195423570985008687907853269984665640564039457584007913129639935')
    }
  })

  it("only eye or approved assets can be staked", async function () {
    await dao.makeLive()
    await expect(dao.stakeEYEBasedAsset(100, 400, 20, daiSushiSLP.address)).to.be.revertedWith("LimboDAO: illegal asset")
    await expect(dao.stakeEYEBasedAsset(100, 400, 20, daiSushiULP.address)).to.be.revertedWith("LimboDAO: illegal asset")
  });


  it("Only live staking", async function () {
    await expect(dao.stakeEYEBasedAsset(100, 400, 20, sushiEYEULP.address)).to.be.revertedWith("LimboDAO: DAO is not live. Wen Limbo?")
  })

  it("Staking Eye sets fate per day to root EYE ", async function () {
    const cloutBefore = await dao.stakedUserAssetWeight(owner.address, eye.address)
    expect(cloutBefore[0].toString()).to.equal('0')
    expect(cloutBefore[1].toString()).to.equal('0')
    await dao.makeLive()

    const userBalanceBefore = await eye.balanceOf(owner.address)
    const balanceOfDAObefore = await eye.balanceOf(dao.address)
    await dao.stakeEYEBasedAsset(100, 100, 10, eye.address)
    const balanceOfDAOAfter = await eye.balanceOf(dao.address)
    const userBalanceAfter = await eye.balanceOf(owner.address)

    expect(balanceOfDAOAfter.sub(balanceOfDAObefore).toString()).to.equal("100")
    expect(userBalanceBefore.sub(userBalanceAfter).toString()).to.equal("100")

    const cloutAfter = await dao.stakedUserAssetWeight(owner.address, eye.address)
    expect(cloutAfter[0].toString()).to.equal('10')
    expect(cloutAfter[1].toString()).to.equal('100')
  })

  it("Staking Eye and wait increases fate correctly", async function () {

  })

  // it("Staking LP set eye to 2 root eye balance", async function () {

  // })

  // it("Adjusting eye stake down releases eye and sets fate per day correctly", async function () {

  // })

  // it("Adjusting eye stake up takes more eye and sets fate per day correctly", async function () {

  // })

  // it("Only approved assets can be staked", async function () {

  // })

  // it("Adjusting LP stake down releases eye and sets fate per day correctly", async function () {

  // })

  // it("Adjusting LP stake up takes more eye and sets fate per day correctly", async function () {

  // })

  // it("Adjusting LP stake up takes more eye and sets fate per day correctly", async function () {

  // })

  // it("Staking, getting fate and then changing stake and waiting ends up with correct fate", async function () {

  // })

  // it("Staking multiple asset types sets fate rate correctly", async function () {

  // })

  // it("Staking multiple asset types, waiting, and then removing some asset types set fate correctly.", async function () {

  // })

})