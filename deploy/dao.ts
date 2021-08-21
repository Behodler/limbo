import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import MockTokenArtifact from "../artifacts/contracts/testing/MockToken.sol/MockToken.json";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  const transferHelper = await deploy("TransferHelper", {
    from: deployer,
    log: true,
  });

  const limboDAO = await deploy("LimboDAO", {
    from: deployer,
    log: true,
    libraries: {
      TransferHelper: transferHelper.address,
    },
  });

  await deploy("FlashGovernanceArbiter", {
    from: deployer,
    args: [limboDAO.address],
    log: true,
  });

  const whitelistingProposal = await deploy("ToggleWhitelistProposalProposal", {
    from: deployer,
    args: [limboDAO.address, "Toggle Whitelist"],
    log: true,
  });

  await deploy("ProposalFactory", {
    from: deployer,
    args: [limboDAO.address, whitelistingProposal.address],
    log: true,
  });
};

export default func;
func.tags = ["DAO"];
