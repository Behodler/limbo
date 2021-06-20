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

    const addTokenPowerFactory = await ethers.getContractFactory("MockAddTokenPower")
    const addTokenPower = await addTokenPowerFactory.deploy()
  });

  it("old souls can be claimed from", async function () {

  });

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
  it("flash governance max tolerance respected", async function (){})
});
