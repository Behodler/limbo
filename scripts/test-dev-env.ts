import hre, { ethers } from "hardhat";
import '@nomiclabs/hardhat-ethers'

async function main() {
  const [owner] = await ethers.getSigners();
  const ownerETHBalance = ethers.utils.formatEther(await owner.getBalance(owner.address));

  console.log("ownerETHBalance", ownerETHBalance);

  await owner.sendTransaction({
    to: "0x6c92e5c65e314e209dAe6a23233180d0dB273B27",
    value: ethers.utils.parseEther('1'),
  });

  console.log("ownerETHBalance after tx", ownerETHBalance);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
