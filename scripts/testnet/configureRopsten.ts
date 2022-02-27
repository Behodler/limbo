/*
1. Create tokens that are not listed on behodler -DONE
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
  const pauseUntilNextBlock = pauseUntilNextBlockFactory();

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
  //load tokens
  const { KNC, Mana, REP, rDAI, ZRX } = addresses.unlistedTokens;

  //configure tokens for migration

  await broadcast("configure Soul", limbo.configureSoul(KNC, parseEther("3000"), 1, 1, 0, parseEther("0.00001289")));
  const configured = await limbo.configured();
  console.log("limbo configured: " + configured);

  const messageObject = {
    token: KNC,
    initialCrossing: parseEther("100000000000").toString(),
    delta: parseEther("10000000").toString(),
    burnable: true,
    threshold: parseEther("3000").toString(),
  };
  console.log("parameters");
  console.log(messageObject);
  await broadcast(
    "configure crossing parameters",
    limbo.configureCrossingParameters(
      KNC,
      parseEther("100000000000"),
      parseEther("10000000"),
      true,
      parseEther("3000")
    )
  );
  //onfigure existing behodler tokens for perpetual

  //load souls to confirm configuration success
  const soulReaderFactory = await ethers.getContractFactory("SoulReader");
  const soulReader = await soulReaderFactory.attach(addresses.deploySoulReader.soulReader);

  const crossingParamsOfKNC = await soulReader.CrossingParameters(KNC, limbo.address);
  console.log(`crossingParamsOfKNC: ${crossingParamsOfKNC}`);
}

function pauseUntilNextBlockFactory() {
  let provider = ethers.getDefaultProvider("ropsten");
  const duration = 5000;
  return async function () {
    const initialBlock = await provider.getBlockNumber();
    let currentBlock = await provider.getBlockNumber();
    while (currentBlock === initialBlock) {
      console.log(`current block number: ${currentBlock}. Pausing for ${duration / 1000} seconds`);
      await pause(duration);
      currentBlock = await provider.getBlockNumber();
    }
  };
}

async function broadcast(name: string, transaction: Promise<any>) {
  const pauseUntilNextBlock = pauseUntilNextBlockFactory();
  console.log("*****************executing " + name + "*****************");
  await transaction;
  await pauseUntilNextBlock();
}

function pause(duration: number) {
  return new Promise(function (resolve, error) {
    setTimeout(() => {
      return resolve(duration);
    }, duration);
  });
}

const ethers = hre.ethers;
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
