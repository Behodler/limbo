// import { task } from "hardhat/config";
// import { FlashGovernanceArbiter__factory, Limbo__factory, UniswapHelper__factory } from "../typechain";
// import * as Addresses from "../addresses.json";

// task("end-config", "End configuration").setAction(async (args, hre) => {
//   const signer = (await hre.ethers.getSigners())[0];
//   const fga = FlashGovernanceArbiter__factory.connect(Addresses.FlashGovernanceArbiter, signer);
//   const limbo = Limbo__factory.connect(Addresses.Limbo, signer);
//   await fga.endConfiguration();
//   await limbo.endConfiguration();
// });
