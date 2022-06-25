import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

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
      SafeERC20: transferHelper.address,
    },
  });

  await deploy("FlashGovernanceArbiter", {
    from: deployer,
    args: [limboDAO.address],
    log: true,
  });
};

export default func;
func.tags = ["DAO"];
