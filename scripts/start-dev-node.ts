import hre from "hardhat";
import '@nomiclabs/hardhat-ethers'
import { safeDeploy } from "./networks/orchestrate";

async function main() {
  const node = hre.run("node", { noDeploy: true });
  const { chainId } = await hre.ethers.provider.getNetwork();
  await safeDeploy(chainId, 2, 9);
  await node;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
