import { ethers, waffle } from "hardhat";
import MockTokenArtifact from "../artifacts/contracts/testing/MockToken.sol/MockToken.json";

const { deployContract } = waffle;

async function main() {
  const signers = await ethers.getSigners();
  const owner = signers[0];

  const dai = await deployContract(owner, MockTokenArtifact, ["DAI Stablecoin", "DAI", [], []]);
  console.log("address", dai.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
