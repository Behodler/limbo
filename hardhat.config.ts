import { task } from "hardhat/config";
import "@typechain/hardhat";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "hardhat-deploy";
import "./tasks/index";
import "hardhat-gas-reporter"
import * as testmnemonic from "./private/testmnemonic.json";
import * as mnemonic from './private/mnemonic.json'
import "hardhat-abi-exporter"

task("accounts", "Prints the list of accounts", async (_, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

export default {
  solidity:
  {
    compilers: [
      {
        version: "0.8.16"
      },
      {
        version: "0.7.1"
      }
    ]
  },
  gasReporter: {
    optimizer: true,
    outputFile: "gasReport.txt",
    disabled: true
  },

  abiExporter: {
    path: './ABIs',
    runOnCompile: true,
    clear: true,
    flat: true,
    spacing: 2,
    pretty: false,
    format: "json"
  },
  networks: {

    hardhat: {
      allowUnlimitedContractSize: false,
      chainId: 1337,
      accounts: {
        mnemonic: testmnemonic.phrase,
      },
      settings: {
        optimizer: {
          enabled: true,
          runs: 200,
        },
      },
      mining: {
        auto: false,
        interval: 2,
      },
    },
    ropsten: {
      url: `https://nd-564-762-624.p2pify.com/41adb4b5065ff74a971a8bf5e85947c7`,
      chainId: 3,
      accounts: {
        mnemonic: testmnemonic.phrase,
      },
      from: testmnemonic.primary,
      gasMultiplier: 6,
      settings: {
        optimizer: {
          enabled: true,
          runs: 200,
        },
      },

      // maxFeePerGas: "0x17D78400",
      // maxPriorityFeePerGas: "0x17D78400",
    },
    sepolia: {
      url: `http://localhost:8545`,
      chainId: 11155111,
      accounts: {
        mnemonic: testmnemonic.phrase
      },
      from: testmnemonic.primary,
      gasMultiplier: 2,
      settings: {
        optimizer: {
          enabled: true,
          runs: 200
        }
      }
    },
    mainnet: {
      url: `http://localhost:8545`,
      chainId: 1,
      accounts: {
        mnemonic: mnemonic.phrase
      },
      from: mnemonic.deployer,
      gasMultiplier: 1.25,
      settings: {
        optimizer: {
          enabled: true,
          runs: 200
        }
      }
    }
  },
  namedAccounts: {
    deployer: 0,
  },
  mocha: {
    timeout: 3000000,
  },
};
