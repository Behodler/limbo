import { task } from "hardhat/config";
import "@typechain/hardhat";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "hardhat-deploy";
import "./tasks/index";

const mnemonic = "eight fun oak spot hip pencil matter domain bright fiscal nurse easy";

task('accounts', 'Prints the list of accounts', async (_, hre) => {
  const accounts = await hre.ethers.getSigners()

  for (const account of accounts) {
      console.log(account.address)
  }

  const wallet = hre.ethers.Wallet.fromMnemonic(mnemonic)
  console.log(wallet.privateKey)
})


export default {
  solidity: "0.8.0",
  networks: {
    hardhat: {
      chainId: 1337,
      accounts: {
        mnemonic,
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
