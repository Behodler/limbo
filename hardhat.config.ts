import { task } from "hardhat/config";
import "@typechain/hardhat";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "hardhat-deploy";
import "./tasks/index";
import * as mnemonic from "./private/testmnemonic.json";

task("accounts", "Prints the list of accounts", async (_, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

export default {
  solidity: "0.8.4",
  networks: {
    hardhat: {
      chainId: 1337,
      accounts: {
        mnemonic: "eight fun oak spot hip pencil matter domain bright fiscal nurse easy",
      },
      //comment out mining block for non wargame tests
      mining: {
        auto: false,
        interval: 2,
      },
    },
    ropsten: {
      url: `https://nd-564-762-624.p2pify.com/41adb4b5065ff74a971a8bf5e85947c7`,
      chainId: 3,
      accounts: {
        mnemonic: mnemonic.phrase,
      },
      from: mnemonic.primary,
      gasMultiplier: 6,
      // maxFeePerGas: "0x17D78400",
      // maxPriorityFeePerGas: "0x17D78400",
    },
  },
  namedAccounts: {
    deployer: 0,
  },
  mocha: {
    timeout: 3000000,
  },
};
