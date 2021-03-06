/*
This is an in memory representation of the ropsten deployment script. Each test represents a scenario or "wargame" that can be tested in memory.
Once the wargame is established, it can be used as a script for manually testing the wargame on ropsten. If the result diverges from the unit test, 
we know there's a front end error.
This suite will be a useful area for the community to submit pull requests against when they wish to test certain cryptoeconomic aspects of Limbo before 
issuing a proposal.
This offers a bit more flexibility than forking the existing ropsten state and testing against that because we may wish the local and ropsten states to diverge.
You can't undeploy a contract and adding self destruct code just for testing could introduce vulnerabilities.
*/
const { expect, assert } = require("chai");
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { parseEther } from "ethers/lib/utils";
import { ethers, network } from "hardhat";
import { safeDeploy } from "../../scripts/testnet/orchestrate";
import configureRopsten from "../../scripts/testnet/configureThreshold";
const web3 = require("web3");
interface DeployedContracts {
  [name: string]: string;
}
describe("ropsten deployment", function () {
  let owner: SignerWithAddress, secondPerson: SignerWithAddress;

  let daiEYESLP, linkEYESLP, sushiEYESLP, daiSushiSLP;
  let daiEYEULP, linkEYEULP, sushiEYEULP, daiSushiULP;
  let dao, proposalFactory, updateProposalConfigProposal;
  let toggleWhiteList;
  const zero = "0x0000000000000000000000000000000000000000";
  let addresses: DeployedContracts;
  beforeEach(async function () {
    [owner, secondPerson, proposalFactory] = await ethers.getSigners();
    addresses = (await safeDeploy(1337, false, 2, 6)) as DeployedContracts;
  });
  
  it("illustrate a healthy deployment by having working LP tokens", async function () {
    const eyeDaiAddress = addresses["EYEDAI"];
    const uniswapPairFactory = await ethers.getContractFactory("UniswapV2Pair");
    const eyeDai = await uniswapPairFactory.attach(eyeDaiAddress);
    const totalSupply = await eyeDai.totalSupply();
    console.log(`eyeDai address ${eyeDaiAddress} has ${totalSupply} tokens`);
  });

  it("list a fake token as threshold with positive delta and migrate it successfully to behodler", async function () {
    const Aave = addresses["LimboMigrationToken1"];
    const aave = await (await ethers.getContractFactory("MockToken")).attach(Aave);
    await expect(await aave.totalSupply()).to.be.gt(0);

    //Approve aave on Limbo
    await aave.approve(addresses["limbo"], parseEther("1000000000000000000000000000"));
    await aave.connect(secondPerson).approve(addresses["limbo"], parseEther("1000000000000000000000000000"));
    await aave.transfer(secondPerson.address, parseEther("2000"));

    //attach Limbo
    const LimboFactory = await ethers.getContractFactory("Limbo", {
      libraries: {
        SoulLib: addresses["soulLib"],
        CrossingLib: addresses["crossingLib"],
        MigrationLib: addresses["migrationLib"],
      },
    });
    const limbo = await LimboFactory.attach(addresses["limbo"]);

    //set up soul
    await limbo.configureSoul(aave.address, parseEther("2000"), 1, 1, 0, parseEther("0.0034"));
    await limbo.configureCrossingParameters(
      addresses["LimboMigrationToken1"],
      parseEther("6320000"),
      parseEther("100000"),
      true,
      parseEther("2000")
    );

    //get initial flan balances
    const flan = await (await ethers.getContractFactory("MockToken")).attach(addresses["FLAN"]);
    const user1Flan = await flan.balanceOf(owner.address);
    const user2Flan = await flan.balanceOf(secondPerson.address);
    await expect(user1Flan).to.equal(0);
    await expect(user2Flan).to.equal(0);

    const aaveBalanceOwner = await aave.balanceOf(owner.address);
    const aaveBalanceSecondPerson = await aave.balanceOf(secondPerson.address);

    console.log(`aave balance owner ${aaveBalanceOwner}, aave balance second person ${aaveBalanceSecondPerson}`);
    //stake user 1
    await limbo.stake(aave.address, parseEther("250"));
    //stake user 2.
    await limbo.connect(secondPerson).stake(aave.address, parseEther("1100"));

    //wait 100 seconds
    //await advanceTimeAlternative(100);
    //revert mining style temporarily
    //await network.provider.send("evm_setAutomine", [false]);
    // await network.provider.send("evm_setIntervalMining", [0]);
    console.log("about to pause ");
    await advanceTime(400000);
    console.log("finished pausing");
    //  await network.provider.send("evm_setAutomine", [true]);
    // await network.provider.send("evm_setIntervalMining", [20]);
    await pause(1);
    //unstake some of user 1, assert flan balance
    await limbo.unstake(aave.address, parseEther("100"));
    await pause(5);
    const user1FlanAfter = await flan.balanceOf(owner.address);
    await expect(user1FlanAfter).to.be.gte(parseEther("0.34"));
    await expect(user1Flan).to.be.lt(parseEther("0.38"));
    //increase stake of user 2 until threshold crossed, assert state

    //stake exact amount, no crossover
    await limbo.stake(aave.address, parseEther("750"));
    await pause(5);
    const soulReader = (await ethers.getContractFactory("SoulReader")).attach(addresses["soulReader"]);
    const stats = await soulReader.SoulStats(aave.address, limbo.address);
    console.log(`state: ${stats[0]}, stakedBalance: ${stats[1]}`);
    expect(stats[0].toString()).to.equal("1");
    expect(stats[1].toString()).to.equal(parseEther("2000"));

    //stake 1 and cross over
    await limbo.connect(secondPerson).stake(aave.address, parseEther("1"));
    await pause(10);

    const stats2 = await soulReader.SoulStats(aave.address, limbo.address);
    console.log(`state: ${stats2[0]}, stakedBalance: ${stats2[1]}`);
    expect(stats2[0].toString()).to.equal("2");
    expect(stats2[1].toString()).to.equal(parseEther("2001"));

    //sample oracle at correct intervals -> pre audit fix for simplicity
    //First sample

    const uniswapHelper = (await ethers.getContractFactory("UniswapHelper")).attach(addresses["uniswapHelper"]);
    await uniswapHelper.generateFLNQuote();
    const blockNumberOfFirstSample = parseInt(await network.provider.send("eth_blockNumber"));
    //Second sample 4 blocks later
    let newBlockNumber: number = blockNumberOfFirstSample;
    console.log("block of first sample: " + blockNumberOfFirstSample);
    for (; newBlockNumber - blockNumberOfFirstSample < 4; ) {
      newBlockNumber = parseInt(await network.provider.send("eth_blockNumber"));
      console.log("block :" + newBlockNumber);
      await soulReader.SoulStats(aave.address, limbo.address);
      pause(1);
    }
    await uniswapHelper.generateFLNQuote();
    await pause(10);
    //migrate token to behodler
    const aaveBalanceOnBehodlerBeforeMigrate = await aave.balanceOf(addresses["behodler"]);
    expect(aaveBalanceOnBehodlerBeforeMigrate).to.equal(0);
    await limbo.migrate(aave.address);
    await pause(10);
    const aaveBalanceOnBehodlerBeforeAfter = await aave.balanceOf(addresses["behodler"]);
    await pause(10);
    expect(aaveBalanceOnBehodlerBeforeAfter).to.equal(parseEther("2001"));

    //redeem some of the token from behodler
    const addressBalanceCheckAddress = addresses["addressBalanceCheck"];
    const BehodlerFactory = await ethers.getContractFactory("BehodlerLite", {
      libraries: { AddressBalanceCheck: addressBalanceCheckAddress },
    });

    const behodler = BehodlerFactory.attach(addresses["behodler"]);
    const aaveBalanceBeforeRedeem = await aave.balanceOf(owner.address);
    await pause(2);
    await behodler.withdrawLiquidity(aave.address, parseEther("10"));
    await pause(2);
    const aaveBalanceAfterRedeem = await aave.balanceOf(owner.address);
    expect(aaveBalanceAfterRedeem).to.be.gt(aaveBalanceBeforeRedeem);
  });

  it("transfers Aave from user 1 to user 2", async function () {
    console.log("addresses " + JSON.stringify(addresses, null, 4));
    const aave = await (await ethers.getContractFactory("MockToken")).attach(addresses["LimboMigrationToken1"]);

    const ownerBalanceBefore = (await aave.balanceOf(owner.address)).toString();
    await aave.approve(owner.address, parseEther("2000"));
    await aave.transferFrom(owner.address, secondPerson.address, parseEther("1000"));
    await pause(1);
    const ownerBalanceAfter = (await aave.balanceOf(owner.address)).toString();
    console.log("owner balance before " + ownerBalanceBefore + " owner balance after " + ownerBalanceAfter);
    await expect(await aave.balanceOf(owner.address)).to.equal(parseEther("9000"));
    await expect(await aave.balanceOf(secondPerson.address)).to.equal(parseEther("1000"));
  });

  it("Tests soul reader", async function () {
    await configureRopsten(2, 6, addresses);

    //first call with traditional route.
    const soulReader = (await ethers.getContractFactory("SoulReader")).attach(addresses["soulReader"]);
    const output = await soulReader.ExpectedCrossingBonusRate(
      owner.address,
      addresses["LimboMigrationToken4"],
      addresses["limbo"]
    );

  });

  const advanceTime = async (seconds: number) => {
    await network.provider.send("evm_increaseTime", [seconds]);
    await network.provider.send("evm_mine");
  };

  const advanceTimeAlternative = async (seconds: number) => {
    await network.provider.send("evm_mine");
  };
});

function pause(duration: number) {
  console.log("pausing for  " + duration + " seconds");
  return new Promise(function (resolve, error) {
    setTimeout(() => {
      return resolve(duration);
    }, duration * 1000);
  });
}
