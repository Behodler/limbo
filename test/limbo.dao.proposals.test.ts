const { expect, assert } = require("chai");
const { ethers, network } = require("hardhat");
const web3 = require("web3");

const requireCondition = (condition, message) => {
  if (!condition) throw message;
};

describe("DAO Proposals", function () {
  let owner, secondPerson, feeSetter, dai, eye, link, sushi;
  let daiEYESLP, linkEYESLP, sushiEYESLP, daiSushiSLP;
  let daiEYEULP, linkEYEULP, sushiEYEULP, daiSushiULP;
  let dao, proposalFactory, updateProposalConfigProposal;
  const zero = "0x0000000000000000000000000000000000000000";

  beforeEach(async function () {
    [owner, secondPerson] = await ethers.getSigners();
    const UniswapFactoryFactory = await ethers.getContractFactory("UniswapV2Factory");
    const UniswapPairFactory = await ethers.getContractFactory("UniswapV2Pair");

    this.sushiSwapFactory = await UniswapFactoryFactory.deploy(owner.address);
    this.uniswapFactory = await UniswapFactoryFactory.deploy(owner.address);
    requireCondition(this.sushiSwapFactory.address !== this.uniswapFactory.address,"factories cannot be the same");

    const RouterFactory = await ethers.getContractFactory("UniswapV2Router02");
    const sushiRouter = await RouterFactory.deploy(this.sushiSwapFactory.address, owner.address);
    const uniRouter = await RouterFactory.deploy(this.uniswapFactory.address, owner.address);

    const TokenFactory = await ethers.getContractFactory("SimpleMockTokenToken");
    dai = await TokenFactory.deploy("DAI", "DAI");
    link = await TokenFactory.deploy("LINK", "LINK");
    sushi = await TokenFactory.deploy("SUSHI", "SUSHI");
    eye = await TokenFactory.deploy("EYE", "EYE");
    const createSLP = await metaPairFactory(eye, this.sushiSwapFactory, false);
    daiEYESLP = await createSLP(dai);
    linkEYESLP = await createSLP(link);
    sushiEYESLP = await createSLP(sushi);

    const createDAISLP = await metaPairFactory(dai, this.sushiSwapFactory);
    daiSushiSLP = await createDAISLP(sushi);

    const createULP = await metaPairFactory(eye, this.uniswapFactory);
    daiEYEULP = await createULP(dai);
    linkEYEULP = await createULP(link);
    sushiEYEULP = await createULP(sushi);

    const createDAIULP = await metaPairFactory(dai, this.uniswapFactory);
    daiSushiULP = await createDAIULP(sushi);

    const TransferHelperFactory = await ethers.getContractFactory("NetTransferHelper");
    const daoFactory = await ethers.getContractFactory("LimboDAO", {
      libraries: {
        NetTransferHelper: (await TransferHelperFactory.deploy()).address,
      },
    });

    dao = await daoFactory.deploy();

    const flashGovernanceFactory = await ethers.getContractFactory("FlashGovernanceArbiter");
    this.flashGovernance = await flashGovernanceFactory.deploy(dao.address);
    await dao.setFlashGoverner(this.flashGovernance.address);

    const GovernableStubFactory = await ethers.getContractFactory("GovernableStub");
    this.limbo = await GovernableStubFactory.deploy(dao.address);

    const LimboOracleFactory = await ethers.getContractFactory("LimboOracle");
    this.sushiOracle = await LimboOracleFactory.deploy(this.sushiSwapFactory.address, dao.address);
    this.uniOracle = await LimboOracleFactory.deploy(this.uniswapFactory.address, dao.address);

    const sushiMetaPairCreator = await metaPairFactory(eye, this.sushiSwapFactory, false);
    this.metaDaiEYESLP = await sushiMetaPairCreator(daiEYESLP);
    this.metaLinkEYESLP = await sushiMetaPairCreator(linkEYESLP);
    this.metaSushiEYESLP = await sushiMetaPairCreator(sushiEYESLP);

    const uniMetaPairCreator = await metaPairFactory(eye, this.uniswapFactory);
    this.metaDaiEYEULP = await uniMetaPairCreator(daiEYEULP);
    this.metaLinkEYEULP = await uniMetaPairCreator(linkEYEULP);
    this.metaSushiEYEULP = await uniMetaPairCreator(sushiEYEULP);

    this.sushiTrade = await tradeOn(sushiRouter, eye);
    await this.sushiTrade(dai, false);
    await this.sushiTrade(link);
    await this.sushiTrade(sushi);

    this.uniTrade = await tradeOn(uniRouter, eye);
    await this.uniTrade(dai);
    await this.uniTrade(link);
    await this.uniTrade(sushi);

    const FlanFactory = await ethers.getContractFactory("Flan");
    this.flan = await FlanFactory.deploy(dao.address);
    this.flan.transferOwnership(dao.address);

    const firstProposalFactory = await ethers.getContractFactory("ToggleWhitelistProposalProposal");
    this.whiteListingProposal = await firstProposalFactory.deploy(dao.address, "toggle whitelist");

    const morgothTokenApproverFactory = await ethers.getContractFactory("MockMorgothTokenApprover");

    this.morgothTokenApprover = await morgothTokenApproverFactory.deploy();

    const soulUpdateProposalFactory = await ethers.getContractFactory("UpdateSoulConfigProposal");

    this.soulUpdateProposal = await soulUpdateProposalFactory.deploy(
      dao.address,
      "hello",
      this.limbo.address,
      this.morgothTokenApprover.address
    );

    const ProposalFactoryFactory = await ethers.getContractFactory("ProposalFactory");
    proposalFactory = await ProposalFactoryFactory.deploy(
      dao.address,
      this.whiteListingProposal.address,
      this.soulUpdateProposal.address
    );

    await dao.seed(
      this.limbo.address,
      this.flan.address,
      eye.address,
      proposalFactory.address,
      this.sushiOracle.address,
      this.uniOracle.address,
      [this.metaDaiEYESLP.address, this.metaLinkEYESLP.address, this.metaSushiEYESLP.address],
      [this.metaDaiEYEULP.address, this.metaLinkEYEULP.address, this.metaSushiEYEULP.address]
    );

    await dao.setFlashGoverner(this.flashGovernance.address);

    await dao.makeLive();
    await proposalFactory.setDAO(dao.address);

    const UpdateProposalConfigProposalFactory = await ethers.getContractFactory("UpdateProposalConfigProposal");
    updateProposalConfigProposal = await UpdateProposalConfigProposalFactory.deploy(dao.address, "UPDATE_CONFIG");

    await toggleWhiteList(updateProposalConfigProposal.address, this.whiteListingProposal);
  });

  const toggleWhiteList = async (contractToToggle, whiteListingProposal) => {
    await whiteListingProposal.parameterize(proposalFactory.address, contractToToggle);
    const requiredFateToLodge = (await dao.proposalConfig())[1];

    await eye.mint(requiredFateToLodge);
    await eye.approve(dao.address, requiredFateToLodge.mul(2));
    await dao.burnAsset(eye.address, requiredFateToLodge.div(5).add(10), false);

    await proposalFactory.lodgeProposal(whiteListingProposal.address);
    await dao.vote(whiteListingProposal.address, "100");
    await advanceTime(100000000);
    await dao.executeCurrentProposal();
  };

  const advanceTime = async (seconds) => {
    await network.provider.send("evm_increaseTime", [seconds]); //6 hours
    await network.provider.send("evm_mine");
  };

  const logFactory = (log) => {
    let counter = 0;
    return (message) => {
      if (log) console.log(`${counter++}: ${message}`);
    };
  };

  const metaPairFactory = async (eye, factory, canLog?:boolean) => {
    const log = logFactory(canLog);
    const UniswapFactoryFactory = await ethers.getContractFactory("UniswapV2Factory");
    const uniFactory = await UniswapFactoryFactory.attach(factory.address);

    let eyeBase = 1;
    return async (LP) => {
      const length = await uniFactory.allPairsLength();
      await uniFactory.createPair(eye.address, LP.address);
      const metaPairAddress = await uniFactory.getPair(eye.address, LP.address);
      const LPBalance = await LP.balanceOf(owner.address);
      log(`LP balance ${await LP.balanceOf(owner.address)}, eye balance ${await eye.balanceOf(owner.address)}`);

      await LP.transfer(metaPairAddress, LPBalance.div(10));

      const eyeBalance = await eye.balanceOf(owner.address);

      await eye.transfer(metaPairAddress, `${eyeBalance.div(10)}`);
      log("post transfer");
      const PairFactory = await ethers.getContractFactory("UniswapV2Pair");
      const metaPair = await PairFactory.attach(metaPairAddress);
      log("mint");
      await metaPair.mint(owner.address);
      log("post mint");
      return metaPair;
    };
  };

  const tradeOn = async (router, eye) => {
    return async (input, canLog) => {
      const log = logFactory(canLog);
      const factoryAddress = await router.factory();
      const UniswapFactoryFactory = await ethers.getContractFactory("UniswapV2Factory");
      const uniFactory = await UniswapFactoryFactory.attach(factoryAddress);

      const baseAddress = await uniFactory.getPair(input.address, eye.address);
      const metaPairAddress = await uniFactory.getPair(baseAddress, eye.address);
      log(`baseAddress ${baseAddress}, metaPairAddress ${metaPairAddress}`);

      const UniswapPairFactory = await ethers.getContractFactory("UniswapV2Pair");
      //trade input
      const uniPair = await UniswapPairFactory.attach(baseAddress);
      await input.transfer(baseAddress, "1000000000000000000000");
      await uniPair.swap("0", "10000000000000000000", owner.address, []);

      //trade metaLP
      const metaPair = await UniswapPairFactory.attach(metaPairAddress);

      await eye.transfer(metaPairAddress, "1000000000000000000000");
      await metaPair.swap("0", "10000000000000000000", owner.address, []);
    };
  };
  const ONE = BigInt("1000000000000000000");
  const NAUGHT_POINT_ONE = ONE / 10n;

  it("1. Insufficient fate to lodge rejected", async function () {
    await expect(proposalFactory.lodgeProposal(updateProposalConfigProposal.address)).to.be.revertedWith(
      "Arithmetic operation underflowed or overflowed outside of an unchecked block"
    );
  });

  it("2. lodging proposal when none exist accepted", async function () {
    const requiredFate = (await dao.proposalConfig())[1];
    const eyeToBurn = requiredFate.mul(2).div(10).add(1);
    await dao.burnAsset(eye.address, eyeToBurn, false);
    await proposalFactory.lodgeProposal(updateProposalConfigProposal.address);
    const currentProposalAfter = (await dao.currentProposalState())[4];
    expect(currentProposalAfter.toString()).to.equal(updateProposalConfigProposal.address);
  });

  it("3. paramerterize once proposal is lodged fails", async function () {
    //lodge, parameterize and assert
    const requiredFate = (await dao.proposalConfig())[1];
    const eyeToBurn = requiredFate.mul(2).div(10).add(1);
    await dao.burnAsset(eye.address, eyeToBurn, false);
    await updateProposalConfigProposal.parameterize(100, 200, proposalFactory.address);
    await proposalFactory.lodgeProposal(updateProposalConfigProposal.address);
    const params = await updateProposalConfigProposal.params();
    expect(params[0].toString()).to.equal("100");
    expect(params[1].toString()).to.equal("200");
    expect(params[2]).to.equal(proposalFactory.address);
    const currentProposalAfter = (await dao.currentProposalState())[4];
    expect(currentProposalAfter.toString()).to.equal(updateProposalConfigProposal.address);

    await expect(updateProposalConfigProposal.parameterize(110, 220, proposalFactory.address)).to.be.revertedWith(
      "LimboDAO: proposal locked"
    );
  });

  it("4. Lodging proposal while existing proposal valid rejected", async function () {
    //lodge, parameterize and assert
    const requiredFate = (await dao.proposalConfig())[1];
    const eyeToBurn = requiredFate.mul(2).div(10).add(1);
    await dao.burnAsset(eye.address, eyeToBurn, false);
    await updateProposalConfigProposal.parameterize(100, 200, proposalFactory.address);
    await proposalFactory.lodgeProposal(updateProposalConfigProposal.address);
    //end lodge

    let SetAssetApprovalProposalFactory = await ethers.getContractFactory("SetAssetApprovalProposal");
    let setAssetApprovalProposal = await SetAssetApprovalProposalFactory.deploy(dao.address, "ASSET");

    await setAssetApprovalProposal.parameterize(sushiEYEULP.address, false,false,1);

    await expect(toggleWhiteList(setAssetApprovalProposal.address, this.whiteListingProposal)).to.be.revertedWith(
      "LimboDAO: active proposal."
    );
  });

  it("5. success returns half of required fate", async function () {
    //lodge, parameterize and assert
    const requiredFate = (await dao.proposalConfig())[1];
    const eyeToBurn = requiredFate.mul(2).div(10).add(1);
    await dao.burnAsset(eye.address, eyeToBurn, false);

    //fate before
    const fateBeforeLodge = (await dao.fateState(owner.address))[1];
    await updateProposalConfigProposal.parameterize(100, "223000000000000000000", proposalFactory.address);
    await proposalFactory.lodgeProposal(updateProposalConfigProposal.address);
    //fate after lodge
    const fateAfterLodge = (await dao.fateState(owner.address))[1];
    //end lodge

    expect(fateBeforeLodge.sub(fateAfterLodge).toString()).to.equal("446000000000000000000");

    //second person acquires fate and votes on current proposal
    await eye.transfer(secondPerson.address, "1000000000");
    await eye.connect(secondPerson).approve(dao.address, "1000000000");
    await dao.connect(secondPerson).burnAsset(eye.address, "1000000000", false);
    await dao.connect(secondPerson).vote(updateProposalConfigProposal.address, "10000000000");

    //fast forward to after proposal finished
    //3*24*60*60 =259200
    await advanceTime(259200);
    const fateBeforeExecute = (await dao.fateState(owner.address))[1];
    await dao.executeCurrentProposal();
    const fateAfterExecute = (await dao.fateState(owner.address))[1];
    expect(fateAfterExecute.sub(fateBeforeExecute).toString()).to.equal("223000000000000000000");
  });

  it("6. voting no on current proposal makes it unexecutable.", async function () {
    //lodge, parameterize and assert
    const requiredFate = (await dao.proposalConfig())[1];
    const eyeToBurn = requiredFate.mul(2).div(10).add(1);
    await dao.burnAsset(eye.address, eyeToBurn, false);

    //fate before
    const fateBeforeLodge = (await dao.fateState(owner.address))[1];
    await updateProposalConfigProposal.parameterize(100, "123", proposalFactory.address);
    await proposalFactory.lodgeProposal(updateProposalConfigProposal.address);
    //fate after lodge
    const fateAfterLodge = (await dao.fateState(owner.address))[1];
    //end lodge

    expect(fateBeforeLodge.sub(fateAfterLodge).toString()).to.equal("446000000000000000000");

    //second person acquires fate and votes NO on current proposal
    await eye.transfer(secondPerson.address, "1000000000");
    await eye.connect(secondPerson).approve(dao.address, "1000000000");
    await dao.connect(secondPerson).burnAsset(eye.address, "1000000000", false);
    await dao.connect(secondPerson).vote(updateProposalConfigProposal.address, "-10000000000");

    //fast forward to after proposal finished
    //3*24*60*60 =259200
    await advanceTime(259200);
    const fateBeforeExecute = (await dao.fateState(owner.address))[1];
    const configBefore = await dao.proposalConfig();

    await dao.executeCurrentProposal();
    const fateAfterExecute = (await dao.fateState(owner.address))[1];
    await expect(fateBeforeExecute).to.equal(fateBeforeExecute);

    const decisionState = (await dao.previousProposalState())[1];
    expect(decisionState).to.equal(2);
    const configAfter = await dao.proposalConfig();

    expect(configAfter[0].toString()).to.equal(configBefore[0].toString());
  });

  it("7. asset approval proposal can add and remove approved assets", async function () {
    //get enough fate to lodge proposal
    const requiredFate = (await dao.proposalConfig())[1];
    const eyeToBurn = requiredFate.mul(2).div(10).add(1);
    await dao.burnAsset(eye.address, eyeToBurn, false);

    let SetAssetApprovalProposalFactory = await ethers.getContractFactory("SetAssetApprovalProposal");
    let setAssetApprovalProposal = await SetAssetApprovalProposalFactory.deploy(dao.address, "ASSET");

    await setAssetApprovalProposal.parameterize(this.metaSushiEYEULP.address, false, false, 1);

    await toggleWhiteList(setAssetApprovalProposal.address, this.whiteListingProposal);
    await proposalFactory.lodgeProposal(setAssetApprovalProposal.address);

    const currentProposal = (await dao.currentProposalState())[4];
    expect(currentProposal).to.equal(setAssetApprovalProposal.address);

    const assetApprovedBefore = await dao.assetApproved(sushiEYEULP.address);
    expect(assetApprovedBefore).to.be.true;

    //second person acquires fate and votes on current proposal
    await eye.transfer(secondPerson.address, "1000000000");
    await eye.connect(secondPerson).approve(dao.address, "1000000000");
    await dao.connect(secondPerson).burnAsset(eye.address, "1000000000", false);
    await dao.connect(secondPerson).vote(setAssetApprovalProposal.address, "10000000000");

    //fast forward to after proposal finished
    //3*24*60*60 =259200
    await advanceTime(259200);

    await dao.executeCurrentProposal();
    const assetApprovedAfter = await dao.assetApproved(sushiEYEULP.address);
    expect(assetApprovedAfter).to.be.false;
  });

  it("8. vote that flips decision in last hour extends voting for 2 hours", async function () {
    //lodge, parameterize and assert
    const requiredFate = (await dao.proposalConfig())[1];
    const eyeToBurn = requiredFate.mul(2).div(10).add(1);
    await dao.burnAsset(eye.address, eyeToBurn, false);

    //fate before
    const fateBeforeLodge = (await dao.fateState(owner.address))[1];
    await updateProposalConfigProposal.parameterize(100, "123", proposalFactory.address);
    await proposalFactory.lodgeProposal(updateProposalConfigProposal.address);
    //fate after lodge
    const fateAfterLodge = (await dao.fateState(owner.address))[1];
    //end lodge

    expect(fateBeforeLodge.sub(fateAfterLodge).toString()).to.equal("446000000000000000000");

    //second person acquires fate and votes NO on current proposal
    await eye.transfer(secondPerson.address, "1000000000");
    await eye.connect(secondPerson).approve(dao.address, "1000000000");
    await dao.connect(secondPerson).burnAsset(eye.address, "1000000000", false);
    await dao.connect(secondPerson).vote(updateProposalConfigProposal.address, "-100");

    //fast forward to after proposal finished
    //47*60*60+60  =169260
    await advanceTime(169260);

    const timeRemainingBeforeSwingVote = (await dao.timeRemainingOnProposal()).toNumber();
    expect(timeRemainingBeforeSwingVote).to.be.greaterThan(3534);
    expect(timeRemainingBeforeSwingVote).to.be.lessThan(3537);

    await dao.connect(secondPerson).vote(updateProposalConfigProposal.address, "-10"); //same direction shouldn't change duration
    const timeRemainingAfterSameDirectionVote = await dao.timeRemainingOnProposal();
    expect(timeRemainingAfterSameDirectionVote.toString()).to.equal("3535");

    await dao.connect(secondPerson).vote(updateProposalConfigProposal.address, "200");
    const timeRemainingAfterSwingVote = await dao.timeRemainingOnProposal();
    expect(timeRemainingAfterSwingVote.toString()).to.equal("10734");
    await advanceTime(10000);
    await dao.connect(secondPerson).vote(updateProposalConfigProposal.address, "100"); //same direction shouldn't change duration
    const timeRemainingAfterSameDirectionVote2 = await dao.timeRemainingOnProposal();
    expect(timeRemainingAfterSameDirectionVote2.toString()).to.equal("733");

    await advanceTime(733);
    await expect(dao.connect(secondPerson).vote(updateProposalConfigProposal.address, "100")).to.be.revertedWith(
      "LimboDAO: voting for current proposal has ended."
    );
  });

  it("9. killDAO, only callable by owner, transfers ownership to new DAO", async function () {
    this.TransferHelperFactory = await ethers.getContractFactory("NetTransferHelper");
    const daoFactory = await ethers.getContractFactory("LimboDAO", {
      libraries: {
        NetTransferHelper: (await this.TransferHelperFactory.deploy()).address,
      },
    });

    this.newDAO = await daoFactory.deploy();

    const limboDAObefore = await this.limbo.DAO();
    expect(limboDAObefore).to.equal(dao.address);

    const flanDAObefore = await this.flan.DAO();
    expect(flanDAObefore).to.equal(dao.address);

    await expect(dao.connect(secondPerson).killDAO(this.newDAO.address)).to.be.revertedWith(
      "Ownable: caller is not the owner"
    );
    await dao.killDAO(this.newDAO.address);

    const limboDAOafter = await this.limbo.DAO();

    expect(limboDAOafter).to.equal(this.newDAO.address);
    const flanDAOafter = await this.flan.DAO();
    expect(flanDAOafter).to.equal(this.newDAO.address);
  });

  it("10. lisitng unapproved token fails", async function () {
    //get enough fate to lodge proposal
    const requiredFate = (await dao.proposalConfig())[1];
    const eyeToBurn = requiredFate.mul(2).div(10).add(1);
    await dao.burnAsset(eye.address, eyeToBurn, false);

    await expect(this.soulUpdateProposal.parameterize(sushiEYEULP.address, "100", 1, 1, 1, 1)).to.be.revertedWith(
      "MORGOTH: token not approved for listing on Behodler"
    );

    await this.morgothTokenApprover.addToken(sushiEYEULP.address);
    await this.soulUpdateProposal.parameterize(sushiEYEULP.address, "100", 1, 1, 1, 1);
  });

  it("12. trying to convert fate to flan without a rate mints zero flan", async function () {
    await expect(dao.convertFateToFlan(1000)).to.be.revertedWith("LimboDAO: Fate conversion to Flan disabled.");
  });

  it("13. setting fateToFlan to positive number mints flan, depletes fate", async function () {
    const FateToFlanProposal = await ethers.getContractFactory("TurnOnFateMintingProposal");
    const fateToFlanProposal = await FateToFlanProposal.deploy(dao.address, "minting");
    await fateToFlanProposal.parameterize("2000000000000000000");
    const requiredFate = (await dao.proposalConfig())[1];

    await dao.burnAsset(eye.address, requiredFate, false);

    await toggleWhiteList(fateToFlanProposal.address, this.whiteListingProposal);

    await proposalFactory.lodgeProposal(fateToFlanProposal.address);
    const fateAfterLodge = BigInt((await dao.fateState(owner.address))[1].toString());
    const expectedFlan = fateAfterLodge * BigInt(2);

    await eye.transfer(secondPerson.address, "1000000000");
    await eye.connect(secondPerson).approve(dao.address, "1000000000");
    await dao.connect(secondPerson).burnAsset(eye.address, "1000000000", false);
    await dao.connect(secondPerson).vote(fateToFlanProposal.address, "10000");

    await advanceTime(259200);

    await dao.executeCurrentProposal();

    await dao.convertFateToFlan(fateAfterLodge);
    const flanBalance = (await this.flan.balanceOf(owner.address)).toString();

    expect(flanBalance).to.equal(expectedFlan.toString());
  });
});
