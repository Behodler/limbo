const { expect, assert } = require("chai");
const { ethers, network } = require("hardhat");
const web3 = require("web3");

describe("Limbo", function () {
  let owner, secondPerson, feeSetter, dai, eye, link, sushi;
  let daiEYESLP, linkEYESLP, sushiEYESLP, daiSushiSLP;
  let daiEYEULP, linkEYEULP, sushiEYEULP, daiSushiULP;
  let dao, proposalFactory, updateProposalConfigProposal;
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

    const TokenFactory = await ethers.getContractFactory("MockToken");
    this.eye = await TokenFactory.deploy("eye", "eye", [], []);

    this.aave = await TokenFactory.deploy("aave", "aave", [], []);

    const FlanFactory = await ethers.getContractFactory("Flan");
    this.flan = await FlanFactory.deploy(this.limboDAO.address);

    const LimboFactory = await ethers.getContractFactory("Limbo");
    this.limbo = await LimboFactory.deploy(
      this.flan.address,
      10000000,
      this.limboDAO.address
    );

    await this.addTokenPower.seed(
      this.mockBehodler.address,
      this.limbo.address
    );

    const UniswapFactoryFactory = await ethers.getContractFactory(
      "UniswapFactory"
    );

    const sushiSwapFactory = await UniswapFactoryFactory.deploy();
    const uniswapFactory = await UniswapFactoryFactory.deploy();

    const ProposalFactoryFactory = await ethers.getContractFactory(
      "ProposalFactory"
    );
    this.proposalFactory = await ProposalFactoryFactory.deploy();

    await this.limboDAO.seed(
      this.limbo.address,
      this.flan.address,
      this.eye.address,
      this.proposalFactory.address,
      sushiSwapFactory.address,
      uniswapFactory.address,
      [],
      []
    );

    await this.limboDAO.makeLive();

    const UniswapHelperFactory = await ethers.getContractFactory(
      "UniswapHelper"
    );
    this.uniswapHelper = await UniswapHelperFactory.deploy(
      this.limbo.address,
      this.limboDAO.address
    );

    //Create proposal for configuring
    //vote proposal passes
    //execute

    await this.limbo.configureCrossingConfig(
      this.mockAngband.address,
      this.addTokenPower.address,
      this.mockBehodler.address,
      this.uniswapHelper.address,
      10000000,
      10000
    );

    await this.limbo.configureSecurityParameters(10, 100, 30);
   // await this.eye.approve(this.limbo.address, 2000);
    await this.limbo.configureFlashGovernance(this.eye.address, 1000, 10, true);
  });

  it("governance actions free to be invoked until configured set to true", async function () {
    //first invoke all of these successfully, then set config true and try again

    //onlySuccessfulProposal:
    //configureSoul
    await this.limbo.configureSoul(
      this.aave.address,
      100,
      0,
      0,
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
      this.mockAngband.address,
      this.addTokenPower.address,
      this.mockBehodler.address,
      this.uniswapHelper.address,
      10000000,
      10000
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
      this.limbo.configureSoul(
        this.aave.address,
        100,
        0,
        0,
        10000000,
        0,
        0,
        0,
        0
      )
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
        this.mockAngband.address,
        this.addTokenPower.address,
        this.mockBehodler.address,
        this.uniswapHelper.address,
        10000000,
        10000
      )
    ).to.be.revertedWith("Limbo: governance action failed.");

    //governanceApproved:
    //disableProtocol
    await expect(this.limbo.disableProtocol()).to.be.revertedWith(
      "revert ERC20: transfer amount exceeds allowance"
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

  it("old souls can be claimed from", async function () {});

  it("old souls can be bonus claimed from", async function () {});

  it("perpetual pools have no upper limit", async function () {});

  it("populating crossingConfig with configureCrossingConfig", async function () {});

  it("use flashGovernance to adjustSoul", async function () {});
  it("flashGovernance adjust configureCrossingParameters", async function () {});
  it("reverse fashGov decision and burn asset", async function () {});
  it("shutdown soul staking and send tokens to fundDestination (governanceShutdown)", async function () {});
  it("unstaking rewards user correctly and sets unclaimed to zero", async function () {});
  it("staking/unstaking only possible in staking state", async function () {});
  it("staking an invalid token fails", async function () {});
  it("aggregate rewards per token per second aligns with configuration and adds up to flan per second.", async function () {});
  it("unstaking with exitPenalty > 1000 reverts with E3", async function () {});
  it("unstaking amount larger than balance reverts with E4", async function () {});
  it("unstaking with exitPenalty > 0 incurs penalty on claims  ", async function () {});
  it("claims disabled on exitPenalty>0", async function () {});
  it("claiming staked reward resets unclaimed to zero", async function () {});
  it("claim bonus ", async function () {});
  it("claim bonus disabled during staking", async function () {});
  it("claiming negative bonus fails", async function () {});
  it("withdrawERC20 fails on souls", async function () {});
  it("withdrawERC20 fails on souls", async function () {});
  it("withdrawERC20 succeeds on non listed tokens or previously listed tokens.", async function () {});
  it("migration fails on not waitingToCross", async function () {});
  it("stamping reserves requires wait to pass before migration", async function () {});
  it("too much reserve drift between stamping and execution fails (divergenceTolerance)", async function () {});
  it("only threshold souls can migrate", async function () {});
  it("SCX burnt leaves rectangle of fairness.", async function () {});
  it("Flan price and liquidity higher post migration.", async function () {});
  it("soul changed to crossedOver post migration", async function () {});
  it("token tradeable on Behodler post migration.", async function () {});
  it("any whitelisted contract can mint flan", async function () {});
  it("flash governance max tolerance respected", async function () {});
});
