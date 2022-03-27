import { parseEther } from "ethers/lib/utils";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { BigNumber, Contract, ContractFactory } from "ethers";
import { fstat, write, writeFileSync, existsSync, readFileSync } from "fs";
import * as deployments from "./deploymentFunctions";
import { OutputAddress, logFactory, deploy, getTXCount, getNonce, broadcast, getPauser, nameNetwork } from "./common";
const hre = require("hardhat");

const nullAddress = "0x0000000000000000000000000000000000000000";
const logger = logFactory(false);
export default async function (blockTime: number, confirmations: number, addresses: any) {

  logger("addresses: " + JSON.stringify(addresses, null, 2));
  const [deployer] = await ethers.getSigners();
  const chainId = (await deployer.provider?.getNetwork())?.chainId;
  const networkName = nameNetwork(chainId);
  const pauser = await getPauser(blockTime, networkName, confirmations);
  //validate chain
  if (!chainId) throw "unknown chain";

  //load limbo deployment:

  const LimboFactory = await ethers.getContractFactory("Limbo", {
    libraries: {
      SoulLib: addresses.soulLib,
      CrossingLib: addresses.crossingLib,
      MigrationLib: addresses.migrationLib,
    },
  });
  const limbo = await LimboFactory.attach(addresses.limbo);
  //load tokens
  const {
    LimboMigrationToken1,
    LimboMigrationToken2,
    LimboMigrationToken3,
    LimboMigrationToken4,
    LimboMigrationToken5,
  } = addresses;
  const tokens = [
    LimboMigrationToken1,
    LimboMigrationToken2,
    LimboMigrationToken3,
    LimboMigrationToken4,
    LimboMigrationToken5,
  ];

  logger("TOKENS: " + JSON.stringify(tokens, null, 2));
  
  const soulReaderFactory = await ethers.getContractFactory("SoulReader");
  const soulReader = await soulReaderFactory.attach(addresses.soulReader);

  //configure tokens for migration
  for (let i = 0; i < tokens.length; i++) {
    let currentToken = tokens[i];
    const threshold = `${i * 2000 + 500}`;
    const fps = (Math.random() * 0.00001).toString().substring(0, 10);
    await broadcast(
      "configure Soul",
      limbo.configureSoul(currentToken, parseEther(threshold), 1, 1, 0, parseEther(fps), getNonce()),
      pauser
    );
    const configured = await limbo.configured();
    await pauser();
    logger("limbo configured: " + configured);

    const messageObject = {
      token: currentToken,
      initialCrossing: parseEther("100000000000").toString(),
      delta: parseEther("10000000").toString(),
      burnable: true,
      threshold: parseEther("3000").toString(),
    };
    logger("parameters");
    logger(messageObject);

    const initialCossingBonus = i * 100000000000 + 30000000;
    const delta = i * 10000000 + 6060000;
    await broadcast(
      "configure crossing parameters",
      limbo.configureCrossingParameters(
        currentToken,
        parseEther(initialCossingBonus.toString()),
        parseEther(delta.toString()),
        true,
        parseEther(threshold),
        getNonce()
      ),
      pauser
    );
    //configure existing behodler tokens for perpetual

    //load souls to confirm configuration success

    const crossingParams = await soulReader.CrossingParameters(currentToken, limbo.address);
    logger(`crossingParams: ${crossingParams}`);
  }
}
const ethers = hre.ethers;
