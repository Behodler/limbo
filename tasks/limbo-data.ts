import { task } from "hardhat/config";
import { Limbo__factory } from "../typechain";
import * as Addresses from "../addresses.json";

task("limbo", "Limbo Data").setAction(async (args, hre) => {
  const signer = (await hre.ethers.getSigners())[0];
  const limbo = Limbo__factory.connect(Addresses.Limbo, signer);

  const aaveIndex = await limbo.latestIndex(Addresses.Aave)
  console.log("aaveIndex", aaveIndex.toString())
  const data = await limbo.souls(Addresses.Aave, aaveIndex)
  console.log("data", data)
});
