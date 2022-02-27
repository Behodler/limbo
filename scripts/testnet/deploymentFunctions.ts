import { ethers } from "hardhat";
import { parseEther } from "ethers/lib/utils";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { BigNumber, Contract, ContractFactory } from "ethers";
import { write, writeFileSync } from "fs";
import { OutputAddress, AddressFileStructure } from "./common";
type address = string;
const nullAddress = "0x0000000000000000000000000000000000000000";

function pauseUntilNextBlockFactory() {
  let provider = ethers.getDefaultProvider("ropsten");
  const duration = 15000;
  return async function () {
    const initialBlock = await provider.getBlockNumber();
    let currentBlock = await provider.getBlockNumber();
    while (currentBlock - initialBlock < 2) {
      console.log(`current block number: ${currentBlock}. Pausing for ${duration / 1000} seconds`);
      await pause(duration);
      currentBlock = await provider.getBlockNumber();
    }
  };
}

async function broadcast(name: string, transaction: Promise<any>) {
  const pauseUntilNextBlock = pauseUntilNextBlockFactory();
  console.log("*****************executing " + name + "*****************");
  const result = await transaction;
  await pauseUntilNextBlock();
}

function pause(duration: number) {
  return new Promise(function (resolve, error) {
    setTimeout(() => {
      return resolve(duration);
    }, duration);
  });
}

const pauseUntilNextBlock = pauseUntilNextBlockFactory();

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
  addressBalanceCheckAddress: string,
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

  const contract = await factory.deploy(...gasArgs);
  console.log("pausing for deployment");
  await pauseUntilNextBlock();
  return contract;
}

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

  await broadcast(
    "configure uniswaphelper",
    uniswapHelper.configure(limbo.address, flanSCXPair, behodler, flan, 180, 3, 20, 10)
  );

  await broadcast("set dai", uniswapHelper.setDAI(dai));

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
  uniLPs: address[],
  transferHelperAddress: address
) {
  const LimboDAOFactory = await ethers.getContractFactory("LimboDAO", {
    libraries: { TransferHelper: transferHelperAddress },
  });
  const dao = await LimboDAOFactory.attach(daoAddress);
  await pauseUntilNextBlock();
  await dao.seed(limbo, flan, eye, proposalFactory, nullAddress, uniswapFactory, 9, [], uniLPs);
  await pauseUntilNextBlock();

  await dao.makeLive();
  await pauseUntilNextBlock();
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
  await broadcast(
    "configure crossing",
    limbo.configureCrossingConfig(
      behodler,
      angband,
      ammHelper,
      morgothPower,
      migrationInvocationReward,
      crossingMigrationDelay,
      rectInflationFactor
    )
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

  await broadcast("lachesis measure", lachesis.measure(flan.address, true, false));

  await broadcast("lachesis update behodler", lachesis.updateBehodler(flan.address));

  await broadcast("registerPyro", liquidityReceiver.registerPyroToken(flan.address, "PyroFlan", "PyroFLN"));

  await broadcast("flan mint 10 ", flan.mint(deployer.address, parseEther("10")));
  await broadcast("flan approve", flan.approve(behodler.address, parseEther("100")));

  await broadcast("add liquidity", behodler.addLiquidity(flan.address, parseEther("10")));

  const scxBalance = await behodler.balanceOf(deployer.address);
  await pauseUntilNextBlock();

  await broadcast("create Pair", uniswapFactory.createPair(flan.address, behodler.address));

  const flanSCX = await uniswapFactory.getPair(flan.address, behodler.address);
  await pauseUntilNextBlock();

  await broadcast("scx transfer to flanSCX", behodler.transfer(flanSCX, scxBalance.div(4)));
  await broadcast("flan mint", flan.mint(flanSCX, parseEther("200")));
  const UniswapPair = await ethers.getContractFactory("RealUniswapV2Pair");
  const flanSCXPair = UniswapPair.attach(flanSCX);

  await broadcast("flanSCXPair mint", flanSCXPair.mint(deployer.address));
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
  await broadcast("set flash governer", dao.setFlashGoverner(flashGovernanceArbiter.address));
  await broadcast(
    "configure flash governance",
    flashGovernanceArbiter.configureFlashGovernance(eyeAddress, parseEther("20000"), 86400, true)
  );

  await broadcast("configure security parameters", flashGovernanceArbiter.configureSecurityParameters(2, 10000, 20));
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
  const lachesis = await LachesisLite.attach("0x147396210d38d88B5CDC605F7f60E90d0550771e"); // deploy(LachesisLite);
  console.log("lachesis address " + lachesis.address); //0x147396210d38d88B5CDC605F7f60E90d0550771e
  addressList["lachesis"] = lachesis.address;

  const behodlerAddress = tokens["SCX"];
  const BehodlerFactory = await ethers.getContractFactory("BehodlerLite", {
    libraries: { AddressBalanceCheck: addressBalanceCheckAddress },
  });
  const behodler = await BehodlerFactory.attach(behodlerAddress);

  // await broadcast("set lachesis", behodler.setLachesis(lachesis.address));

  // await broadcast("set behodler", lachesis.setBehodler(behodler.address));

  const LiquidityReceiver = await ethers.getContractFactory("LiquidityReceiver");
  //0xFB13c8ad2303F98F80931D06AFd1607744327F99
  const liquidityReceiver = await LiquidityReceiver.attach("0xFB13c8ad2303F98F80931D06AFd1607744327F99"); //deploy(LiquidityReceiver, [lachesis.address]);
  addressList["liquidityReceiver"] = liquidityReceiver.address;
  const tokenKeys = Object.keys(tokens);
  for (let i = 0; i < tokenKeys.length; i++) {
    if (tokenKeys[i].toLowerCase() === "scx") continue;
    const address = tokens[tokenKeys[i]];
    const pyrotokenAddress = await liquidityReceiver.getPyroToken(address);
    await pauseUntilNextBlock();
    const TokenFactory = await ethers.getContractFactory("MockToken");
    const pyroToken = await TokenFactory.attach(pyrotokenAddress);

    try {
      const val = await pyroToken.totalSupply();
      await pauseUntilNextBlock();
      if (parseInt(val.toString()) >= 0) {
        console.log("pyro exists");
        continue;
      }
    } catch {
      console.log("pyro for " + tokenKeys[i] + "does not exist");
    }

    const isBurnable = burnable(tokenKeys[i]);
    await broadcast("lachesis measure " + tokens[tokenKeys[i]], lachesis.measure(address, true, isBurnable));

    await broadcast("lachesis update behodler", lachesis.updateBehodler(address));

    if (!isBurnable) {
      await broadcast(
        "registerPyrotoken",
        liquidityReceiver.registerPyroToken(address, `Pyro${tokenKeys[i]}`, `KPyro${tokenKeys[i].substring(2)}`)
      );
    }
  }
  const eyeAddress = tokens["EYE"];
  const SnufferCap = await ethers.getContractFactory("BurnEYESnufferCap");

  const snufferCap = await deploy(SnufferCap, [eyeAddress, liquidityReceiver.address]);
  addressList["snufferCap"] = snufferCap.address;
  await broadcast("set snuffer cap", liquidityReceiver.setSnufferCap(snufferCap.address));
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
  await broadcast("weth deposit", weth.deposit({ value: parseEther("2") }));
  addressList["WETH"] = weth.address;

  await broadcast("lachesis measure weth", lachesis.measure(weth.address, true, false));

  await broadcast("lachesis update behodler", lachesis.updateBehodler(weth.address));

  await broadcast("register pyroweth", liquidityReceiver.registerPyroToken(weth.address, "PyroWETH", "KPyroWETH"));

  const pyroWethAddress = await liquidityReceiver.getPyroToken(weth.address);
  await pauseUntilNextBlock();

  console.log("pyroWeth: " + pyroWethAddress);
  const PyroWeth10Proxy = await ethers.getContractFactory("PyroWeth10Proxy");

  const proxy = await deploy(PyroWeth10Proxy, [pyroWethAddress], true);
  console.log("PyroWeth10Proxy" + proxy.address);
  addressList["proxy"] = proxy.address;

  await broadcast("weth approve", weth.approve(proxy.address, parseEther("10000")));
  return addressList;
}

async function uniclone(
  deployer: SignerWithAddress,
  tokenAddresses: OutputAddress,
  recognizedTestNet: boolean,
  name: string,
  factory: string
): Promise<OutputAddress> {
  let addressList: OutputAddress = {};
  const UniswapV2Factory = await ethers.getContractFactory("RealUniswapV2Factory");
  if (!recognizedTestNet) {
    console.log("WARNING: NETWORK DETECTED NOT PUBLIC TESTNET");
  }
  const uniswapFactory = recognizedTestNet
    ? await UniswapV2Factory.attach(factory)
    : await deploy(UniswapV2Factory, [deployer.address]);

  const daiAddress = tokenAddresses["DAI"];
  const eyeAddress = tokenAddresses["EYE"];
  const wethAddress = tokenAddresses["WETH"];

  const scxAddress = tokenAddresses["SCX"];

  const pair = await ethers.getContractFactory("RealUniswapV2Pair");
  await pauseUntilNextBlock();
  let eyeDaiAddress = await uniswapFactory.getPair(daiAddress, eyeAddress);
  await pauseUntilNextBlock();
  let scxWethAddress = await uniswapFactory.getPair(wethAddress, scxAddress);
  await pauseUntilNextBlock();
  let eyeScxAddress = await uniswapFactory.getPair(scxAddress, eyeAddress);
  await pauseUntilNextBlock();

  console.log({
    eyeDaiAddress,
    scxWethAddress,
    eyeScxAddress,
  });

  let EYEDAI = await pair.attach(eyeDaiAddress);
  let SCXWETH = await pair.attach(scxWethAddress);
  let EYESCX = await pair.attach(eyeScxAddress);
  if (name === "sushi") {
    console.log("EYEDAI: " + EYEDAI.address);
    console.log("SCXWETH: " + SCXWETH.address);
    console.log("EYESCX: " + EYESCX.address);
  }
  if (EYEDAI.address === "0x0000000000000000000000000000000000000000")
    await broadcast("create dai/eye", uniswapFactory.createPair(daiAddress, eyeAddress));

  if (SCXWETH.address === "0x0000000000000000000000000000000000000000")
    await broadcast("create weth/scx", uniswapFactory.createPair(wethAddress, scxAddress));

  if (EYESCX.address === "0x0000000000000000000000000000000000000000")
    await broadcast("create eye/scx", uniswapFactory.createPair(eyeAddress, scxAddress));

  eyeDaiAddress = await uniswapFactory.getPair(daiAddress, eyeAddress);
  await pauseUntilNextBlock();
  scxWethAddress = await uniswapFactory.getPair(wethAddress, scxAddress);
  await pauseUntilNextBlock();
  eyeScxAddress = await uniswapFactory.getPair(scxAddress, eyeAddress);
  await pauseUntilNextBlock();

  EYEDAI = await pair.attach(eyeDaiAddress);
  SCXWETH = await pair.attach(scxWethAddress);
  EYESCX = await pair.attach(eyeScxAddress);

  console.log(
    JSON.stringify({
      EYEDAI: EYEDAI.address,
      SCXWETH: SCXWETH.address,
      EYESCX: EYESCX.address,
    })
  );
  const suffix = name === "sushi" ? "SLP" : "";
  addressList[`${name}Factory`] = uniswapFactory.address;
  addressList["EYEDAI" + suffix] = EYEDAI.address;
  addressList["EYESCX" + suffix] = EYESCX.address;
  addressList["SCXWETH" + suffix] = SCXWETH.address;
  return addressList;
}

export async function deploySushiswap(
  deployer: SignerWithAddress,
  tokenAddresses: OutputAddress,
  recognizedTestNet: boolean
) {
  return uniclone(deployer, tokenAddresses, recognizedTestNet, "sushi", "0xc35DADB65012eC5796536bD9864eD8773aBc74C4");
}

export async function deployUniswap(
  deployer: SignerWithAddress,
  tokenAddresses: OutputAddress,
  recognizedTestNet: boolean
) {
  return uniclone(deployer, tokenAddresses, recognizedTestNet, "uniswap", "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f");
}

export async function seedUniswap(
  deployer: SignerWithAddress,
  eyeAddress: string,
  daiAddress: string,
  scxAddress: string,
  wethAddress: string,
  EYEDAIaddress: string,
  SCXWETHaddress: string,
  EYESCXaddress: string
) {
  const EYEDAI = (await ethers.getContractFactory("RealUniswapV2Pair")).attach(EYEDAIaddress);
  const SCXWETH = (await ethers.getContractFactory("RealUniswapV2Pair")).attach(SCXWETHaddress);
  const EYESCX = (await ethers.getContractFactory("RealUniswapV2Pair")).attach(EYESCXaddress);

  const scxInstance = (await ethers.getContractFactory("MockToken")).attach(scxAddress);
  const eyeInstance = (await ethers.getContractFactory("MockToken")).attach(eyeAddress);
  const daiInstance = (await ethers.getContractFactory("MockToken")).attach(daiAddress);
  const wethInstance = (await ethers.getContractFactory("MockToken")).attach(wethAddress);

  const scxBalance = (await scxInstance.balanceOf(deployer.address)) as BigNumber;
  await pauseUntilNextBlock();
  console.log("scxbalance: " + scxBalance);
  const seedAmount = scxBalance.div(5);

  const tokenAmount = parseEther("2");

  const EYEDAIBalance = await EYEDAI.balanceOf(deployer.address);
  await pauseUntilNextBlock();
  const SCXWETHBalance = await SCXWETH.balanceOf(deployer.address);
  await pauseUntilNextBlock();
  const EYESCXBalance = await EYESCX.balanceOf(deployer.address);
  await pauseUntilNextBlock();
  console.log([EYEDAIBalance.toString(), SCXWETHBalance.toString(), EYESCXBalance.toString()]);
  if (EYEDAIBalance.eq(0)) {
    console.log("eyedai");
    await broadcast("eye transfer", eyeInstance.transfer(EYEDAI.address, tokenAmount));

    await broadcast("dai transfer", daiInstance.transfer(EYEDAI.address, tokenAmount));

    await broadcast("eyedai mint", EYEDAI.mint(deployer.address));
  }

  if (SCXWETHBalance.eq(0)) {
    console.log("scxweth");
    const wethbalance = await wethInstance.balanceOf(deployer.address);
    await pauseUntilNextBlock();
    console.log("WETH balance: " + wethbalance);
    console.log (`transferring ${wethbalance.div(5).toString()} weth and ${seedAmount.toString()} scx`);
    await broadcast("weth transfer", wethInstance.transfer(SCXWETH.address, wethbalance.div(5)));

    await broadcast("scx transfer", scxInstance.transfer(SCXWETH.address, seedAmount));

    const balanceOfWeth = await wethInstance.balanceOf(SCXWETH.address);
    await pauseUntilNextBlock();
    console.log("WETH balance: " + balanceOfWeth);

    const balanceOfScx = await scxInstance.balanceOf(SCXWETH.address);
    await pauseUntilNextBlock();
    console.log("SCX balance: " + balanceOfScx);

    await broadcast("scxweth mint", SCXWETH.mint(deployer.address));
  }

  if (EYESCXBalance.eq(0)) {
    console.log("eyescx");
    await broadcast("scx transfer", scxInstance.transfer(EYESCX.address, seedAmount));

    await broadcast("eye transfer", eyeInstance.transfer(EYESCX.address, tokenAmount));
    await pauseUntilNextBlock();
    await broadcast("eyescx mint", EYESCX.mint(deployer.address));
  }
}

export async function deployBehodler(deployer: SignerWithAddress): Promise<OutputAddress> {
  const AddressBalanceCheck = await ethers.getContractFactory("AddressBalanceCheck");
  const ABDK = await ethers.getContractFactory("ABDK", deployer);
  const addressBalanceCheckDeployment = await deploy(AddressBalanceCheck);
  console.log("address balance check");
  const addressBalanceCheckAddress = addressBalanceCheckDeployment.address;
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
  addressBalanceCheckAddress: string,
  lachesisAddress: string
) {
  console.log("minting on behodler");
  const behodlerFactory = await ethers.getContractFactory("BehodlerLite", {
    libraries: { AddressBalanceCheck: addressBalanceCheckAddress },
  });
  const behodler = behodlerFactory.attach(tokens["SCX"]);
  // let scxBalance = await behodler.balanceOf(deployer.address);
  // await pauseUntilNextBlock();
  // if (scxBalance.gt(0)) {
  //   console.log("scx already minted");
  //   return;
  // }

  const LachesisFactory = await ethers.getContractFactory("LachesisLite");
  const lachesis = await LachesisFactory.attach(lachesisAddress);

  const tokenKeys = Object.keys(tokens).filter((t) => t.toLowerCase() !== "scx");
  const Token: ContractFactory = await ethers.getContractFactory("MockToken");
  for (let i = 0; i < tokenKeys.length; i++) {
    let token = tokenKeys[i];
    const tokenAddress = tokens[token];
    const config = await lachesis.cut(tokenAddress);

    await pauseUntilNextBlock();
    console.log("valid: " + config[0]);
    if (!config[0]) {
      await broadcast("lachesis measure " + token, lachesis.measure(tokenAddress, true, false));
      await pauseUntilNextBlock();
      await broadcast("update behodler " + token, lachesis.updateBehodler(tokenAddress));
      await pauseUntilNextBlock();
    }
    const amount = token === "WETH" ? "1" : "40";

    const tokenInstance = Token.attach(tokenAddress);
    const balanceOnBehodler = await tokenInstance.balanceOf(behodler.address);
    await pauseUntilNextBlock();
    if (!balanceOnBehodler.eq(0)) {
      console.log("behodler already has liquidity for " + tokenKeys[i]);
      continue;
    }
    await broadcast("approve behodler", tokenInstance.approve(behodler.address, parseEther(amount)));

    await broadcast("add liquidity to behodler", behodler.addLiquidity(tokenAddress, parseEther(amount)));
    await pauseUntilNextBlock();
  }
}
