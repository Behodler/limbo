import { ethers } from "hardhat";
import { parseEther } from "ethers/lib/utils";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { BigNumber, Contract, ContractFactory } from "ethers";
import { write, writeFileSync } from "fs";
import { OutputAddress, AddressFileStructure } from "./common";
// const hre = require("hardhat");
type address = string;
const nullAddress = "0x0000000000000000000000000000000000000000";

interface Token {
  name: string;
  instance: Contract;
  burnable: boolean;
}

const getTokenFactory =
  (tokens: Token[]) =>
  (name: string): Token => {
    return tokens.filter((t) => t.name.toLowerCase() === name.toLowerCase())[0];
  };

export async function deployMultiCall(): Promise<OutputAddress> {
  const Multicall = await ethers.getContractFactory("Multicall");
  const multicall = await deploy(Multicall, []);
  const addressList: OutputAddress = {};
  addressList["multicall"] = multicall.address;
  return addressList;
}

export async function deployMorgothDAO(
  deployer: SignerWithAddress,
  lachesisAddress: string,
  behodlerAddress: string,
  addressBalanceCheckAddress:string,
  limboAddress: string,
  limboLibraries: string[]
): Promise<OutputAddress> {
  const LachesisFactory = await ethers.getContractFactory("LachesisLite");
  const lachesis = await LachesisFactory.attach(lachesisAddress);

  const BehodlerFactory = await ethers.getContractFactory("BehodlerLite", {
    libraries: { AddressBalanceCheck: addressBalanceCheckAddress },
  });
  const behodler = await BehodlerFactory.attach(behodlerAddress);

  const LimboFactory = await ethers.getContractFactory("Limbo", {
    libraries: {
      SoulLib: limboLibraries[0],
      CrossingLib: limboLibraries[1],
      MigrationLib: limboLibraries[2],
    },
  });
  const limbo = await LimboFactory.attach(limboAddress);

  const Angband = await ethers.getContractFactory("Angband");
  const angband = await deploy(Angband, []);

  const LimboAddTokenToBehodlerPower = await ethers.getContractFactory("LimboAddTokenToBehodlerTestNet");
  const limboAddTokenToBehodlerPower = await deploy(LimboAddTokenToBehodlerPower, [
    angband.address,
    lachesis.address,
    behodler.address,
    limbo.address,
  ]);
  const addressList: OutputAddress = {};
  addressList["angband"] = angband.address;
  addressList["limboAddTokenToBehodlerPower"] = limboAddTokenToBehodlerPower.address;
  return addressList;
}

export async function deploy(factory: ContractFactory, args?: any[], gasOverride?: boolean): Promise<Contract> {
  let gasArgs = args || [];
  if (gasOverride) gasArgs.push({ gasLimit: 2000000 });
  //  gasArgs.push({ gasLimit: 2000000 });
  // const gasArgs = [...args,gas:20000000]
  const contract = await factory.deploy(...gasArgs);
  console.log("pausing");
  await pausePromise(contract.address);
  return contract;
}

export function pausePromiseFactory(networkName: string) {
  pausePromise = function (message: string) {
    return new Promise(function (resolve, error) {
      setTimeout(
        () => {
          console.log(message);
          return resolve(message);
        },
        networkName === "hardhat" ? 0 : 25000
      );
    });
  };
}

let pausePromise: any;

export async function deploySoulReader(): Promise<OutputAddress> {
  const SoulReader = await ethers.getContractFactory("SoulReader");
  const soulReader = await deploy(SoulReader, []);
  const addressList: OutputAddress = {};
  addressList["soulReader"] = soulReader.address;
  return addressList;
}

export async function deployProposalFactory(
  deployer: SignerWithAddress,
  daoAddress: string,
  limboAddress: string,
  uniswapHelperAddress: string,
  transferHelperAddress: string,
  limboLibraries: string[]
): Promise<OutputAddress> {
  const LimboDAOFactory = await ethers.getContractFactory("LimboDAO", {
    libraries: { TransferHelper: transferHelperAddress },
  });
  const dao = await LimboDAOFactory.attach(daoAddress);

  const LimboFactory = await ethers.getContractFactory("Limbo", {
    libraries: {
      SoulLib: limboLibraries[0],
      CrossingLib: limboLibraries[1],
      MigrationLib: limboLibraries[2],
    },
  });
  const limbo = await LimboFactory.attach(limboAddress);

  const UniswapHelperFactory = await ethers.getContractFactory("UniswapHelper");
  const uniswapHelper = await UniswapHelperFactory.attach(uniswapHelperAddress);
  const MockMorgothTokenApprover = await ethers.getContractFactory("MockMorgothTokenApprover");
  const mockMorgothTokenApprover = await deploy(MockMorgothTokenApprover, []);

  const WhiteList = await ethers.getContractFactory("ToggleWhitelistProposalProposal");
  const whiteList = await deploy(WhiteList, [dao.address, "WhiteListProposal"]);

  const UpdateMultipleSoulConfigProposal = await ethers.getContractFactory("UpdateMultipleSoulConfigProposal");
  const updateMultipleSoulConfigProposal = await deploy(UpdateMultipleSoulConfigProposal, [
    dao.address,
    "UpdateMultipleSoulConfigProposal",
    limbo.address,
    uniswapHelper.address,
    mockMorgothTokenApprover.address,
  ]);

  const ProposalFactory = await ethers.getContractFactory("ProposalFactory");
  const proposalFactory = await deploy(ProposalFactory, [
    dao.address,
    whiteList.address,
    updateMultipleSoulConfigProposal.address,
  ]);

  const addressList: OutputAddress = {};
  addressList["proposalFactory"] = proposalFactory.address;
  addressList["whiteList"] = whiteList.address;
  addressList["updateMultipleSoulConfigProposal"] = updateMultipleSoulConfigProposal.address;
  addressList["mockMorgothTokenApprover"] = mockMorgothTokenApprover.address;
  return addressList;
}

export async function deployLimbo(
  deployer: SignerWithAddress,
  flan: string,
  flanSCXPair: string,
  dai: string,
  behodler: string,
  daoAddress: string,
  transferHelperAddress: address
): Promise<OutputAddress> {
  const daoFactory: ContractFactory = await ethers.getContractFactory("LimboDAO", {
    libraries: { TransferHelper: transferHelperAddress },
  });
  const dao = await daoFactory.attach(daoAddress);
  const SoulLib = await ethers.getContractFactory("SoulLib");
  const CrossingLib = await ethers.getContractFactory("CrossingLib");
  const MigrationLib = await ethers.getContractFactory("MigrationLib");
  const soulLib = await deploy(SoulLib, []);
  const crossingLib = await deploy(CrossingLib, []);
  const migrationLib = await deploy(MigrationLib, []);

  const Limbo = await ethers.getContractFactory("Limbo", {
    libraries: {
      SoulLib: soulLib.address,
      CrossingLib: crossingLib.address,
      MigrationLib: migrationLib.address,
    },
  });

  const limbo = await deploy(Limbo, [flan, dao.address]);

  const UniswapHelper = await ethers.getContractFactory("UniswapHelper");
  const uniswapHelper = await deploy(UniswapHelper, [limbo.address, dao.address]);

  await pausePromise("configure uniswapHelper");

  await uniswapHelper.configure(limbo.address, flanSCXPair, behodler, flan, 180, 3, 20, 10);
  await pausePromise("configure uniswapHelper");

  await uniswapHelper.setDAI(dai);
  await pausePromise("uniswapHelper set Dai");
  let addressList: OutputAddress = {};
  addressList["limbo"] = limbo.address;
  addressList["uniswapHelper"] = uniswapHelper.address;
  addressList["soulLib"] = soulLib.address;
  addressList["crossingLib"] = crossingLib.address;
  addressList["migrationLib"] = migrationLib.address;
  return addressList;
}

export async function seedLimboDAO(
  daoAddress: string,
  limbo: address,
  flan: address,
  eye: address,
  proposalFactory: address,
  uniswapFactory: address,
  flashGoverner: address,
  uniLPs: address[],
  transferHelperAddress: address
) {
  const LimboDAOFactory = await ethers.getContractFactory("LimboDAO", {
    libraries: { TransferHelper: transferHelperAddress },
  });
  const dao = await LimboDAOFactory.attach(daoAddress);
  await pausePromise("seed dao");
  await dao.seed(limbo, flan, eye, proposalFactory, nullAddress, uniswapFactory, flashGoverner, 9, [], uniLPs);
  await pausePromise("seed dao");

  await dao.makeLive();
}

export async function configureLimboCrossingConfig(
  limboAddress: string,
  behodler: string,
  angband: string,
  ammHelper: string,
  morgothPower: string,
  migrationInvocationReward: number,
  crossingMigrationDelay: number,
  rectInflationFactor: number,
  limboLibraries: string[]
) {
  const LimboFactory = await ethers.getContractFactory("Limbo", {
    libraries: {
      SoulLib: limboLibraries[0],
      CrossingLib: limboLibraries[1],
      MigrationLib: limboLibraries[2],
    },
  });
  const limbo = await LimboFactory.attach(limboAddress);
  await limbo.configureCrossingConfig(
    behodler,
    angband,
    ammHelper,
    morgothPower,
    migrationInvocationReward,
    crossingMigrationDelay,
    rectInflationFactor
  );
}

export async function deployTokens(deployer: SignerWithAddress): Promise<OutputAddress> {
  /*
  EYE
WETH
SCX
MAKER
OXT	
PNK
LINK
WEIDAI
LOOM
DAI
EYEDAI 
SCX/ETH
SCX/EYE

  */
  const Token = await ethers.getContractFactory("MockToken");
  console.log("about to deploy EYE");
  const eye = await deploy(Token, ["EYE", "EYE", [], []]);
  console.log("about to deploy MAKER");
  const maker = await deploy(Token, ["MAKER", "MKR", [], []]);
  console.log("about to deploy OXT");
  const oxt = await deploy(Token, ["OXT", "OXT", [], []]);
  console.log("about to deploy PNK");
  const pnk = await deploy(Token, ["PNK", "PNK", [], []]);
  console.log("about to deploy LINK");
  const link = await deploy(Token, ["LINK", "LINK", [], []]);
  console.log("about to deploy WEIDAI");
  const weidai = await deploy(Token, ["WEIDAI", "WDAI", [], []]);
  console.log("about to deploy LOOM");
  const loom = await deploy(Token, ["LOOM", "LOOM", [], []]);
  console.log("about to deploy DAI");
  const dai = await deploy(Token, ["DAI", "DAI", [], []]);
  let tokens: OutputAddress = {};
  tokens["EYE"] = eye.address;
  tokens["MAKER"] = maker.address;
  tokens["OXT"] = oxt.address;
  tokens["PNK"] = pnk.address;
  tokens["LINK"] = link.address;
  tokens["WEIDAI"] = weidai.address;
  tokens["LOOM"] = loom.address;
  tokens["DAI"] = dai.address;
  return tokens;
}

export async function deployFlan(
  deployer: SignerWithAddress,
  daoAddress: string,
  lachesisAddress: string,
  behodlerAddress: string,
  uniswapFactoryAddress: string,
  liquidityReceiverAddress: string,
  addressBalanceCheckAddress: string,
  transferHelperAddress: string
): Promise<OutputAddress> {
  const LimboDAOFactory = await ethers.getContractFactory("LimboDAO", {
    libraries: { TransferHelper: transferHelperAddress },
  });

  const dao = await LimboDAOFactory.attach(daoAddress);

  const LachesisFactory = await ethers.getContractFactory("LachesisLite");
  const lachesis = await LachesisFactory.attach(lachesisAddress);

  const BehodlerFactory = await ethers.getContractFactory("BehodlerLite", {
    libraries: { AddressBalanceCheck: addressBalanceCheckAddress },
  });
  const behodler = await BehodlerFactory.attach(behodlerAddress);

  const UniswapFactory = await ethers.getContractFactory("RealUniswapV2Factory");
  const uniswapFactory = await UniswapFactory.attach(uniswapFactoryAddress);

  const LiquidityReceiverFactory = await ethers.getContractFactory("LiquidityReceiver");
  const liquidityReceiver = await LiquidityReceiverFactory.attach(liquidityReceiverAddress);

  const Flan = await ethers.getContractFactory("Flan");
  const flan = await deploy(Flan, [dao.address]);

  await lachesis.measure(flan.address, true, false);
  await pausePromise("lachesis measure");
  await lachesis.updateBehodler(flan.address);
  await pausePromise("lachesis update behodler");

  await liquidityReceiver.registerPyroToken(flan.address, "PyroFlan", "PyroFLN");
  await pausePromise("liquidityReceiver register flan");

  await flan.mint(deployer.address, parseEther("10"));
  await pausePromise("flan mint");
  await flan.approve(behodler.address, parseEther("100"));
  await pausePromise("flan approve");
  await behodler.addLiquidity(flan.address, parseEther("10"));
  await pausePromise("behodler add liquidity");
  const scxBalance = await behodler.balanceOf(deployer.address);

  await uniswapFactory.createPair(flan.address, behodler.address);
  await pausePromise("uniswapFactory createPair");
  const flanSCX = await uniswapFactory.getPair(flan.address, behodler.address);
  await pausePromise("uniswapFactory getPair");
  await behodler.transfer(flanSCX, scxBalance.div(4));
  await pausePromise("behodler transfer");
  await flan.mint(flanSCX, parseEther("200"));
  await pausePromise("flan mint");
  const UniswapPair = await ethers.getContractFactory("RealUniswapV2Pair");
  const flanSCXPair = UniswapPair.attach(flanSCX);

  await flanSCXPair.mint(deployer.address);
  await pausePromise("flanSCXPair mint");
  let addressList: OutputAddress = {};
  addressList["FLAN"] = flan.address;
  addressList["flanSCX"] = flanSCX;
  return addressList;
}

export async function deployLimboDAO(deployer: SignerWithAddress, eyeAddress: string): Promise<OutputAddress> {
  const TransferHelper = await ethers.getContractFactory("TransferHelper");
  const transferHelper = await deploy(TransferHelper, []);

  const LimboDAO = await ethers.getContractFactory("LimboDAO", {
    libraries: { TransferHelper: transferHelper.address },
  });

  const dao = await deploy(LimboDAO, []);
  const FlashGovernanceArbiter = await ethers.getContractFactory("FlashGovernanceArbiter");

  const flashGovernanceArbiter = await deploy(FlashGovernanceArbiter, [dao.address]);

  await flashGovernanceArbiter.configureFlashGovernance(eyeAddress, parseEther("20000"), 86400, true);
  await pausePromise("flashGovernanceArbiter configureFlashGovernance");
  await flashGovernanceArbiter.configureSecurityParameters(2, 10000, 20);
  await pausePromise("flashGovernanceArbiter configureSecurityParameters");
  let addressList: OutputAddress = {};
  addressList["transferHelper"] = transferHelper.address;
  addressList["dao"] = dao.address;
  addressList["flashGovernanceArbiter"] = flashGovernanceArbiter.address;
  return addressList;
}

function burnable(name: string) {
  let workingName = name.toLowerCase();
  return ["weidai", "eye", "maker"].filter((t) => t === workingName).length > 0;
}

export async function deployLiquidityReceiver(
  deployer: SignerWithAddress,
  tokens: OutputAddress,
  addressBalanceCheckAddress: string
): Promise<OutputAddress> {
  let addressList: OutputAddress = {};
  const LachesisLite = await ethers.getContractFactory("LachesisLite");
  const lachesis = await deploy(LachesisLite);
  addressList["lachesis"] = lachesis.address;

  const behodlerAddress = tokens["SCX"];
  const BehodlerFactory = await ethers.getContractFactory("BehodlerLite", {
    libraries: { AddressBalanceCheck: addressBalanceCheckAddress },
  });
  const behodler = await BehodlerFactory.attach(behodlerAddress);

  await pausePromise("behodler set lachesis");
  await behodler.setLachesis(lachesis.address, { from: deployer.address });

  await pausePromise("lachesis set behodler");
  await lachesis.setBehodler(behodler.address, { from: deployer.address });

  const LiquidityReceiver = await ethers.getContractFactory("LiquidityReceiver");
  const liquidityReceiver = await deploy(LiquidityReceiver, [lachesis.address]);
  addressList["liquidityReceiver"] = liquidityReceiver.address;
  const tokenKeys = Object.keys(tokens);
  for (let i = 0; i < tokenKeys.length; i++) {
    if (tokenKeys[i].toLowerCase() === "scx") continue;
    const address = tokens[tokenKeys[i]];
    const isBurnable = burnable(tokenKeys[i]);
    await lachesis.measure(address, true, isBurnable);
    await pausePromise("lachesis measure");
    await lachesis.updateBehodler(address);
    await pausePromise("lachesis update behodler");
    if (!isBurnable) {
      await liquidityReceiver.registerPyroToken(address, `Pyro${tokenKeys[i]}`, `KPyro${tokenKeys[i].substring(2)}`);
      await pausePromise("liquidityReceiver register");
    }
  }
  const eyeAddress = tokens["EYE"];
  const SnufferCap = await ethers.getContractFactory("BurnEYESnufferCap");
  const snufferCap = await deploy(SnufferCap, [eyeAddress, liquidityReceiver.address]);
  addressList["snufferCap"] = snufferCap.address;

  liquidityReceiver.setSnufferCap(snufferCap.address);
  await pausePromise("liquidityReceiver set snufferCap");
  return addressList;
}

export async function deployWeth(
  deployer: SignerWithAddress,
  liquidityReceiverAddress: string,
  lachesisAddress: string
): Promise<OutputAddress> {
  const addressList: OutputAddress = {};
  const LiquidityReceiverFactory: ContractFactory = await ethers.getContractFactory("LiquidityReceiver");
  const liquidityReceiver = await LiquidityReceiverFactory.attach(liquidityReceiverAddress);

  const LachesisFactory: ContractFactory = await ethers.getContractFactory("LachesisLite");
  const lachesis = await LachesisFactory.attach(lachesisAddress);

  const Weth = await ethers.getContractFactory("WETH10");
  const weth = await deploy(Weth);
  await weth.deposit({ value: parseEther("2") });
  addressList["WETH"] = weth.address;
  await lachesis.measure(weth.address, true, false);
  await lachesis.updateBehodler(weth.address);

  await pausePromise("lachesis update behodler");
  console.log("weth address: " + weth.address);
  liquidityReceiver.registerPyroToken(weth.address, "PyroWETH", "KPyroWETH");
  await pausePromise("liquidityReceiver register weth");
  const pyroWethAddress = await liquidityReceiver.getPyroToken(weth.address);
  await pausePromise("liquidityReceiver get weth");

  console.log("pyroWeth: " + pyroWethAddress);
  const PyroWeth10Proxy = await ethers.getContractFactory("PyroWeth10Proxy");

  const proxy = await deploy(PyroWeth10Proxy, [pyroWethAddress], true);
  console.log("PyroWeth10Proxy" + proxy.address);
  addressList["proxy"] = proxy.address;

  weth.approve(proxy.address, parseEther("10000"));
  await pausePromise("weth approve");
  return addressList;
}

export async function deployUniswap(
  deployer: SignerWithAddress,
  tokenAddresses: OutputAddress,
  recognizedTestNet: boolean
): Promise<OutputAddress> {
  let addressList: OutputAddress = {};
  const UniswapV2Factory = await ethers.getContractFactory("RealUniswapV2Factory");
  if (!recognizedTestNet) {
    console.log("WARNING: NETWORK DETECTED NOT PUBLIC TESTNET");
  }
  const uniswapFactory = recognizedTestNet
    ? await UniswapV2Factory.attach("0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f")
    : await UniswapV2Factory.deploy(deployer.address);
  await pausePromise("uniswapFactory deploy");

  const daiAddress = tokenAddresses["DAI"];
  const eyeAddress = tokenAddresses["EYE"];
  const wethAddress = tokenAddresses["WETH"];

  const scxAddress = tokenAddresses["SCX"];

  const TokenFactory: ContractFactory = await ethers.getContractFactory("MockToken");
  const daiInstance = await TokenFactory.attach(daiAddress);
  const eyeInstance = await TokenFactory.attach(eyeAddress);
  const wethInstance = await TokenFactory.attach(wethAddress);
  const scxInstance = await TokenFactory.attach(scxAddress);

  uniswapFactory.createPair(daiAddress, eyeAddress);
  await pausePromise("uniswapFactory createPair");
  uniswapFactory.createPair(wethAddress, scxAddress);
  await pausePromise("uniswapFactory createPair");
  uniswapFactory.createPair(eyeAddress, scxAddress);
  await pausePromise("uniswapFactory createPair");

  const pair = await ethers.getContractFactory("RealUniswapV2Pair");

  const EYEDAI = await pair.attach(await uniswapFactory.getPair(daiAddress, eyeAddress));
  const SCXWETH = await pair.attach(await uniswapFactory.getPair(wethAddress, scxAddress));
  const EYESCX = await pair.attach(await uniswapFactory.getPair(eyeAddress, scxAddress));

  const scxBalance = (await scxInstance.balanceOf(deployer.address)) as BigNumber;
  console.log("scxbalance: " + scxBalance);
  const seedAmount = scxBalance.div(5);

  const tokenAmount = parseEther("2");

  await eyeInstance.transfer(EYEDAI.address, tokenAmount);
  await pausePromise("eye transfer");
  await eyeInstance.transfer(EYESCX.address, tokenAmount);
  await pausePromise("eye transfer");

  await daiInstance.transfer(EYEDAI.address, tokenAmount);
  await pausePromise("dai transfer");
  const wethbalance = await wethInstance.balanceOf(deployer.address);
  console.log("WETH balance: " + wethbalance);
  await wethInstance.transfer(SCXWETH.address, wethbalance.div(5));
  await pausePromise("weth transfer");

  await scxInstance.transfer(SCXWETH.address, seedAmount);
  await pausePromise("scx transfer");
  await scxInstance.transfer(EYESCX.address, seedAmount);
  await pausePromise("scx transfer");

  await EYEDAI.mint(deployer.address);
  await pausePromise("EYEDAI mint");
  await SCXWETH.mint(deployer.address);
  await EYESCX.mint(deployer.address);

  addressList["uniswapFactory"] = uniswapFactory.address;
  addressList["EYEDAI"] = EYEDAI.address;
  addressList["EYESCX"] = EYESCX.address;
  addressList["SCXWETH"] = SCXWETH.address;
  return addressList;
}

export async function deployBehodler(deployer: SignerWithAddress): Promise<OutputAddress> {
  //const openBehodler = await ethers.getContractFactory("AddressBalanceCheck")

  const AddressBalanceCheck = await ethers.getContractFactory("AddressBalanceCheck");
  const ABDK = await ethers.getContractFactory("ABDK", deployer);
  const addressBalanceCheckDeployment = await deploy(AddressBalanceCheck);
  console.log("address balance check");
  const addressBalanceCheckAddress = addressBalanceCheckDeployment.address;
  // await addressBalanceCheckDeployment.deployed();
  const abdkAddress = await deploy(ABDK, []);
  const BehodlerLite = await ethers.getContractFactory("BehodlerLite", {
    libraries: { AddressBalanceCheck: addressBalanceCheckAddress },
  });

  const behodlerLite = await deploy(BehodlerLite);
  console.log("about to wait for behodler");
  const addresses: OutputAddress = {};
  addresses["behodler"] = behodlerLite.address;
  addresses["addressBalanceCheck"] = addressBalanceCheckAddress;
  return addresses;
}

export async function mintOnBehodler(
  deployer: SignerWithAddress,
  tokens: OutputAddress,
  addressBalanceCheckAddress: string
) {
  const behodlerFactory = await ethers.getContractFactory("BehodlerLite", {
    libraries: { AddressBalanceCheck: addressBalanceCheckAddress },
  });
  const behodler = behodlerFactory.attach(tokens["SCX"]);

  const tokenKeys = Object.keys(tokens).filter((t) => t.toLowerCase() !== "scx");
  const Token: ContractFactory = await ethers.getContractFactory("MockToken");
  for (let i = 0; i < tokenKeys.length; i++) {
    let token = tokenKeys[i];
    const amount = token === "WETH" ? "1" : "40";
    const tokenAddress = tokens[token];
    await pausePromise(`token approve for ${token}: ${tokenAddress}`);
    const tokenInstance = Token.attach(tokenAddress);
    await tokenInstance.approve(behodler.address, parseEther(amount));
    await pausePromise("add liquidity");
    await behodler.addLiquidity(tokenAddress, parseEther(amount));
    const scxBalance = await behodler.balanceOf(deployer.address);
    console.log("scx balance: " + scxBalance.toString());
  }
}
