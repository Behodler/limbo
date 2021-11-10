import { task } from "hardhat/config";
import { Limbo__factory } from "../typechain";
import { getAddresses } from "../utils/addresses";

task("limbo", "Limbo Data").setAction(async (args, hre) => {
  const addresses = getAddresses();
  const signer = (await hre.ethers.getSigners())[0];
  const limbo = Limbo__factory.connect(addresses.Limbo, signer);

  const aaveIndex = await limbo.latestIndex(addresses.Aave);
  console.log("aaveIndex", aaveIndex.toString());
  const data = await limbo.souls(addresses.Aave, aaveIndex);
  console.log("data", data);
});
