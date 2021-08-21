import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, get } = deployments;

  const { deployer } = await getNamedAccounts();

  const limboDAO = await get("LimboDAO");

  await deploy("Flan", {
    from: deployer,
    args: [limboDAO.address],
    log: true,
  });
};

export default func;
func.tags = ["Flan", "DAO"];
