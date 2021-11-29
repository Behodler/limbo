import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, get } = deployments;

  const { deployer } = await getNamedAccounts();

  const flan = await get("Flan");
  const limboDAO = await get("LimboDAO");

  const soulLib = await deploy("SoulLib", {
    from: deployer,
    log: true
  })
  const crossingLib = await deploy("CrossingLib", {
    from: deployer,
    log: true
  })
  const migrationLib = await deploy("MigrationLib", {
    from: deployer,
    log: true
  })

  const limbo = await deploy("Limbo", {
    from: deployer,
    args: [flan.address, limboDAO.address],
    log: true,
    libraries: {
      SoulLib: soulLib.address,
      CrossingLib: crossingLib.address,
      MigrationLib: migrationLib.address,
    }
  });

  await deploy("UniswapHelper", {
    from: deployer,
    args: [limbo.address, limboDAO.address],
    log: true,
  });

  await deploy("SoulReader", {
    from: deployer,
    args: [limboDAO.address],
    log: true,
  });
};

export default func;
func.tags = ["Limbo"];
func.dependencies = ["Flan", "DAO"];
