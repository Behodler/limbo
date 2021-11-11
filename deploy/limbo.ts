import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, get } = deployments;

  const { deployer } = await getNamedAccounts();

<<<<<<< HEAD
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

=======
  const flan = await get("Flan")
  const limboDAO = await get("LimboDAO")
  
>>>>>>> d284d394dd0562f12112b384fe409b93d83484e5
  const limbo = await deploy("Limbo", {
    from: deployer,
    args: [flan.address, limboDAO.address],
    log: true,
<<<<<<< HEAD
    libraries: {
      SoulLib: soulLib.address,
      CrossingLib: crossingLib.address,
      MigrationLib: migrationLib.address,
    }
=======
>>>>>>> d284d394dd0562f12112b384fe409b93d83484e5
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
<<<<<<< HEAD
func.dependencies = ["Flan", "DAO"];
=======
func.dependencies = ["Flan", "DAO"]
>>>>>>> d284d394dd0562f12112b384fe409b93d83484e5
