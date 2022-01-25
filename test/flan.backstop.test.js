const { expect, assert } = require("chai");
const { ethers, network } = require("hardhat");
const web3 = require("web3");

describe("FlanBackStop", function () {
  let owner, secondPerson, feeSetter, dai, eye, link, sushi;
  let daiEYESLP, linkEYESLP, sushiEYESLP, daiSushiSLP;
  let daiEYEULP, linkEYEULP, sushiEYEULP, daiSushiULP;
  let dao, proposalFactory, updateProposalConfigProposal;
  let toggleWhiteList;
  const zero = "0x0000000000000000000000000000000000000000";

  beforeEach(async function () {
    [owner, secondPerson, proposalFactory] = await ethers.getSigners();

    this.TokenFactory = await ethers.getContractFactory("MockToken");
    this.MIM = await this.TokenFactory.deploy("MIM", "MIM", [], []);
    this.dai = await this.TokenFactory.deploy("DAI", "DAI", [], []);
    this.USDC = await this.TokenFactory.deploy("USDC", "USDC", [], []);
    this.eye = await this.TokenFactory.deploy("EYE", "EYE", [], []);
    this.nonStable = await this.TokenFactory.deploy("nonStable", "nonStable", [], []);

    const LachesisLite = await ethers.getContractFactory("LachesisLite");
    this.lachesisLite = await LachesisLite.deploy();

    await this.lachesisLite.measure(this.MIM.address, true, false);
    await this.lachesisLite.measure(this.dai.address, true, false);
    await this.lachesisLite.measure(this.USDC.address, true, false);
    await this.lachesisLite.measure(this.nonStable.address, true, false);

    const MockAngband = await ethers.getContractFactory("MockAngband");
    this.mockAngband = await MockAngband.deploy();

    const addTokenPowerFactory = await ethers.getContractFactory("MockAddTokenPower");
    this.addTokenPower = await addTokenPowerFactory.deploy();

    const MockBehodlerFactory = await ethers.getContractFactory("MockBehodler");
    this.mockBehodler = await MockBehodlerFactory.deploy("Scarcity", "SCX", this.addTokenPower.address);

    const TransferHelperFactory = await ethers.getContractFactory("TransferHelper");
    const LimboDAOFactory = await ethers.getContractFactory("LimboDAO", {
      libraries: {
        TransferHelper: (await TransferHelperFactory.deploy()).address,
      },
    });

    this.limboDAO = await LimboDAOFactory.deploy();

    const flashGovernanceFactory = await ethers.getContractFactory("FlashGovernanceArbiter");
    this.flashGovernance = await flashGovernanceFactory.deploy(this.limboDAO.address);

    await this.flashGovernance.configureSecurityParameters(10, 100, 30);
    // await this.eye.approve(this.limbo.address, 2000);
    await this.flashGovernance.configureFlashGovernance(this.eye.address, 1000, 10, true);

    const FlanFactory = await ethers.getContractFactory("Flan");
    this.flan = await FlanFactory.deploy(this.limboDAO.address);

    const SoulLib = await ethers.getContractFactory("SoulLib");
    const CrossingLib = await ethers.getContractFactory("CrossingLib");
    const MigrationLib = await ethers.getContractFactory("MigrationLib");
    const LimboFactory = await ethers.getContractFactory("Limbo", {
      libraries: {
        SoulLib: (await SoulLib.deploy()).address,
        CrossingLib: (await CrossingLib.deploy()).address,
        MigrationLib: (await MigrationLib.deploy()).address,
      },
    });
    this.limbo = await LimboFactory.deploy(
      this.flan.address,
      //  10000000,
      this.limboDAO.address
    );

    await this.flan.whiteListMinting(this.limbo.address, true);
    await this.flan.whiteListMinting(owner.address, true);
    // await this.flan.endConfiguration();

    await this.addTokenPower.seed(this.mockBehodler.address, this.limbo.address);

    const UniswapFactoryFactory = await ethers.getContractFactory("UniswapFactory");

    const sushiSwapFactory = await UniswapFactoryFactory.deploy();
    const uniswapFactory = await UniswapFactoryFactory.deploy();

    const firstProposalFactory = await ethers.getContractFactory("ToggleWhitelistProposalProposal");
    this.whiteListingProposal = await firstProposalFactory.deploy(this.limboDAO.address, "toggle whitelist");

    const morgothTokenApproverFactory = await ethers.getContractFactory("MockMorgothTokenApprover");

    this.morgothTokenApprover = await morgothTokenApproverFactory.deploy();

    const soulUpdateProposalFactory = await ethers.getContractFactory("UpdateSoulConfigProposal");

    this.soulUpdateProposal = await soulUpdateProposalFactory.deploy(
      this.limboDAO.address,
      "hello",
      this.limbo.address,
      this.morgothTokenApprover.address
    );

    //  const flanSCXPair = await sushiSwapFactory.
    this.ProposalFactoryFactory = await ethers.getContractFactory("ProposalFactory");
    this.proposalFactory = await this.ProposalFactoryFactory.deploy(
      this.limboDAO.address,
      this.whiteListingProposal.address,
      this.soulUpdateProposal.address
    );

    await this.limboDAO.seed(
      this.limbo.address,
      this.flan.address,
      this.eye.address,
      this.proposalFactory.address,
      sushiSwapFactory.address,
      uniswapFactory.address,
      this.flashGovernance.address,
      9,
      [],
      []
    );

    await this.limbo.setDAO(this.limboDAO.address);

    await this.limboDAO.makeLive();

    const SoulReaderFactory = await ethers.getContractFactory("SoulReader");
    this.soulReader = await SoulReaderFactory.deploy();

    const UniswapHelperFactory = await ethers.getContractFactory("UniswapHelper");
    this.uniswapHelper = await UniswapHelperFactory.deploy(this.limbo.address, this.limboDAO.address);
    await this.flan.whiteListMinting(this.uniswapHelper.address, true);

    const migrationTokenPairFactory = await ethers.getContractFactory("MockMigrationUniPair");
    this.migrationTokenPair = await migrationTokenPairFactory.deploy("uni", "uni");
    await this.migrationTokenPair.setReserves(1000, 3000);

    await this.uniswapHelper.configure(
      this.limbo.address,
      this.migrationTokenPair.address,
      this.mockBehodler.address,
      this.flan.address,
      110,
      32,
      20,
      0
    );
    await this.uniswapHelper.setDAI(this.dai.address);

    await this.limbo.configureCrossingParameters(this.MIM.address, 1, 1, true, 10000010);

    await this.limbo.configureCrossingConfig(
      this.mockBehodler.address,
      this.mockAngband.address,
      this.uniswapHelper.address,
      this.addTokenPower.address,
      10000000,
      10000,
      100
    );

    toggleWhiteList = toggleWhiteListFactory(this.eye, this.limboDAO, this.whiteListingProposal, this.proposalFactory);

    const TokenProxyRegistry = await ethers.getContractFactory("TokenProxyRegistry");
    this.registry = await TokenProxyRegistry.deploy(this.limboDAO.address);

    const LiquidityReceiver = await ethers.getContractFactory("LiquidityReceiver");
    this.liquidityReceiver = await LiquidityReceiver.deploy(this.lachesisLite.address);

    await this.lachesisLite.measure(this.flan.address, true, false);
    await this.liquidityReceiver.registerPyroToken(this.flan.address, "PyroFlan", "PFLN");
    await this.liquidityReceiver.registerPyroToken(this.MIM.address, "PyroMIM", "PMIM");
    await this.liquidityReceiver.registerPyroToken(this.dai.address, "PyroDAI", "PDAI");
    await this.liquidityReceiver.registerPyroToken(this.USDC.address, "PyroUSDC", "PUSDC");
  });

  var toggleWhiteListFactory = (eye, dao, whiteListingProposal, proposalFactory) => {
    return async function (contractToToggle) {
      await whiteListingProposal.parameterize(proposalFactory.address, contractToToggle);
      const requiredFateToLodge = (await dao.proposalConfig())[1];

      await eye.mint(requiredFateToLodge);
      await eye.approve(dao.address, requiredFateToLodge.mul(2));
      await dao.burnAsset(eye.address, requiredFateToLodge.div(5).add(10));

      await proposalFactory.lodgeProposal(whiteListingProposal.address);
      await dao.vote(whiteListingProposal.address, "100");
      await advanceTime(100000000);
      await dao.executeCurrentProposal();
    };
  };

  it("bad config fails", async function () {
    const FlanBackStop = await ethers.getContractFactory("FlanBackstop");
    const pyroFlanAddress = await this.liquidityReceiver.getPyroToken(this.flan.address);
    flanBackStop = await FlanBackStop.deploy(this.limboDAO.address, pyroFlanAddress, this.flan.address);

    await this.MIM.approve(flanBackStop.address, "1000000000");
    await this.MIM.mint("2000000000");
    await expect(flanBackStop.purchasePyroFlan(this.MIM.address, "1000000000")).to.be.revertedWith(
      "BACKSTOP: configure stablecoin"
    );
  });

  it("purchase price tilts flan price higher, user receives money's worth", async function () {});

  it("each successive holder can redeem more before pushing the price below acceptable limits.", async function () {});

  it("flan price manipulation fails", async function () {});
});
