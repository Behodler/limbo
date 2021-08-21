import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import MockTokenArtifact from "../artifacts/contracts/testing/MockToken.sol/MockToken.json";
import UniswapFactoryArtifact from "../artifacts/contracts/testing/UniswapFactory.sol/UniswapFactory.json";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  await deploy("MockAngband", {
    from: deployer,
    log: true,
  });

  const addTokenPower = await deploy("MockAddTokenPower", {
    from: deployer,
    log: true,
  });

  await deploy("MockBehodler", {
    from: deployer,
    args: ["Scarcity", "SCX", addTokenPower.address],
    log: true,
  });

  await deploy("Dai", {
    from: deployer,
    contract: MockTokenArtifact,
    args: ["Dai Stablecoin", "DAI", [], []],
    log: true,
  });

  await deploy("Aave", {
    from: deployer,
    contract: MockTokenArtifact,
    args: ["Aave", "AAVE", [], []],
    log: true,
  });

  await deploy("Eye", {
    from: deployer,
    contract: MockTokenArtifact,
    args: ["Behodler Eye", "EYE", [], []],
    log: true,
  });

  await deploy("UniswapFactory", {
    from: deployer,
    contract: UniswapFactoryArtifact,
    log: true,
  });

  await deploy("SushiswapFactory", {
    from: deployer,
    contract: UniswapFactoryArtifact,
    log: true,
  });

  await deploy("MockMigrationUniPair", {
    from: deployer,
    args: ["scx", "flan"],
    log: true,
  });
};

export default func;
func.tags = ["Mock"];
