import { ethers } from "hardhat";

async function main() {
  const { chainId } = await ethers.provider.getNetwork();
  console.log("chainId", chainId);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
