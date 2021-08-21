import { parseEther } from "ethers/lib/utils";
import { ethers, deployments } from "hardhat";
import { contracts as DeployedContracts } from "../deployed.json";
import {
  Flan__factory,
  FlashGovernanceArbiter__factory,
  LimboDAO__factory,
  Limbo__factory,
  MockAddTokenPower__factory,
  MockAngband__factory,
  MockBehodler__factory,
  MockMigrationUniPair__factory,
  MockToken__factory,
  ProposalFactory__factory,
  RealUniswapV2Factory__factory,
  ToggleWhitelistProposalProposal__factory,
  UniswapHelper__factory,
} from "../typechain";

async function main() {
  const { deploy } = deployments;
  const deployer = (await ethers.getSigners())[0];

  // connect contracts
  const dai = MockToken__factory.connect(DeployedContracts.Dai.address, deployer);
  const aave = MockToken__factory.connect(DeployedContracts.Aave.address, deployer);
  const eye = MockToken__factory.connect(DeployedContracts.Eye.address, deployer);
  const mockBehodler = MockBehodler__factory.connect(DeployedContracts.MockBehodler.address, deployer);
  const limboDAO = LimboDAO__factory.connect(DeployedContracts.LimboDAO.address, deployer);
  const flashGovernanceArbiter = FlashGovernanceArbiter__factory.connect(
    DeployedContracts.FlashGovernanceArbiter.address,
    deployer
  );
  const limbo = Limbo__factory.connect(DeployedContracts.Limbo.address, deployer);
  const flan = Flan__factory.connect(DeployedContracts.Flan.address, deployer);
  const uniswapHelper = UniswapHelper__factory.connect(DeployedContracts.UniswapHelper.address, deployer);
  const mockAngband = MockAngband__factory.connect(DeployedContracts.MockAngband.address, deployer);
  const mockAddTokenPower = MockAddTokenPower__factory.connect(DeployedContracts.MockAddTokenPower.address, deployer);
  const uniswapFactory = RealUniswapV2Factory__factory.connect(DeployedContracts.UniswapFactory.address, deployer);
  const sushiswapFactory = RealUniswapV2Factory__factory.connect(DeployedContracts.SushiswapFactory.address, deployer);
  const mockMigrationUnipair = MockMigrationUniPair__factory.connect(
    DeployedContracts.MockMigrationUniPair.address,
    deployer
  );

  await dai.mint(parseEther("100000").toHexString());
  await aave.mint(parseEther("100000").toHexString());
  await eye.mint(parseEther("100000").toHexString());

  await dai.transfer(mockBehodler.address, "600000000");

  await flan.whiteListMinting(limbo.address, true);
  await flan.whiteListMinting(deployer.address, true);
  await flan.whiteListMinting(uniswapHelper.address, true);

  await mockAddTokenPower.seed(mockBehodler.address, limbo.address);

  // White lits proposal
  const deployedWhiteListingProposal = await deploy("ToggleWhitelistProposalProposal", {
    from: deployer.address,
    args: ["0x8c9bd714e2598860E56a4D9E675E717665204442", "Toggle Whitelist"],
    log: true,
  });
  const whiteListingProposal = ToggleWhitelistProposalProposal__factory.connect(
    deployedWhiteListingProposal.address,
    deployer
  );

  const deployedProposalFactory = await deploy("ProposalFactory", {
    from: deployer.address,
    args: [DeployedContracts.LimboDAO.address, whiteListingProposal.address],
    log: true,
  });
  const proposalFactory = ProposalFactory__factory.connect(deployedProposalFactory.address, deployer);

  await limboDAO.seed(
    limbo.address,
    flan.address,
    eye.address,
    proposalFactory.address,
    sushiswapFactory.address,
    uniswapFactory.address,
    flashGovernanceArbiter.address,
    9,
    [],
    []
  );
  await limboDAO.makeLive();

  await limbo.setDAO(limboDAO.address);

  mockMigrationUnipair.setReserves(1000, 3000);

  uniswapHelper.configure(
    limbo.address,
    mockMigrationUnipair.address,
    mockBehodler.address,
    flan.address,
    10,
    3,
    3,
    20,
    0
  );
  uniswapHelper.setDAI(dai.address);

  await flashGovernanceArbiter.configureFlashGovernance(eye.address, parseEther("10").toHexString(), 10, true);
  flashGovernanceArbiter.endConfiguration();

  await limbo.configureSoul(aave.address, parseEther("1").toHexString(), 1, 0, 1, 0, parseEther("0.01").toHexString());
  await limbo.configureCrossingParameters(aave.address, 1, 1, true, 10000010);
  await limbo.configureCrossingConfig(
    mockBehodler.address,
    mockAngband.address,
    uniswapHelper.address,
    mockAddTokenPower.address,
    10000000,
    10000,
    100
  );
  await limbo.endConfiguration()

  // toggleWhiteList = toggleWhiteListFactory(eye, limboDAO, whiteListingProposal, proposalFactory);
}

// const toggleWhiteListFactory = (
//   eye: MockToken,
//   dao: LimboDAO,
//   whiteListingProposal: ToggleWhitelistProposalProposal,
//   proposalFactory: ProposalFactory
// ) => {
//   return async function (contractToToggle: any) {
//     await whiteListingProposal.parameterize(
//       proposalFactory.address,
//       contractToToggle
//     );
//     const requiredFateToLodge = (await dao.proposalConfig())[1];

//     await eye.mint(requiredFateToLodge);
//     await eye.approve(dao.address, requiredFateToLodge.mul(2));
//     await dao.burnAsset(eye.address, requiredFateToLodge.div(5).add(10));

//     await proposalFactory.lodgeProposal(whiteListingProposal.address);
//     await dao.vote(whiteListingProposal.address, "100");
//     await advanceTime(100000000);
//     await dao.executeCurrentProposal();
//   };
// };

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
