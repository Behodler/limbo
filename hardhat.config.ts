import { task } from "hardhat/config";
import "@typechain/hardhat";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "hardhat-deploy";
import "./tasks/index";

export default {
  solidity: "0.8.4",
  networks: {
    hardhat: {
      chainId: 1337,
      accounts: {
        mnemonic: "eight fun oak spot hip pencil matter domain bright fiscal nurse easy",
      },
    },
  },
  namedAccounts: {
    deployer: 0,
  },
  mocha: {
    timeout: 50000,
  },
};
