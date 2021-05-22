const { expect, assert } = require("chai");
const { ethers, network } = require("hardhat");


describe("DAO Proposals", function () {
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
        await dao.makeLive()
    })

    const advanceTime = async (seconds) => {
        await network.provider.send("evm_increaseTime", [seconds]) //6 hours
        await network.provider.send("evm_mine")
    }
    const ONE = BigInt('1000000000000000000')
    const NAUGHT_POINT_ONE = ONE / 10n

    it('Insufficient fate to lodge rejected', async function () {

    })

    it('lodging proposal when none exist accepted', async function () {

    })

    it('Lodging proposal while existing proposal valid rejected', async function () {

    })

    it('Proposal requires bytes32 name', async function () {

    })
    it('Voting yes on current proposal accepts it after duration, can then be executed', async function () {

    })
    it('voting no on current proposal makes it unexecutable.', async function () {

    })
    it('Lodging proposal while existing proposal valid rejected', async function () {

    })
    it('Lodging proposal while existing proposal valid rejected', async function () {

    })
    it('proposal to change fateweight, voting duration works', async function () {

    })
    it('asset approval proposal can add and remove approved assets', async function () {

    })

})