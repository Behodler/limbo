/*
1. Create tokens that are not listed on behodler -DONE
2.  
await limbo.configureSoul(aave.address, parseEther("100").toHexString(), 1, 1, 0, parseEther("0.001").toHexString());
  await limbo.configureCrossingParameters(aave.address, typicalInitialBonus, typicalCrossingDelta, true, parseEther("100").toHexString());
  await limbo.configureCrossingConfig(
    mockBehodler.address,
    mockAngband.address,
    uniswapHelper.address,
    mockAddTokenPower.address,
    parseEther("1000").toHexString(),
    1000, // 1000 seconds
    100
  );


  await limbo.configureSoul(dai.address, parseEther("100").toHexString(), 1, 1, 0, parseEther("0.02").toHexString());
  await limbo.configureCrossingParameters(dai.address, 2000000000, typicalCrossingDelta, true, parseEther("100").toHexString());
  await limbo.configureCrossingConfig(
    mockBehodler.address,
    mockAngband.address,
    uniswapHelper.address,
    mockAddTokenPower.address,
    parseEther("1000").toHexString(),
    1000, // 1000 seconds
    100
  );

    configure soul: 
        tokenAddress,
        crossingThreshold
        soulType (1 = Migration, 2 = perpetual),
        state (calibration, staking, waitingToCross,crossedOver),
        index,
        fps

    configure crossing parameters:
       token,
       initialCrossingBonus (uint)
       crossingBonusDelta (int)
       burnable,
       threshold

     configure crossing config:
        behodler,
        angband,
        ammHelper,
        morgothPower,
        migrationInvocationReward (flan),
        crossingMigrationDelay,
        rectInflationFactor,0 - 10000, 100 is unchanged
*/
import { parseEther } from "ethers/lib/utils";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { BigNumber, Contract, ContractFactory } from "ethers";
import { fstat, write, writeFileSync, existsSync, readFileSync } from "fs";
import * as deployments from "./deploymentFunctions";
import { OutputAddress, AddressFileStructure } from "./common";
const hre = require("hardhat");
import * as addresses from "./addresses/ropsten.json";

const nullAddress = "0x0000000000000000000000000000000000000000";

async function main() {
  const [deployer] = await ethers.getSigners();
  const chainId = (await deployer.provider?.getNetwork())?.chainId;

  //validate chain
  if (!chainId) throw "unknown chain";
  if (chainId !== 3) throw "Run this script on ropsten only";

  //load limbo deployment:

  const LimboFactory = await ethers.getContractFactory("Limbo", {
    libraries: {
      SoulLib: addresses.deployLimbo.soulLib,
      CrossingLib: addresses.deployLimbo.crossingLib,
      MigrationLib: addresses.deployLimbo.migrationLib,
    },
  });
  const limbo = await LimboFactory.attach(addresses.deployLimbo.limbo);

  const crossingConfig = await limbo.crossingConfig();

  console.log("test data " + JSON.stringify(crossingConfig, null, 4));
}

const ethers = hre.ethers;
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
