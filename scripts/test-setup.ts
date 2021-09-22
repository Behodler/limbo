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
  UniswapHelper__factory,
} from "../typechain";
import Addresses from "../addresses.json";

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

  // Whitelist proposal
  const deployedWhiteListingProposal = await deploy("ToggleWhitelistProposalProposal", {
    from: deployer.address,
    args: [Addresses.LimboDAO, "Toggle Whitelist"],
    log: true,
  });

  // morgoth
  const morgothTokenApprover = await deploy("MockMorgothTokenApprover", {
    from: deployer.address,
    log: true,
  });

  // Update Soul Config proposal
  const deployedUpdateSoulConfigProposal = await deploy("UpdateSoulConfigProposal", {
    from: deployer.address,
    args: [Addresses.LimboDAO, "Update Soul Config", Addresses.Limbo, morgothTokenApprover.address],
    log: true,
  });

  const deployedProposalFactory = await deploy("ProposalFactory", {
    from: deployer.address,
    args: [
      DeployedContracts.LimboDAO.address,
      deployedWhiteListingProposal.address,
      deployedUpdateSoulConfigProposal.address,
    ],
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
    105,
    3,
    20,
    0
  );
  uniswapHelper.setDAI(dai.address);

  await flashGovernanceArbiter.configureSecurityParameters(10, 10, 30);
  await flashGovernanceArbiter.configureFlashGovernance(eye.address, parseEther("10").toHexString(), 10, true);

  await limbo.configureSoul(aave.address, parseEther("100").toHexString(), 1, 1, 0, parseEther("0.01").toHexString());
  await limbo.configureCrossingParameters(aave.address, 1, 1, true, parseEther("100").toHexString());
  await limbo.configureCrossingConfig(
    mockBehodler.address,
    mockAngband.address,
    uniswapHelper.address,
    mockAddTokenPower.address,
    parseEther("1000").toHexString(),
    10000, // 10000 seconds
    100
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
