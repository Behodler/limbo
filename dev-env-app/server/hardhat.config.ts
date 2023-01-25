import "@nomiclabs/hardhat-ethers";

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
  networks: {
    hardhat: {
      allowUnlimitedContractSize: false,
      chainId: 1337,
      accounts: {
        mnemonic: "eight fun oak spot hip pencil matter domain bright fiscal nurse easy",
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
  },
};
