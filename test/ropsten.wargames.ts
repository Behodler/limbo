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
const { ethers, network } = require("hardhat");
import { deployTestnet } from "../scripts/testnet/orchestrate";
const web3 = require("web3");
interface DeployedContracts {
  [name: string]: string;
}
describe("ropsten deployment", function () {
  let owner, secondPerson, feeSetter, dai, eye, link, sushi;
  let daiEYESLP, linkEYESLP, sushiEYESLP, daiSushiSLP;
  let daiEYEULP, linkEYEULP, sushiEYEULP, daiSushiULP;
  let dao, proposalFactory, updateProposalConfigProposal;
  let toggleWhiteList;
  const zero = "0x0000000000000000000000000000000000000000";
  let addresses: DeployedContracts;
  before(async function () {
    [owner, secondPerson, proposalFactory] = await ethers.getSigners();
    addresses = (await deployTestnet(1337, false, 10)) as DeployedContracts;
    const Token = await ethers.getContractFactory("MockToken");

    //TODO:create 4 fake tokens
  });

  it("illustrate a healthy deployment by having working LP tokens", async function () {
    const eyeDaiAddress = addresses["EYEDAI"];
    const uniswapPairFactory = await ethers.getContractFactory("RealUniswapV2Pair");
    const eyeDai = await uniswapPairFactory.attach(eyeDaiAddress);
    const totalSupply = await eyeDai.totalSupply();
    console.log(`eyeDai address ${eyeDaiAddress} has ${totalSupply} tokens`);
  });

  it("list a fake token as threshold and migrate it successfully to behodler", async function (){

  })
});
