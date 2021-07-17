const { expect, assert } = require("chai");
const { ethers, network } = require("hardhat");
const web3 = require("web3");

describe("Limbo", function () {
  let owner, secondPerson, feeSetter, dai, eye, link, sushi;
  let daiEYESLP, linkEYESLP, sushiEYESLP, daiSushiSLP;
  let daiEYEULP, linkEYEULP, sushiEYEULP, daiSushiULP;
  let dao, proposalFactory, updateProposalConfigProposal;
  let toggleWhiteList;
  const zero = "0x0000000000000000000000000000000000000000";

  beforeEach(async function () {
    [owner, secondPerson, proposalFactory] = await ethers.getSigners();

    const MockAngband = await ethers.getContractFactory("MockAngband");
    this.mockAngband = await MockAngband.deploy();

    const addTokenPowerFactory = await ethers.getContractFactory(
      "MockAddTokenPower"
    );
    this.addTokenPower = await addTokenPowerFactory.deploy();

    const MockBehodlerFactory = await ethers.getContractFactory("MockBehodler");
    this.mockBehodler = await MockBehodlerFactory.deploy(
      "Scarcity",
      "SCX",
      this.addTokenPower.address
    );

    const TransferHelperFactory = await ethers.getContractFactory(
      "TransferHelper"
    );
    const LimboDAOFactory = await ethers.getContractFactory("LimboDAO", {
      libraries: {
        TransferHelper: (await TransferHelperFactory.deploy()).address,
      },
    });

    this.limboDAO = await LimboDAOFactory.deploy();

    this.TokenFactory = await ethers.getContractFactory("MockToken");
    this.eye = await this.TokenFactory.deploy("eye", "eye", [], []);

    this.aave = await this.TokenFactory.deploy("aave", "aave", [], []);

    const flashGovernanceFactory = await ethers.getContractFactory(
      "FlashGovernanceArbiter"
    );
    this.flashGovernance = await flashGovernanceFactory.deploy(
      this.limboDAO.address
    );

    await this.flashGovernance.configureSecurityParameters(10, 100, 30);
    // await this.eye.approve(this.limbo.address, 2000);
    await this.flashGovernance.configureFlashGovernance(
      this.eye.address,
      1000,
      10,
      true
    );

    const FlanFactory = await ethers.getContractFactory("Flan");
    this.flan = await FlanFactory.deploy(this.limboDAO.address);

    const LimboFactory = await ethers.getContractFactory("Limbo");
    this.limbo = await LimboFactory.deploy(
      this.flan.address,
      10000000,
      this.limboDAO.address
    );

    await this.flan.whiteListMinting(this.limbo.address, true);
    await this.flan.whiteListMinting(owner.address, true);
    // await this.flan.endConfiguration();

    await this.addTokenPower.seed(
      this.mockBehodler.address,
      this.limbo.address
    );

    const UniswapFactoryFactory = await ethers.getContractFactory(
      "UniswapFactory"
    );

    const sushiSwapFactory = await UniswapFactoryFactory.deploy();
    const uniswapFactory = await UniswapFactoryFactory.deploy();

    const firstProposalFactory = await ethers.getContractFactory(
      "ToggleWhitelistProposalProposal"
    );
    this.whiteListingProposal = await firstProposalFactory.deploy(
      this.limboDAO.address,
      "toggle whitelist"
    );

    //  const flanSCXPair = await sushiSwapFactory.
    this.ProposalFactoryFactory = await ethers.getContractFactory(
      "ProposalFactory"
    );
    this.proposalFactory = await this.ProposalFactoryFactory.deploy(
      this.limboDAO.address,
      this.whiteListingProposal.address
    );

    const ProposalFactoryFactory = await ethers.getContractFactory(
      "ProposalFactory"
    );
    proposalFactory = await ProposalFactoryFactory.deploy(
      this.limboDAO.address,
      this.whiteListingProposal.address
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
    this.soulReader = await SoulReaderFactory.deploy(this.limboDAO.address);

    const UniswapHelperFactory = await ethers.getContractFactory(
      "UniswapHelper"
    );
    this.uniswapHelper = await UniswapHelperFactory.deploy(
      this.limbo.address,
      this.limboDAO.address
    );

    const routerFactory = await ethers.getContractFactory("MockUniswapRouter");
    this.router = await routerFactory.deploy();

    await this.flan.mint(this.router.address, 1000000);
    await this.mockBehodler.mintTo(this.router.address, 1000000);

    const migrationTokenPairFactory = await ethers.getContractFactory(
      "MockMigrationUniPair"
    );
    this.migrationTokenPair = await migrationTokenPairFactory.deploy(
      "uni",
      "uni"
    );
    await this.migrationTokenPair.setReserves(1000, 3000);
    await this.router.setPairAddress(this.migrationTokenPair.address);

    await this.uniswapHelper.configure(
      this.limbo.address,
      this.migrationTokenPair.address,
      this.mockBehodler.address,
      this.flan.address,
      this.router.address
    );

    await this.limbo.configureCrossingParameters(
      this.aave.address,
      1,
      1,
      true,
      10000010
    );

    await this.limbo.configureCrossingConfig(
      this.mockBehodler.address,
      this.mockAngband.address,
      this.uniswapHelper.address,
      this.addTokenPower.address,
      10000000,
      10000,
      10,
      32
    );

    toggleWhiteList = toggleWhiteListFactory(
      this.eye,
      this.limboDAO,
      this.whiteListingProposal,
      this.proposalFactory
    );
  });

  const advanceTime = async (seconds) => {
    await network.provider.send("evm_increaseTime", [seconds]); //6 hours
    await network.provider.send("evm_mine");
  };

  const advanceBlocks = async (blocks) => {
    for (let i = 0; i < blocks; i++) {
      await network.provider.send("evm_mine");
    }
  };

  const stringifyBigNumber = (b) => b.map((i) => i.toString());

  var toggleWhiteListFactory = (
    eye,
    dao,
    whiteListingProposal,
    proposalFactory
  ) => {
    return async function (contractToToggle) {
      await whiteListingProposal.parameterize(
        proposalFactory.address,
        contractToToggle
      );
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

  it("governance actions free to be invoked until configured set to true", async function () {
    //first invoke all of these successfully, then set config true and try again

    //onlySuccessfulProposal:
    //configureSoul
    await this.limbo.configureSoul(
      this.aave.address,
      100,
      10000000,
      0,
      0,
      0,
      0
    );
    await this.aave.transfer(this.limbo.address, 1000);
    //enableProtocol
    await this.limbo.enableProtocol();
    //governanceShutdown
    await this.limbo.governanceShutdown(this.aave.address);
    //withdrawERC20
    console.log(`secondPerson: ${secondPerson.address}`);
    await this.limbo.withdrawERC20(this.aave.address, secondPerson.address);
    expect(await this.aave.balanceOf(secondPerson.address)).to.equal(1000);
    //configureCrossingConfig

    await this.limbo.configureCrossingConfig(
      this.mockBehodler.address,
      this.mockAngband.address,
      this.uniswapHelper.address,
      this.addTokenPower.address,
      10000000,
      10000,
      10,
      44
    );

    //governanceApproved:
    //disableProtocol
    await this.limbo.disableProtocol();
    await this.limbo.enableProtocol();
    //adjustSoul
    await this.limbo.adjustSoul(this.aave.address, 100, 1, 0, 1);
    //configureCrossingParameters

    await this.limbo.configureCrossingParameters(
      this.aave.address,
      1,
      1,
      true,
      10000010
    );

    await this.limbo.endConfiguration();

    await expect(
      this.limbo.configureSoul(this.aave.address, 100, 10000000, 0, 0, 0, 0)
    ).to.be.revertedWith("Limbo: governance action failed.");
    // await this.aave.transfer(this.limbo.address, 1000);
    // enableProtocol
    await expect(this.limbo.enableProtocol()).to.be.revertedWith(
      "Limbo: governance action failed."
    );
    //governanceShutdown

    //withdrawERC20

    await expect(
      this.limbo.withdrawERC20(this.aave.address, secondPerson.address)
    ).to.be.revertedWith("Limbo: governance action failed.");

    //configureCrossingConfig
    await expect(
      this.limbo.configureCrossingConfig(
        this.mockBehodler.address,
        this.mockAngband.address,
        this.uniswapHelper.address,
        this.addTokenPower.address,
        10000000,
        10000,
        10,
        3
      )
    ).to.be.revertedWith("Limbo: governance action failed.");

    //governanceApproved:
    //disableProtocol
    await expect(this.limbo.disableProtocol()).to.be.revertedWith(
      "ERC20: transfer amount exceeds allowance"
    );
    await expect(this.limbo.enableProtocol()).to.be.revertedWith(
      "Limbo: governance action failed."
    );
    //adjustSoul
    await expect(
      this.limbo.adjustSoul(this.aave.address, 100, 1, 0, 1)
    ).to.be.revertedWith("ERC20: transfer amount exceeds allowance");
    //configureCrossingParameters

    await expect(
      this.limbo.configureCrossingParameters(
        this.aave.address,
        1,
        1,
        true,
        10000010
      )
    ).to.be.revertedWith("ERC20: transfer amount exceeds allowance");
  });

  it("old souls can be claimed from", async function () {
    //make a threshold pool.
    await this.limbo.configureSoul(
      this.aave.address,
      100,
      10000000,
      1,
      0,
      1,
      0
    );
    await this.limbo.endConfiguration();

    const flanBalanceBefore = await this.flan.balanceOf(owner.address);

    console.log((await this.flan.balanceOf(owner.address)).toString());
    //stake tokens
    await this.aave.approve(this.limbo.address, "10000001");
    await this.limbo.stake(this.aave.address, "10000");
    console.log((await this.flan.balanceOf(owner.address)).toString());
    //fast forward time
    await advanceTime(90000); //just over a day

    //stake enough tokens to cross threshold
    await this.limbo.stake(this.aave.address, "9990001");
    console.log((await this.flan.balanceOf(owner.address)).toString());
    //assert soul state change
    const stats = await this.soulReader.SoulStats(this.aave.address);
    expect(stats[0].toString()).to.equal("2");
    expect(stats[1].toString()).to.equal("10000001");
    //claim

    await this.limbo.claimReward(this.aave.address, 0);
    const flanBalanceAfter = await this.flan.balanceOf(owner.address);
    console.log((await this.flan.balanceOf(owner.address)).toString());
    expect(flanBalanceAfter.sub(flanBalanceBefore).toString()).to.equal(
      "9999999"
    );
  });

  it("old souls can be bonus claimed from (DELTA = 0)", async function () {
    //make a threshold pool.
    await this.limbo.configureSoul(
      this.aave.address,
      100,
      10000000,
      1,
      0,
      1,
      0
    );

    await this.limbo.configureCrossingParameters(
      this.aave.address,
      21000000,
      0,
      true,
      10000000
    );

    await this.limbo.endConfiguration();

    const flanBalanceBefore = await this.flan.balanceOf(owner.address);

    console.log((await this.flan.balanceOf(owner.address)).toString());
    //stake tokens
    await this.aave.approve(this.limbo.address, "10000001");
    await this.limbo.stake(this.aave.address, "10000");
    console.log((await this.flan.balanceOf(owner.address)).toString());
    //fast forward time
    await advanceTime(90000); //just over a day

    //stake enough tokens to cross threshold
    await this.limbo.stake(this.aave.address, "9990001");
    console.log((await this.flan.balanceOf(owner.address)).toString());
    //assert soul state change
    const stats = await this.soulReader.SoulStats(this.aave.address);
    expect(stats[0].toString()).to.equal("2");
    expect(stats[1].toString()).to.equal("10000001");
    //claim

    await this.limbo.claimBonus(this.aave.address, 0);

    const flanBalanceAfter = await this.flan.balanceOf(owner.address);
    console.log((await this.flan.balanceOf(owner.address)).toString());
    expect(flanBalanceAfter.sub(flanBalanceBefore).toString()).to.equal(
      "210" //crossing bonus * staked tokens.
    );
  });

  it("old souls can be bonus claimed from (DELTA > 0)", async function () {
    //make a threshold pool.
    await this.limbo.configureSoul(
      this.aave.address,
      100,
      10000000,
      1,
      0,
      1,
      0
    );

    await this.limbo.configureCrossingParameters(
      this.aave.address,
      21000000,
      10000000,
      true,
      10000000
    );

    await this.limbo.endConfiguration();

    const flanBalanceBefore = await this.flan.balanceOf(owner.address);

    console.log((await this.flan.balanceOf(owner.address)).toString());
    //stake tokens
    await this.aave.approve(this.limbo.address, "10000001");
    await this.limbo.stake(this.aave.address, "10000");
    console.log((await this.flan.balanceOf(owner.address)).toString());
    //fast forward time
    await advanceTime(90000); //just over a day

    //stake enough tokens to cross threshold
    await this.limbo.stake(this.aave.address, "9990001");
    console.log((await this.flan.balanceOf(owner.address)).toString());
    //assert soul state change
    const stats = await this.soulReader.SoulStats(this.aave.address);
    expect(stats[0].toString()).to.equal("2");
    expect(stats[1].toString()).to.equal("10000001");

    await this.limbo.claimBonus(this.aave.address, 0);

    const flanBalanceAfter = await this.flan.balanceOf(owner.address);
    console.log((await this.flan.balanceOf(owner.address)).toString());
    expect(flanBalanceAfter.sub(flanBalanceBefore).toString()).to.equal(
      "9000710" //crossing bonus * staked tokens.
    );
  });

  it("old souls can be bonus claimed from (DELTA < 0)", async function () {
    //make a threshold pool.
    await this.limbo.configureSoul(
      this.aave.address,
      100,

      10000000,
      1,
      0,
      1,
      0
    );

    await this.limbo.configureCrossingParameters(
      this.aave.address,
      20000000000,
      "-1000",
      true,
      10000000
    );

    await this.limbo.endConfiguration();

    const flanBalanceBefore = await this.flan.balanceOf(owner.address);

    console.log((await this.flan.balanceOf(owner.address)).toString());
    //stake tokens
    await this.aave.approve(this.limbo.address, "10000001");
    await this.limbo.stake(this.aave.address, "10000");
    console.log((await this.flan.balanceOf(owner.address)).toString());
    //fast forward time
    await advanceTime(44000); //half a day

    //stake enough tokens to cross threshold
    await this.limbo.stake(this.aave.address, "9990001");
    console.log((await this.flan.balanceOf(owner.address)).toString());
    //assert soul state change
    const stats = await this.soulReader.SoulStats(this.aave.address);
    expect(stats[0].toString()).to.equal("2");
    expect(stats[1].toString()).to.equal("10000001");

    await this.limbo.claimBonus(this.aave.address, 0);

    const flanBalanceAfter = await this.flan.balanceOf(owner.address);
    console.log((await this.flan.balanceOf(owner.address)).toString());
    expect(flanBalanceAfter.sub(flanBalanceBefore).toString()).to.equal(
      "199559" //crossing bonus * staked tokens.
    );
  });

  it("perpetual pools have no upper limit", async function () {
    //make a threshold pool.
    await this.limbo.configureSoul(
      this.aave.address,
      100,
      10000000,
      2,
      0,
      1,
      0
    );

    await this.limbo.configureCrossingParameters(
      this.aave.address,
      20000000000,
      "-1000",
      true,
      10000000
    );

    await this.limbo.endConfiguration();

    await this.aave.approve(this.limbo.address, "10000001");
    await this.limbo.stake(this.aave.address, "10000001");

    const stats = await this.soulReader.SoulStats(this.aave.address);
    expect(stats[0].toNumber()).to.equal(1);
  });

  it("use flashGovernance to adjustSoul", async function () {
    //configure soul
    await this.limbo.configureSoul(
      this.aave.address,
      100,
      10000000,
      2,
      0,
      1,
      0
    );

    await this.limbo.configureCrossingParameters(
      this.aave.address,
      20000000000,
      "-1000",
      true,
      10000000
    );

    //set flash loan params
    await this.flashGovernance.configureFlashGovernance(
      this.eye.address,
      21000000, //amount to stake
      604800, //lock duration = 1 week,
      true // asset is burnable
    );
    await this.flashGovernance.endConfiguration();
    //end configuration
    await this.limbo.endConfiguration();

    //try to adjust soul and fail
    await expect(
      this.limbo.adjustSoul(this.aave.address, 100, 1, 10, 1)
    ).to.be.revertedWith("ERC20: transfer amount exceeds allowance");

    //stake requisite tokens, try again and succeed.
    await this.eye.approve(this.flashGovernance.address, 21000000);
    await this.limbo.adjustSoul(this.aave.address, 100, 1, 20000000001, -1001);

    const newStates = await this.soulReader.CrossingParameters(
      this.aave.address
    );

    //assert newStates
    const stringNewStates = stringifyBigNumber(newStates);
    expect(stringNewStates[0]).to.equal("100");
    expect(stringNewStates[1]).to.equal("1");
    expect(stringNewStates[2]).to.equal("20000000001");
    expect(stringNewStates[3]).to.equal("-1001");
  });

  it("flashGovernance adjust configureCrossingParameters", async function () {
    //set flash loan params
    await this.flashGovernance.configureFlashGovernance(
      this.eye.address,
      21000000, //amount to stake
      604800, //lock duration = 1 week,
      true // asset is burnable
    );
    await this.flashGovernance.endConfiguration();
    //end configuration
    await this.limbo.endConfiguration();
    await this.eye.approve(this.flashGovernance.address, 21000000);
    await this.limbo.configureCrossingParameters(
      this.aave.address,
      1,
      1,
      true,
      10000010
    );

    await expect(
      this.flashGovernance.withdrawGovernanceAsset(
        this.limbo.address,
        this.eye.address
      )
    ).to.be.revertedWith("Limbo: Flashgovernance decision pending.");

    await advanceTime(604801);

    const eyeBalanceBefore = await this.eye.balanceOf(owner.address);
    await this.flashGovernance.withdrawGovernanceAsset(
      this.limbo.address,
      this.eye.address
    );
    const eyeBalanceAfter = await this.eye.balanceOf(owner.address);

    expect(eyeBalanceAfter.sub(eyeBalanceBefore).toString()).to.equal(
      "21000000"
    );
  });

  it("burn asset for flashGov decision", async function () {
    //set flash loan params
    await this.flashGovernance.configureFlashGovernance(
      this.eye.address,
      21000000, //amount to stake
      604800, //lock duration = 1 week,
      true // asset is burnable
    );
    await this.flashGovernance.endConfiguration();
    //end configuration
    await this.limbo.endConfiguration();

    //make flashgovernance decision.
    await this.eye.approve(this.flashGovernance.address, 21000000);

    // //we need fate to lodge proposal.
    const requiredFate = (await this.limboDAO.proposalConfig())[1];
    const eyeToBurn = requiredFate.mul(2).div(10).add(1);
    console.log("EYE to burn " + eyeToBurn.toString());
    await this.eye.approve(this.limboDAO.address, eyeToBurn.mul(100));
    await this.limboDAO.burnAsset(this.eye.address, eyeToBurn);

    //configure and lodge proposal
    const burnFlashStakeProposalFactory = await ethers.getContractFactory(
      "BurnFlashStakeDeposit"
    );
    const burnFlashStakeProposal = await burnFlashStakeProposalFactory.deploy(
      this.limboDAO.address,
      "burnFlash"
    );
    await burnFlashStakeProposal.parameterize(
      owner.address,
      this.eye.address,
      "21000000",
      this.flashGovernance.address,
      this.limbo.address
    );

    await toggleWhiteList(burnFlashStakeProposal.address);

    await this.limbo.configureCrossingParameters(
      this.aave.address,
      1,
      1,
      true,
      10000010
    );
    await this.proposalFactory.lodgeProposal(burnFlashStakeProposal.address);
    let currentProposal = (await this.limboDAO.currentProposalState())[4];
    console.log("proposal: " + currentProposal);
    expect(
      currentProposal.toString() !==
        "0x0000000000000000000000000000000000000000"
    ).to.be.true;

    //get more fate to vote
    await this.limboDAO.burnAsset(this.eye.address, "10000");

    //vote on proposal
    await this.limboDAO.vote(burnFlashStakeProposal.address, "10000");

    const flashGovConfig = await this.flashGovernance.flashGovernanceConfig();
    const advancement = flashGovConfig[2].sub(1000);
    console.log("advancement: " + advancement.toString());
    //fast forward time to after voting round finishes but before flash asset unlocked
    await advanceTime(advancement.toNumber()); //more time

    //assert eye locked for user
    const pendingBeforeAttempt =
      await this.flashGovernance.pendingFlashDecision(
        this.limbo.address,
        owner.address
      );
    expect(pendingBeforeAttempt[1].toString()).to.equal("21000000");

    //try to withdraw flash gov asset and fail. Assert money still there
    await expect(
      this.flashGovernance.withdrawGovernanceAsset(
        this.limbo.address,
        this.eye.address
      )
    ).to.be.revertedWith("Limbo: Flashgovernance decision pending.");

    //execute burn proposal

    const eyeTotalsupplyBefore = await this.eye.totalSupply();
    const eyeInFlashGovBefore = await this.eye.balanceOf(
      this.flashGovernance.address
    );

    await this.limboDAO.executeCurrentProposal();

    const eyeInFlashGovAfter = await this.eye.balanceOf(
      this.flashGovernance.address
    );
    const eyeTotalsupplyAfter = await this.eye.totalSupply();
    const pendingAfterAttempt = await this.flashGovernance.pendingFlashDecision(
      this.limbo.address,
      owner.address
    );

    expect(pendingAfterAttempt[1].toString()).to.equal("21000000");
    //assert eye has declined by 21000000
    expect(eyeInFlashGovBefore.sub(eyeInFlashGovAfter).toString()).to.equal(
      "21000000"
    );
    expect(eyeTotalsupplyBefore.sub(eyeTotalsupplyAfter).toString()).to.equal(
      "21000000"
    );
  });

  it("unstaking rewards user correctly and sets unclaimed to zero", async function () {
    //make a threshold pool.
    await this.limbo.configureSoul(
      this.aave.address,
      100, //alloc
      10000000, //crossingThreshold
      1, //soulType
      0, //exitPenalty
      1, //state
      0
    );
    await this.limbo.endConfiguration();

    //stake tokens
    await this.aave.approve(this.limbo.address, "10000001");
    await this.limbo.stake(this.aave.address, "10000");

    await advanceTime(400000);

    const userInfoBeforeUntake = await this.limbo.userInfo(
      this.aave.address,
      owner.address,
      0
    );
    expect(userInfoBeforeUntake[0].toNumber()).to.equal(10000);

    const flanPerSecond = await this.limbo.flanPerSecond();
    const expectedFlanLowerbound = flanPerSecond
      .mul(400001)
      .div(1000000)
      .toNumber(); // only staker, 1 second extra
    const userFlanBalanceBefore = await this.flan.balanceOf(owner.address);
    const expectedFlanUpperbound = flanPerSecond
      .mul(400006)
      .div(1000000)
      .toNumber();
    await this.limbo.unstake(this.aave.address, 4000);
    const userFlanBalanceAfter = await this.flan.balanceOf(owner.address);

    const userInfoAfterUnstake = await this.limbo.userInfo(
      this.aave.address,
      owner.address,
      0
    );

    const actualFlanDiff = userFlanBalanceAfter
      .sub(userFlanBalanceBefore)
      .div(1000000)
      .toNumber();

    expect(actualFlanDiff).to.be.greaterThanOrEqual(expectedFlanLowerbound);
    expect(actualFlanDiff).to.be.lessThanOrEqual(expectedFlanUpperbound);

    expect(userInfoAfterUnstake[0].toNumber()).to.equal(6000);
  });

  it("staking and claim for multiple stakers divides reward correctly", async function () {
    //make a threshold pool.
    await this.limbo.configureSoul(
      this.aave.address,
      100, //alloc
      10000000, //crossingThreshold
      1, //soulType
      0, //exitPenalty
      1, //state
      0
    );
    await this.limbo.endConfiguration();

    const flanPerSecond = await this.limbo.flanPerSecond();

    //stake tokens
    await this.aave.approve(this.limbo.address, "10000001");
    await this.limbo.stake(this.aave.address, "10000");
    await this.aave.transfer(secondPerson.address, 2000);
    await this.aave
      .connect(secondPerson)
      .approve(this.limbo.address, "10000001");
    await this.limbo.connect(secondPerson).stake(this.aave.address, 2000);

    await advanceTime(400000);

    const userFlanBalanceBefore = await this.flan.balanceOf(owner.address);

    await this.limbo.unstake(this.aave.address, 4000);
    const userFlanBalanceAfter = await this.flan.balanceOf(owner.address);

    const userInfoAfterUnstake = await this.limbo.userInfo(
      this.aave.address,
      owner.address,
      0
    );

    const changeInFlan = userFlanBalanceAfter
      .sub(userFlanBalanceBefore)
      .div("10000000")
      .toNumber();
    console.log("change in flan " + changeInFlan);
    const lowerBound = 333335;
    const upperBound = 333339;
    assert.isAbove(changeInFlan, lowerBound);
    assert.isBelow(changeInFlan, upperBound);

    expect(userInfoAfterUnstake[0].toNumber()).to.equal(6000);
  });

  it("staking and claim for mutilple souls divides rewards according to allocpoints", async function () {
    //make another token
    this.whacked = await this.TokenFactory.deploy(
      "mcaffee",
      "epsteined",
      [],
      []
    );

    //configure another token to stake
    await this.limbo.configureSoul(
      this.whacked.address,
      300, //alloc
      10000000, //crossingThreshold
      1, //soulType
      0, //exitPenalty
      1, //state
      0
    );

    //make a threshold pool.
    await this.limbo.configureSoul(
      this.aave.address,
      100, //alloc
      10000000, //crossingThreshold
      1, //soulType
      0, //exitPenalty
      1, //state
      0
    );
    await this.limbo.endConfiguration();

    //stake tokens
    await this.aave.approve(this.limbo.address, "10000001");
    await this.limbo.stake(this.aave.address, "10000");

    await advanceTime(400000);

    const userInfoBeforeUntake = await this.limbo.userInfo(
      this.aave.address,
      owner.address,
      0
    );
    expect(userInfoBeforeUntake[0].toNumber()).to.equal(10000);

    const flanPerSecond = await this.limbo.flanPerSecond();
    const expectedFlanLowerRange = flanPerSecond
      .mul(400001)
      .div(4)
      .div(1000000)
      .toNumber(); // quarter rewards because sharing with other token
    const expectedFlanUpperRange = flanPerSecond
      .mul(400003)
      .div(4)
      .div(1000000)
      .toNumber(); // quarter rewards because sharing with other token

    const userFlanBalanceBefore = await this.flan.balanceOf(owner.address);

    await this.limbo.unstake(this.aave.address, 4000);
    const userFlanBalanceAfter = await this.flan.balanceOf(owner.address);

    const userInfoAfterUnstake = await this.limbo.userInfo(
      this.aave.address,
      owner.address,
      0
    );

    const actualFlanDiff = userFlanBalanceAfter
      .sub(userFlanBalanceBefore)
      .div(1000000)
      .toNumber();

    expect(actualFlanDiff).to.be.greaterThanOrEqual(expectedFlanLowerRange);
    expect(actualFlanDiff).to.be.lessThanOrEqual(expectedFlanUpperRange);
    expect(userInfoAfterUnstake[0].toNumber()).to.equal(6000);
  });

  it("staking/unstaking only possible in staking state", async function () {
    await this.limbo.configureSoul(
      this.aave.address,
      100, //alloc
      10000000, //crossingThreshold
      1, //soulType
      0, //exitPenalty
      1, //state
      0
    );
    await this.limbo.endConfiguration();

    //stake tokens
    await this.aave.approve(this.limbo.address, "10000001");
    await this.limbo.stake(this.aave.address, "10000");

    const updateSoulConfigProposalFactory = await ethers.getContractFactory(
      "UpdateSoulConfigProposal"
    );
    const updateSoulConfigProposal =
      await updateSoulConfigProposalFactory.deploy(
        this.limboDAO.address,
        "change state",
        this.limbo.address
      );

    await updateSoulConfigProposal.parameterize(
      this.aave.address,
      100,
      10000000,
      1,
      0,
      2,
      0
    );

    const proposalConfig = await this.limboDAO.proposalConfig();
    const requiredFate = proposalConfig[1].mul(2);
    await this.eye.approve(this.limboDAO.address, requiredFate);
    await this.eye.mint(requiredFate);
    await this.limboDAO.burnAsset(this.eye.address, requiredFate);

    await toggleWhiteList(updateSoulConfigProposal.address);
    await this.proposalFactory.lodgeProposal(updateSoulConfigProposal.address);

    await this.limboDAO.vote(updateSoulConfigProposal.address, 1000);

    await advanceTime(6048010);
    await this.limboDAO.executeCurrentProposal();

    await expect(
      this.limbo.stake(this.aave.address, "10000")
    ).to.be.revertedWith("E2");

    await expect(
      this.limbo.unstake(this.aave.address, "10000")
    ).to.be.revertedWith("E2");
  });

  it("staking an invalid token fails", async function () {
    this.titan = await this.TokenFactory.deploy("iron", "finance", [], []);

    //stake tokens
    await this.titan.approve(this.limbo.address, "10000001");
    await expect(
      this.limbo.stake(this.titan.address, "10000")
    ).to.be.revertedWith("E1");
  });

  it("unstaking with exitPenalty >= 10000 reverts with E3", async function () {
    await this.limbo.configureSoul(
      this.aave.address,
      100, //alloc
      10000000, //crossingThreshold
      1, //soulType
      10000, //exitPenalty
      1, //state
      0
    );
    await this.limbo.endConfiguration();

    //stake tokens
    await this.aave.approve(this.limbo.address, "10000001");
    await this.limbo.stake(this.aave.address, "10000");

    await expect(
      this.limbo.unstake(this.aave.address, "100")
    ).to.be.revertedWith("E3");
  });

  it("unstaking amount larger than balance reverts with E4", async function () {
    await this.limbo.configureSoul(
      this.aave.address,
      100, //alloc
      10000000, //crossingThreshold
      1, //soulType
      0, //exitPenalty
      1, //state
      0
    );
    await this.limbo.endConfiguration();

    //stake tokens
    await this.aave.approve(this.limbo.address, "10000001");
    await this.limbo.stake(this.aave.address, "10000");

    await expect(
      this.limbo.unstake(this.aave.address, "10001")
    ).to.be.revertedWith("E4");
  });

  it("unstaking with exitPenalty > 0 incurs penalty on claims  ", async function () {
    //gather rewards for zero penalty
    await this.limbo.configureSoul(
      this.aave.address,
      100, //alloc
      10000000, //crossingThreshold
      1, //soulType
      0, //exitPenalty
      1, //state
      0
    );

    const flanBeforeZeroPenaltyStake = await this.flan.balanceOf(owner.address);

    //stake tokens
    await this.aave.approve(this.limbo.address, "10000001");
    await this.limbo.stake(this.aave.address, "10000");

    await advanceTime(1000);

    this.limbo.unstake(this.aave.address, "10000");
    const flanAfterZeroPenaltyStake = await this.flan.balanceOf(owner.address);

    const zeroPenaltyRewards = flanAfterZeroPenaltyStake.sub(
      flanBeforeZeroPenaltyStake
    );

    const flanBeforeQuarterRewardStake = await this.flan.balanceOf(
      owner.address
    );

    //gather rewards for exit penalty = 75%
    await this.limbo.configureSoul(
      this.aave.address,
      100, //alloc
      10000000, //crossingThreshold
      1, //soulType
      7500, //exitPenalty = 75%
      1, //state
      0
    );

    await this.limbo.stake(this.aave.address, "10000");

    await advanceTime(1000);

    this.limbo.unstake(this.aave.address, "10000");
    const flanAfterQuarterRewardStake = await this.flan.balanceOf(
      owner.address
    );

    const quarterRewards = flanAfterQuarterRewardStake.sub(
      flanBeforeQuarterRewardStake
    );

    expect(quarterRewards.mul(4).toString()).to.equal(
      zeroPenaltyRewards.toString()
    );
  });

  it("claims disabled on exitPenalty>0", async function () {
    await this.limbo.configureSoul(
      this.aave.address,
      100, //alloc
      10000000, //crossingThreshold
      1, //soulType
      1, //exitPenalty
      1, //state
      0
    );
    //stake tokens
    await this.aave.approve(this.limbo.address, "10000001");
    await this.limbo.stake(this.aave.address, "10000");

    await advanceTime(1000);

    await expect(
      this.limbo.claimReward(this.aave.address, 0)
    ).to.be.revertedWith("EA");

    await this.limbo.configureSoul(
      this.aave.address,
      100, //alloc
      10000000, //crossingThreshold
      1, //soulType
      0, //exitPenalty
      1, //state
      0
    );

    const flanBeforeClaim = await this.flan.balanceOf(owner.address);
    await this.limbo.claimReward(this.aave.address, 0);
    const flanAfterClaim = await this.flan.balanceOf(owner.address);
    const actualReward = flanAfterClaim.sub(flanBeforeClaim);

    const expectedFlanRewardLowerBound = (await this.limbo.flanPerSecond()).mul(
      1000
    );
    const expectedFlanRewardUpperBound = (await this.limbo.flanPerSecond()).mul(
      1005
    );

    expect(actualReward.gte(expectedFlanRewardLowerBound)).to.be.true;
    expect(actualReward.lte(expectedFlanRewardUpperBound)).to.be.true;
  });

  it("unstaking amount larger than balance reverts with E4", async function () {
    await this.limbo.configureSoul(
      this.aave.address,
      100, //alloc
      10000000, //crossingThreshold
      1, //soulType
      0, //exitPenalty
      1, //state
      0
    );
    await this.limbo.endConfiguration();

    //stake tokens
    await this.aave.approve(this.limbo.address, "10000001");
    await this.limbo.stake(this.aave.address, "10000");

    await expect(
      this.limbo.unstake(this.aave.address, "10001")
    ).to.be.revertedWith("E4");
  });

  it("claiming staked reward resets unclaimed to zero", async function () {
    await this.limbo.configureSoul(
      this.aave.address,
      100, //alloc
      10000000, //crossingThreshold
      1, //soulType
      0, //exitPenalty
      1, //state
      0
    );
    //stake tokens
    await this.aave.approve(this.limbo.address, "10000001");
    await this.limbo.stake(this.aave.address, "10000");

    await advanceTime(1000);

    const flanBeforeFirstClaim = await this.flan.balanceOf(owner.address);
    await this.limbo.claimReward(this.aave.address, 0);
    const flanAfterFirstClaim = await this.flan.balanceOf(owner.address);
    await this.limbo.claimReward(this.aave.address, 0);
    const flanAfterSecondClaim = await this.flan.balanceOf(owner.address);

    expect(flanAfterFirstClaim.gt(flanBeforeFirstClaim));
    expect(flanAfterSecondClaim).to.equal(flanAfterFirstClaim.add("10000000"));
  });

  it("claim bonus disabled during staking", async function () {
    await this.limbo.configureSoul(
      this.aave.address,
      100, //alloc
      10000000, //crossingThreshold
      1, //soulType
      0, //exitPenalty
      1, //state
      0
    );
    //stake tokens
    await this.aave.approve(this.limbo.address, "10000001");
    await this.limbo.stake(this.aave.address, "10000");

    await advanceTime(1000);
    await expect(
      this.limbo.claimBonus(this.aave.address, 0)
    ).to.be.revertedWith("E2");
  });

  it("claiming negative bonus fails", async function () {
    await this.limbo.configureSoul(
      this.aave.address,
      100, //alloc
      10000, //crossingThreshold
      1, //soulType
      0, //exitPenalty
      1, //state
      0
    );

    await this.limbo.configureCrossingParameters(
      this.aave.address,
      10,
      -10,
      true,
      10000
    );

    //stake tokens
    await this.aave.approve(this.limbo.address, "10000001");
    await this.limbo.stake(this.aave.address, "9999");

    await advanceTime(1000);
    await this.limbo.stake(this.aave.address, "2");

    await expect(
      this.limbo.claimBonus(this.aave.address, 0)
    ).to.be.revertedWith("ED");
  });

  it("withdrawERC20 fails on souls", async function () {
    await this.limbo.configureSoul(
      this.aave.address,
      100, //alloc
      10000, //crossingThreshold
      1, //soulType
      0, //exitPenalty
      1, //state
      0
    );
    await this.aave.transfer(this.limbo.address, "6666");
    const withdrawERC20Factory = await ethers.getContractFactory(
      "WithdrawERC20Proposal"
    );
    const withdrawERC20 = await withdrawERC20Factory.deploy(
      this.limboDAO.address
    );

    await withdrawERC20.parameterize(this.aave.address, secondPerson.address);
    await toggleWhiteList(withdrawERC20.address);
    // //we need fate to lodge proposal.
    const requiredFate = (await this.limboDAO.proposalConfig())[1];
    const eyeToBurn = requiredFate.mul(2).div(10).add(1);
    await this.eye.approve(this.limboDAO.address, eyeToBurn.mul(100));
    await this.limboDAO.burnAsset(this.eye.address, eyeToBurn);

    await this.proposalFactory.lodgeProposal(withdrawERC20.address);
    const fateState = await this.limboDAO.fateState(owner.address);
    expect(fateState[1].toString()).to.equal("223000000000000000010");
    await this.limboDAO.vote(withdrawERC20.address, "223000000000000000010");

    await advanceTime(6048010);

    await expect(this.limboDAO.executeCurrentProposal()).to.be.revertedWith(
      "E7"
    );
  });

  it("withdrawERC20 succeeds on non listed tokens or previously listed tokens.", async function () {
    await this.aave.transfer(this.limbo.address, "6666");
    const withdrawERC20Factory = await ethers.getContractFactory(
      "WithdrawERC20Proposal"
    );
    const withdrawERC20 = await withdrawERC20Factory.deploy(
      this.limboDAO.address
    );

    await withdrawERC20.parameterize(this.aave.address, secondPerson.address);

    await toggleWhiteList(withdrawERC20.address);
    // //we need fate to lodge proposal.
    const requiredFate = (await this.limboDAO.proposalConfig())[1];
    const eyeToBurn = requiredFate.mul(2).div(10).add(1);
    await this.eye.approve(this.limboDAO.address, eyeToBurn.mul(100));
    await this.limboDAO.burnAsset(this.eye.address, eyeToBurn);

    await this.proposalFactory.lodgeProposal(withdrawERC20.address);
    const fateState = await this.limboDAO.fateState(owner.address);
    expect(fateState[1].toString()).to.equal("223000000000000000010");
    await this.limboDAO.vote(withdrawERC20.address, "223000000000000000010");

    await advanceTime(6048010);
    const aaveBalanceBefore = await this.aave.balanceOf(secondPerson.address);
    await this.limboDAO.executeCurrentProposal();

    const aaveBalanceAfter = await this.aave.balanceOf(secondPerson.address);

    expect(aaveBalanceAfter.sub(aaveBalanceBefore).toNumber()).to.equal(6666);
  });

  it("migration fails on not waitingToCross", async function () {
    await this.limbo.configureSoul(
      this.aave.address,
      100, //alloc
      10000000, //crossingThreshold
      1, //soulType
      0, //exitPenalty
      1, //state
      0
    );
    //stake tokens
    await this.aave.approve(this.limbo.address, "10000001");
    await this.limbo.stake(this.aave.address, "10000");
    await expect(this.limbo.migrate(this.aave.address)).to.be.revertedWith(
      "E2"
    );
  });

  it("too much reserve drift between stamping and execution fails (divergenceTolerance)", async function () {
    await this.limbo.configureCrossingConfig(
      this.mockBehodler.address,
      this.mockAngband.address,
      this.uniswapHelper.address,
      this.addTokenPower.address,
      6756,
      1000,
      20,
      105
    );

    const crossingConfig = await this.limbo.crossingConfig();
    const minWait = crossingConfig[4];
    expect(minWait.toNumber()).to.equal(20);

    await this.limbo.configureSoul(
      this.aave.address,
      100, //alloc
      100, //crossingThreshold
      1, //soulType
      0, //exitPenalty
      1, //state
      0
    );
    //stake tokens
    await this.aave.approve(this.limbo.address, "10000001");
    await this.limbo.stake(this.aave.address, "10000");

    //assert state is now waitingToCross
    const currentSoul = await this.limbo.souls(this.aave.address, 0);
    expect(currentSoul[5]).to.equal(2);

    const requiredDelayBetweenEndOfStakingAndMigrate = (
      await this.limbo.crossingConfig()
    )[5].toNumber();

    await advanceTime(requiredDelayBetweenEndOfStakingAndMigrate + 1);
    await this.uniswapHelper.generateFLNQuote();

    const minQuoteWaitDuration = (
      await this.limbo.crossingConfig()
    )[4].toNumber();

    //3×10¹⁸
    //
    await advanceTime(minQuoteWaitDuration + 1);
    await this.migrationTokenPair.setReserves(1000, 4000); //divergence = 133.333

    await expect(this.limbo.migrate(this.aave.address)).to.be.revertedWith(
      "EG"
    );

    await this.migrationTokenPair.setReserves(2000, 4000); //divergence = 150

    await expect(this.limbo.migrate(this.aave.address)).to.be.revertedWith(
      "EG"
    );
  });

  it("stamping reserves requires wait to pass before migration", async function () {
    await this.limbo.configureCrossingConfig(
      this.mockBehodler.address,
      this.mockAngband.address,
      this.uniswapHelper.address,
      this.addTokenPower.address,
      6756,
      1000,
      20,
      105
    );

    const crossingConfig = await this.limbo.crossingConfig();
    const minWait = crossingConfig[4];
    expect(minWait.toNumber()).to.equal(20);

    await this.limbo.configureSoul(
      this.aave.address,
      100, //alloc
      100, //crossingThreshold
      1, //soulType
      0, //exitPenalty
      1, //state
      0
    );
    //stake tokens
    await this.aave.approve(this.limbo.address, "10000001");
    await this.limbo.stake(this.aave.address, "10000");

    //assert state is now waitingToCross
    const currentSoul = await this.limbo.souls(this.aave.address, 0);
    expect(currentSoul[5]).to.equal(2);

    const requiredDelayBetweenEndOfStakingAndMigrate = (
      await this.limbo.crossingConfig()
    )[5].toNumber();

    await advanceTime(requiredDelayBetweenEndOfStakingAndMigrate + 1);
    await this.uniswapHelper.generateFLNQuote();

    await expect(this.limbo.migrate(this.aave.address)).to.be.revertedWith(
      "EH"
    );
  });

  it("only threshold souls can migrate", async function () {
    await this.limbo.configureCrossingConfig(
      this.mockBehodler.address,
      this.mockAngband.address,
      this.uniswapHelper.address,
      this.addTokenPower.address,
      6756,
      1000,
      20,
      105
    );

    const crossingConfig = await this.limbo.crossingConfig();
    const minWait = crossingConfig[4];
    expect(minWait.toNumber()).to.equal(20);

    await this.limbo.configureSoul(
      this.aave.address,
      100, //alloc
      100, //crossingThreshold
      2, //soulType
      0, //exitPenalty
      1, //state
      0
    );
    //stake tokens
    await this.aave.approve(this.limbo.address, "10000001");
    await this.limbo.stake(this.aave.address, "10000");

    //assert state is now waitingToCross
    const currentSoul = await this.limbo.souls(this.aave.address, 0);
    expect(currentSoul[5]).to.equal(1);

    const requiredDelayBetweenEndOfStakingAndMigrate = (
      await this.limbo.crossingConfig()
    )[5].toNumber();

    await advanceTime(requiredDelayBetweenEndOfStakingAndMigrate + 1);
    await this.uniswapHelper.generateFLNQuote();

    const minQuoteWaitDuration = (
      await this.limbo.crossingConfig()
    )[4].toNumber();

    await advanceTime(minQuoteWaitDuration + 1);
    await expect(this.limbo.migrate(this.aave.address)).to.be.revertedWith(
      "EB"
    );
  });

  it("SCX burnt leaves rectangle of fairness.", async function () {
    await this.limbo.configureCrossingConfig(
      this.mockBehodler.address,
      this.mockAngband.address,
      this.uniswapHelper.address,
      this.addTokenPower.address,
      6756,
      1000,
      20,
      105
    );

    const crossingConfig = await this.limbo.crossingConfig();
    const minWait = crossingConfig[4];
    expect(minWait.toNumber()).to.equal(20);

    await this.limbo.configureSoul(
      this.aave.address,
      100, //alloc
      100, //crossingThreshold
      1, //soulType
      0, //exitPenalty
      1, //state
      0
    );
    //stake tokens
    await this.aave.approve(this.limbo.address, "10000001");
    await this.limbo.stake(this.aave.address, "10000");

    //assert state is now waitingToCross
    const currentSoul = await this.limbo.souls(this.aave.address, 0);
    expect(currentSoul[5]).to.equal(2);

    const requiredDelayBetweenEndOfStakingAndMigrate = (
      await this.limbo.crossingConfig()
    )[5].toNumber();

    await advanceTime(requiredDelayBetweenEndOfStakingAndMigrate + 1);
    await this.uniswapHelper.generateFLNQuote();

    const minQuoteWaitDuration = (
      await this.limbo.crossingConfig()
    )[4].toNumber();

    //3×10¹⁸
    //
    await advanceBlocks(minQuoteWaitDuration + 1);

    //Just for mock testing
    await this.flan.mint(this.router.address, 10000);
    await this.mockBehodler.mintTo(this.router.address, 10000);

    const scxBalanceOfPairBefore = await this.mockBehodler.balanceOf(
      this.migrationTokenPair.address
    );

    const blackHoleAddress = await this.uniswapHelper.blackHole();

    const blackHoleBalanceBefore = await this.migrationTokenPair.balanceOf(
      blackHoleAddress
    );
    this.limbo.migrate(this.aave.address);
    const blackHoleBalanceAfter = await this.migrationTokenPair.balanceOf(
      blackHoleAddress
    );

    const scxBalanceOfPairAfter = await this.mockBehodler.balanceOf(
      this.migrationTokenPair.address
    );

    expect(
      scxBalanceOfPairAfter.sub(scxBalanceOfPairBefore).toNumber()
    ).to.equal(54);

    expect(
      blackHoleBalanceAfter.sub(blackHoleBalanceBefore).toNumber()
    ).to.equal(750);

    //assert crossed over
    const state = (await this.limbo.souls(this.aave.address, 0))[5].toString();
    expect(state).to.equal("3");
  });

  it("any whitelisted contract can mint flan", async function () {
    //assert secondPerson can't mint flan
    await expect(
      this.flan.connect(secondPerson).mint(owner.address, 1000)
    ).to.be.revertedWith("Flan: Mint allowance exceeded");

    //whitelist secondPerson
    await this.flan.whiteListMinting(secondPerson.address, true);

    //mint as secondPerson
    const flanBefore = await this.flan.balanceOf(owner.address);
    await this.flan.connect(secondPerson).mint(owner.address, 1000);
    const flanAfter = await this.flan.balanceOf(owner.address);
    expect(flanAfter.sub(flanBefore).toString()).to.equal("1000");

    //unwhitelist secondPerson
    await this.flan.whiteListMinting(secondPerson.address, false);

    //assert secondPerson can't mint flan
    await expect(
      this.flan.connect(secondPerson).mint(owner.address, 1000)
    ).to.be.revertedWith("Flan: Mint allowance exceeded");
  });

  it("flan burn fee on transfer proposal", async function () {
    const feechangeProposalFactory = await ethers.getContractFactory('AdjustFlanFeeOnTransferProposal')
    const feechangeProposal = await feechangeProposalFactory.deploy(this.limboDAO.address,"changer")

    await feechangeProposal.parameterize(this.flan.address,3)

    await this.flan.mint(owner.address,100)

    //transfer flan to second and assert 100 arrives
    await this.flan.transfer(secondPerson.address,100)
    expect(await this.flan.balanceOf(secondPerson.address)).to.equal(100)

    //execute proposal
    await this.eye.mint('100000000000000000000')
    await this.eye.approve(this.limboDAO.address,'100000000000000000000')
    await this.limboDAO.burnAsset(this.eye.address,'100000000000000000000')
    await toggleWhiteList(feechangeProposal.address)

    await this.proposalFactory.lodgeProposal(feechangeProposal.address)
    await this.limboDAO.vote(feechangeProposal.address,1000)

    await advanceTime(1000000000)

    await this.limboDAO.executeCurrentProposal()
    //transfer flan back to owner and assert only 97 arrive
    const totalSupplyBefore = await this.flan.totalSupply()
    await this.flan.connect(secondPerson).transfer(owner.address,100)
    expect(await this.flan.balanceOf(owner.address)).to.equal(97)


    //assert flan supply fallen by 3
    const totalSupplyAfter = await this.flan.totalSupply()
    expect(totalSupplyBefore.sub(totalSupplyAfter)).to.equal(3)
  });

});
