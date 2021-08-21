import { task } from "hardhat/config";
import { UniswapHelper__factory } from "../typechain";
import { contracts as DeployedContracts } from "../deployed.json";

task("generate-quote", "Advance some blocks").setAction(async (args, hre) => {
  const signer = (await hre.ethers.getSigners())[0];
  const uniswapHelper = UniswapHelper__factory.connect(DeployedContracts.UniswapHelper.address, signer);
  await uniswapHelper.generateFLNQuote();
});
