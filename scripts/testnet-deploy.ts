import { ethers, network } from "hardhat";
import { safeDeploy } from "./testnet/orchestrate";
type address = string;
const nullAddress = "0x0000000000000000000000000000000000000000";

async function main() {
  const [deployer] = await ethers.getSigners();

  const chainId = (await deployer.provider?.getNetwork())?.chainId;
  const txCount = await network.provider.send("eth_getTransactionCount", [deployer.address, "latest"]);
  await safeDeploy(chainId, true, 30000, 6);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
