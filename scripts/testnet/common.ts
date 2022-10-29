import { ethers, network } from "hardhat";
import { parseEther } from "ethers/lib/utils";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { BigNumber, Contract, ContractFactory } from "ethers";

type address = string;

export const OutputAddressAdder = <T extends Contract>(store: OutputAddress, name: string, contract: T) => {
  store[name] = contract.address
  return store
}

export interface OutputAddress {
  [key: string]: address;
}

export interface AddressFileStructure {
  [key: string]: OutputAddress;
}

export function logFactory(visible: boolean) {
  return function (message: any) {
    if (visible) console.log(message);
  };
}

const logger = logFactory(true);

export async function getNonce() {
  const [deployer] = await ethers.getSigners();
  const latestNonce = await getTXCount(deployer);
  logger("using nonce: " + latestNonce);
  return { nonce: latestNonce, gasLimit: 9000000 };
}

export async function getTXCount(deployer: SignerWithAddress) {
  return await network.provider.send("eth_getTransactionCount", [deployer.address, "latest"]);
}
function pauserFactory(duration: number, network: string, confirmations: number) {
  const networkToUse = network == "hardhat" ? "localhost" : network;
  let provider = ethers.provider; //ethers.getDefaultProvider(networkToUse);

  return async function () {
    const initialBlock = await provider.getBlockNumber();

    let currentBlock = await provider.getBlockNumber();

    while (currentBlock - initialBlock < confirmations) {
      logger(`current block ${currentBlock}, initial block ${initialBlock}`);
      const remaining = confirmations - (currentBlock - initialBlock);
      logger(`${remaining} blocks remaining. Pausing for ${duration / 1000} seconds`);
      logger("                                                       ");
      await pause(duration);
      const current = await provider.getBlockNumber();
      logger("new current block " + current);
      currentBlock = current;
    }
  };
}

export function getPauser(blockTime: number, network: string, confirmations: number) {
  return pauserFactory(blockTime, network, confirmations);
}

function pause(duration: number) {
  return new Promise(function (resolve, error) {
    setTimeout(() => {
      return resolve(duration);
    }, duration);
  });
}

export async function broadcast(name: string, transaction: Promise<any>, pauser: Function) {
  logger("                                                        ");
  logger("*****************executing " + name + "*****************");
  logger("                                                         ");
  const result = await transaction;
  await pauser();
}

export async function deploy<T extends Contract>(
  name: string,
  factory: ContractFactory,
  pauser: Function,
  ...args: Array<any>
): Promise<T> {
  let gasArgs = args || [];
  //if (gasOverride) gasArgs.push({ gasLimit: 2000000, maxFeePerGas: "0x17D78400", maxPriorityFeePerGas: "0x17D78400" });
  // gasArgs.push({ gasLimit: 2000000, maxFeePerGas: "0x17D78400", maxPriorityFeePerGas: "0x17D78400" });

  gasArgs.push(await getNonce());

  const contract: T = await factory.deploy(...gasArgs) as T;
  logger("pausing for deployment of " + name + " at " + new Date().toTimeString());
  await pauser();
  //await contract.deployed();
  return contract;
}

export function nameNetwork(networkId: number) {
  switch (networkId) {
    case 1:
      return "mainnet"
    case 1337:
      return "hardhat";
    case 3:
      return "ropsten";
    case 42:
      return "kovan";
    default:
      throw "unknown network";
  }
}
