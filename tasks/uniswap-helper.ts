import { task } from "hardhat/config";
import { UniswapHelper__factory } from "../typechain";
import * as DeployedContracts from "../addresses.json";
import { formatBigNumberObj } from "../utils/log";

task("generate-quote", "Generate Flan Quotes").setAction(async (_, hre) => {
  const signer = (await hre.ethers.getSigners())[0];
  const uniswapHelper = UniswapHelper__factory.connect(DeployedContracts.UniswapHelper, signer);
  await uniswapHelper.generateFLNQuote();
});

task("quote-flan", "Get Flan quotes").setAction(async (_, hre) => {
  const signer = (await hre.ethers.getSigners())[0];
  const uniswapHelper = UniswapHelper__factory.connect(DeployedContracts.UniswapHelper, signer);
  const flanQuotes = await Promise.all([uniswapHelper.latestFlanQuotes(0), uniswapHelper.latestFlanQuotes(1)]);
  console.log(formatBigNumberObj(flanQuotes[0]));
  console.log(formatBigNumberObj(flanQuotes[1]));
});
