import { ethers, network } from "hardhat";
import { parseEther } from "ethers/lib/utils";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { BigNumber, Contract, ContractFactory } from "ethers";
import { OutputAddress, logFactory, deploy, getTXCount, getNonce, broadcast } from "./common";
type address = string;
const nullAddress = "0x0000000000000000000000000000000000000000";

const logger = logFactory(true);

interface Token {
  name: string;
  instance: Contract;
  burnable: boolean;
}

export async function deployMultiCall(pauser: Function): Promise<OutputAddress> {
  const Multicall = await ethers.getContractFactory("Multicall");
  const multicall = await deploy("Multicall", Multicall, pauser, []);
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
  limboLibraries: string[],
  pauser: Function
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
  const angband = await deploy("angband", Angband, pauser, []);
  const LimboAddTokenToBehodlerPower = await ethers.getContractFactory("LimboAddTokenToBehodlerTestNet");
  const limboAddTokenToBehodlerPower = await deploy("LimboPower", LimboAddTokenToBehodlerPower, pauser, [
    angband.address,
    behodler.address,
    lachesis.address,
    limbo.address,
  ]);

  const addressList: OutputAddress = {};
  addressList["angband"] = angband.address;
  addressList["limboAddTokenToBehodlerPower"] = limboAddTokenToBehodlerPower.address;
  return addressList;
}

export async function deploySoulReader(pauser: Function): Promise<OutputAddress> {
  const SoulReader = await ethers.getContractFactory("SoulReader");
  const soulReader = await deploy("SoulReader", SoulReader, pauser, []);
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
  limboLibraries: string[],
  pauser: Function
): Promise<OutputAddress> {
  const LimboDAOFactory = await ethers.getContractFactory("LimboDAO", {
    libraries: { },
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
  const mockMorgothTokenApprover = await deploy("MockMorgothTokenApprover", MockMorgothTokenApprover, pauser, []);

  const WhiteList = await ethers.getContractFactory("ToggleWhitelistProposalProposal");
  const whiteList = await deploy("WhiteList", WhiteList, pauser, [dao.address, "WhiteListProposal"]);

  const UpdateMultipleSoulConfigProposal = await ethers.getContractFactory("UpdateMultipleSoulConfigProposal");
  const updateMultipleSoulConfigProposal = await deploy(
    "UpdateMultipleSoulConfigProposal",
    UpdateMultipleSoulConfigProposal,
    pauser,
    [
      dao.address,
      "UpdateMultipleSoulConfigProposal",
      limbo.address,
      uniswapHelper.address,
      mockMorgothTokenApprover.address,
    ]
  );

  const ProposalFactory = await ethers.getContractFactory("ProposalFactory");
  const proposalFactory = await deploy("ProposalFactory", ProposalFactory, pauser, [
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
  transferHelperAddress: address,
  pauser: Function
): Promise<OutputAddress> {
  const daoFactory: ContractFactory = await ethers.getContractFactory("LimboDAO", {
    libraries: { },
  });
  const dao = await daoFactory.attach(daoAddress);
  const SoulLib = await ethers.getContractFactory("SoulLib");
  const CrossingLib = await ethers.getContractFactory("CrossingLib");
  const MigrationLib = await ethers.getContractFactory("MigrationLib");

  const soulLib = await deploy("SoulLib", SoulLib, pauser, []);
  const crossingLib = await deploy("CrossingLib", CrossingLib, pauser, []);
  const migrationLib = await deploy("MigrationLib", MigrationLib, pauser, []);

  const Limbo = await ethers.getContractFactory("Limbo", {
    libraries: {
      SoulLib: soulLib.address,
      CrossingLib: crossingLib.address,
      MigrationLib: migrationLib.address,
    },
  });

  const limbo = await deploy("Limbo", Limbo, pauser, [flan, dao.address]);

  const UniswapHelper = await ethers.getContractFactory("UniswapHelper");
  const uniswapHelper = await deploy("UNi helper", UniswapHelper, pauser, [limbo.address, dao.address]);

  const FlanFactory = await ethers.getContractFactory("Flan");
  const flanInstance = await FlanFactory.attach(flan);

  await broadcast("white list limbo", flanInstance.whiteListMinting(limbo.address, true, getNonce()), pauser);
  await broadcast("white list dao", flanInstance.whiteListMinting(daoAddress, true, getNonce()), pauser);
  await broadcast(
    "white list uniswap helper",
    flanInstance.whiteListMinting(uniswapHelper.address, true, getNonce()),
    pauser
  );

  await broadcast("set dai", uniswapHelper.setDAI(dai, await getNonce()), pauser);


  await broadcast(
    "configure uniswaphelper",
    uniswapHelper.configure(limbo.address, flanSCXPair, behodler, flan, 3, 20, 10, await getNonce()),
    pauser
  );


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
  transferHelperAddress: address,
  pauser: Function
) {
  const LimboDAOFactory = await ethers.getContractFactory("LimboDAO", {
    libraries: { },
  });
  const dao = await LimboDAOFactory.attach(daoAddress);
  await pauser();
  await dao.seed(limbo, flan, eye, proposalFactory, nullAddress, uniswapFactory, 9, [], uniLPs);
  await pauser();

  await dao.makeLive();
  await pauser();
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
  limboLibraries: string[],
  pauser: Function
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
      rectInflationFactor,
      await getNonce()
    ),
    pauser
  );
}

export async function deployTokens(deployer: SignerWithAddress, pauser: Function): Promise<OutputAddress> {
  const Token = await ethers.getContractFactory("MockToken");
  const eye = await deploy("EYE", Token, pauser, ["EYE", "EYE", [], []]);
  const maker = await deploy("MKR", Token, pauser, ["MAKER", "MKR", [], []]);
  const oxt = await deploy("OXT", Token, pauser, ["OXT", "OXT", [], []]);
  const pnk = await deploy("PNK", Token, pauser, ["PNK", "PNK", [], []]);
  const link = await deploy("LNK", Token, pauser, ["LINK", "LINK", [], []]);
  const weidai = await deploy("WeiDai", Token, pauser, ["WEIDAI", "WDAI", [], []]);
  const loom = await deploy("LOOM", Token, pauser, ["LOOM", "LOOM", [], []]);
  const dai = await deploy("DAI", Token, pauser, ["DAI", "DAI", [], []]);
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
  transferHelperAddress: string,
  pauser: Function
): Promise<OutputAddress> {
  const LimboDAOFactory = await ethers.getContractFactory("LimboDAO", {
    libraries: { },
  });

  const dao = await LimboDAOFactory.attach(daoAddress);

  const LachesisFactory = await ethers.getContractFactory("LachesisLite");
  const lachesis = await LachesisFactory.attach(lachesisAddress);

  const BehodlerFactory = await ethers.getContractFactory("BehodlerLite", {
    libraries: { AddressBalanceCheck: addressBalanceCheckAddress },
  });
  const behodler = await BehodlerFactory.attach(behodlerAddress);

  const UniswapFactory = await ethers.getContractFactory("UniswapV2Factory");
  const uniswapFactory = await UniswapFactory.attach(uniswapFactoryAddress);

  const LiquidityReceiverFactory = await ethers.getContractFactory("LiquidityReceiver");
  const liquidityReceiver = await LiquidityReceiverFactory.attach(liquidityReceiverAddress);

  const Flan = await ethers.getContractFactory("Flan");
  const flan = await deploy("Flan", Flan, pauser, [dao.address]);

  await broadcast("lachesis measure", lachesis.measure(flan.address, true, false, await getNonce()), pauser);

  await broadcast("lachesis update behodler", lachesis.updateBehodler(flan.address, await getNonce()), pauser);

  await broadcast(
    "registerPyro",
    liquidityReceiver.registerPyroToken(flan.address, "PyroFlan", "PyroFLN", await getNonce()),
    pauser
  );

  await broadcast("flan mint 10 ", flan.mint(deployer.address, parseEther("10"), await getNonce()), pauser);
  await broadcast("flan approve", flan.approve(behodler.address, parseEther("100"), await getNonce()), pauser);

  await broadcast("add liquidity", behodler.addLiquidity(flan.address, parseEther("10"), await getNonce()), pauser);

  const scxBalance = await behodler.balanceOf(deployer.address);
  await pauser();

  await broadcast("create Pair", uniswapFactory.createPair(flan.address, behodler.address, await getNonce()), pauser);

  const flanSCX = await uniswapFactory.getPair(flan.address, behodler.address);
  await pauser();

  await broadcast("scx transfer to flanSCX", behodler.transfer(flanSCX, scxBalance.div(4), await getNonce()), pauser);
  await broadcast("flan mint", flan.mint(flanSCX, parseEther("200"), await getNonce()), pauser);
  const UniswapPair = await ethers.getContractFactory("UniswapV2Pair");
  const flanSCXPair = UniswapPair.attach(flanSCX);

  await broadcast("flanSCXPair mint", flanSCXPair.mint(deployer.address, await getNonce()), pauser);
  let addressList: OutputAddress = {};
  addressList["FLAN"] = flan.address;
  addressList["flanSCX"] = flanSCX;
  return addressList;
}

//for hardhat only. In otherwords, on non persist.
export async function deployFakeTokens(pauser: Function): Promise<OutputAddress> {
  const MockTokenFactory = await ethers.getContractFactory("MockToken");
  const Aave = await deploy("LimboMigrationToken1", MockTokenFactory, pauser, ["Aave", "Aave", [], []]);
  const Sushi = await deploy("LimboMigrationToken2", MockTokenFactory, pauser, ["Sushi", "SUSHI", [], []]);
  const Mana = await deploy("LimboMigrationToken3", MockTokenFactory, pauser, ["Mana", "MANA", [], []]);
  const Uni = await deploy("LimboMigrationToken4", MockTokenFactory, pauser, ["Uni", "UNI", [], []]);
  const ENS = await deploy("LimboMigrationToken5", MockTokenFactory, pauser, ["ENS", "ENS", [], []]);

  const addresses: OutputAddress = {};
  addresses["LimboMigrationToken1"] = Aave.address;
  addresses["LimboMigrationToken2"] = Sushi.address;
  addresses["LimboMigrationToken3"] = Mana.address;
  addresses["LimboMigrationToken4"] = Uni.address;
  addresses["LimboMigrationToken5"] = ENS.address;
  return addresses;
}
export async function deployLimboDAO(
  deployer: SignerWithAddress,
  eyeAddress: string,
  pauser: Function
): Promise<OutputAddress> {

  const LimboDAO = await ethers.getContractFactory("LimboDAO", {

  });
  const dao = await deploy("LimboDAO", LimboDAO, pauser, []);
  const FlashGovernanceArbiter = await ethers.getContractFactory("FlashGovernanceArbiter");
  const flashGovernanceArbiter = await deploy("FlashGovArb", FlashGovernanceArbiter, pauser, [dao.address]);
  await broadcast("set flash governer", dao.setFlashGoverner(flashGovernanceArbiter.address, await getNonce()), pauser);
  await broadcast(
    "configure flash governance",
    flashGovernanceArbiter.configureFlashGovernance(eyeAddress, parseEther("20000"), 86400, true, await getNonce()),
    pauser
  );

  await broadcast(
    "configure security parameters",
    flashGovernanceArbiter.configureSecurityParameters(2, 10000, 20, await getNonce()),
    pauser
  );
  let addressList: OutputAddress = {};
  // addressList[""] = .address;
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
  addressBalanceCheckAddress: string,
  pauser: Function
): Promise<OutputAddress> {
  let addressList: OutputAddress = {};
  const LachesisLite = await ethers.getContractFactory("LachesisLite");
  const lachesis = await deploy("Lachesis", LachesisLite, pauser, [], true);
  logger("lachesis address at deployment " + lachesis.address); //0x147396210d38d88B5CDC605F7f60E90d0550771e
  addressList["lachesis"] = lachesis.address;

  const behodlerAddress = tokens["SCX"];
  const BehodlerFactory = await ethers.getContractFactory("BehodlerLite", {
    libraries: { AddressBalanceCheck: addressBalanceCheckAddress },
  });
  const behodler = await BehodlerFactory.attach(behodlerAddress);

  await broadcast("set lachesis", behodler.setLachesis(lachesis.address, getNonce()), pauser);
  await pauser();
  await broadcast("set behodler", lachesis.setBehodler(behodler.address, getNonce()), pauser);

  const LiquidityReceiver = await ethers.getContractFactory("LiquidityReceiver");
  //0xFB13c8ad2303F98F80931D06AFd1607744327F99
  const liquidityReceiver = await deploy("LiquidityReceiver", LiquidityReceiver, pauser, [lachesis.address]);
  addressList["liquidityReceiver"] = liquidityReceiver.address;
  const tokenKeys = Object.keys(tokens);
  logger("creating pyrotokens");
  for (let i = 0; i < tokenKeys.length; i++) {
    if (tokenKeys[i].toLowerCase() === "scx") continue;
    const address = tokens[tokenKeys[i]];
    const pyrotokenAddress = await liquidityReceiver.getPyroToken(address);
    await pauser();
    logger("pyroTokenAddress: " + pyrotokenAddress);
    const TokenFactory = await ethers.getContractFactory("MockToken");
    const pyroToken = await TokenFactory.attach(pyrotokenAddress);

    try {
      const val = await pyroToken.totalSupply();
      await pauser();
      if (parseInt(val.toString()) >= 0) {
        logger("pyro exists");
        continue;
      }
    } catch {
      logger("pyro for " + tokenKeys[i] + " does not exist");
    }

    const isBurnable = burnable(tokenKeys[i]);
    await broadcast(
      "lachesis measure " + tokens[tokenKeys[i]],
      lachesis.measure(address, true, isBurnable, await getNonce()),
      pauser
    );

    await broadcast("lachesis update behodler", lachesis.updateBehodler(address, await getNonce()), pauser);

    if (!isBurnable) {
      await broadcast(
        "registerPyrotoken",
        liquidityReceiver.registerPyroToken(
          address,
          `Pyro${tokenKeys[i]}`,
          `KPyro${tokenKeys[i].substring(2)}`,
          await getNonce()
        ),
        pauser
      );
    }
  }
  const eyeAddress = tokens["EYE"];
  const SnufferCap = await ethers.getContractFactory("BurnEYESnufferCap");

  const snufferCap = await deploy("SnufferCap", SnufferCap, pauser, [eyeAddress, liquidityReceiver.address]);
  addressList["snufferCap"] = snufferCap.address;
  await broadcast("set snuffer cap", liquidityReceiver.setSnufferCap(snufferCap.address, await getNonce()), pauser);
  return addressList;
}

export async function deployWeth(
  deployer: SignerWithAddress,
  liquidityReceiverAddress: string,
  lachesisAddress: string,
  pauser: Function
): Promise<OutputAddress> {
  const addressList: OutputAddress = {};
  const LiquidityReceiverFactory: ContractFactory = await ethers.getContractFactory("LiquidityReceiver");
  const liquidityReceiver = await LiquidityReceiverFactory.attach(liquidityReceiverAddress);

  const LachesisFactory: ContractFactory = await ethers.getContractFactory("LachesisLite");
  const lachesis = await LachesisFactory.attach(lachesisAddress);
  const Weth = await ethers.getContractFactory("WETH10");
  const weth = await deploy("WETH", Weth, pauser);
  await broadcast("weth deposit", weth.deposit({ value: parseEther("2"), nonce: await getTXCount(deployer) }), pauser);
  addressList["WETH"] = weth.address;

  await broadcast("lachesis measure weth", lachesis.measure(weth.address, true, false, await getNonce()), pauser);

  await broadcast("lachesis update behodler", lachesis.updateBehodler(weth.address, await getNonce()), pauser);

  await broadcast(
    "register pyroweth",
    liquidityReceiver.registerPyroToken(weth.address, "PyroWETH", "KPyroWETH", await getNonce()),
    pauser
  );

  const pyroWethAddress = await liquidityReceiver.getPyroToken(weth.address);
  await pauser();

  logger("pyroWeth: " + pyroWethAddress);
  const PyroWeth10Proxy = await ethers.getContractFactory("PyroWeth10Proxy");

  const proxy = await deploy("PYROWETH10Proxy", PyroWeth10Proxy, pauser, [pyroWethAddress], true);
  logger("PyroWeth10Proxy" + proxy.address);
  addressList["proxy"] = proxy.address;

  await broadcast("weth approve", weth.approve(proxy.address, parseEther("10000"), await getNonce()), pauser);
  return addressList;
}

async function uniclone(
  deployer: SignerWithAddress,
  tokenAddresses: OutputAddress,
  recognizedTestNet: boolean,
  name: string,
  factory: string,
  pauser: Function
): Promise<OutputAddress> {
  let addressList: OutputAddress = {};
  const UniswapV2Factory = await ethers.getContractFactory("UniswapV2Factory");
  if (!recognizedTestNet) {
    logger("WARNING: NETWORK DETECTED NOT PUBLIC TESTNET");
  }
  const uniswapFactory = recognizedTestNet
    ? await UniswapV2Factory.attach(factory)
    : await deploy("UniV2Factry", UniswapV2Factory, pauser, [deployer.address]);

  const daiAddress = tokenAddresses["DAI"];
  const eyeAddress = tokenAddresses["EYE"];
  const wethAddress = tokenAddresses["WETH"];

  const scxAddress = tokenAddresses["SCX"];

  const pair = await ethers.getContractFactory("UniswapV2Pair");
  await pauser();
  let eyeDaiAddress = await uniswapFactory.getPair(daiAddress, eyeAddress);
  await pauser();
  let scxWethAddress = await uniswapFactory.getPair(wethAddress, scxAddress);
  await pauser();
  let eyeScxAddress = await uniswapFactory.getPair(scxAddress, eyeAddress);
  await pauser();

  logger({
    eyeDaiAddress,
    scxWethAddress,
    eyeScxAddress,
  });

  let EYEDAI = await pair.attach(eyeDaiAddress);
  let SCXWETH = await pair.attach(scxWethAddress);
  let EYESCX = await pair.attach(eyeScxAddress);
  if (name === "sushi") {
    logger("EYEDAI: " + EYEDAI.address);
    logger("SCXWETH: " + SCXWETH.address);
    logger("EYESCX: " + EYESCX.address);
  }
  if (EYEDAI.address === "0x0000000000000000000000000000000000000000")
    await broadcast("create dai/eye", uniswapFactory.createPair(daiAddress, eyeAddress, await getNonce()), pauser);

  if (SCXWETH.address === "0x0000000000000000000000000000000000000000")
    await broadcast("create weth/scx", uniswapFactory.createPair(wethAddress, scxAddress, await getNonce()), pauser);

  if (EYESCX.address === "0x0000000000000000000000000000000000000000")
    await broadcast("create eye/scx", uniswapFactory.createPair(eyeAddress, scxAddress, await getNonce()), pauser);

  eyeDaiAddress = await uniswapFactory.getPair(daiAddress, eyeAddress);
  await pauser();
  scxWethAddress = await uniswapFactory.getPair(wethAddress, scxAddress);
  await pauser();
  eyeScxAddress = await uniswapFactory.getPair(scxAddress, eyeAddress);
  await pauser();

  EYEDAI = await pair.attach(eyeDaiAddress);
  SCXWETH = await pair.attach(scxWethAddress);
  EYESCX = await pair.attach(eyeScxAddress);

  logger(
    JSON.stringify(
      {
        EYEDAI: EYEDAI.address,
        SCXWETH: SCXWETH.address,
        EYESCX: EYESCX.address,
      },
      null,
      2
    )
  );
  const suffix = name === "sushi" ? "SLP" : "";
  addressList[`${name}Factory`] = uniswapFactory.address;
  addressList["EYEDAI" + suffix] = EYEDAI.address;
  addressList["EYESCX" + suffix] = EYESCX.address;
  addressList["SCXWETH" + suffix] = SCXWETH.address;
  logger("uniswap complete");
  return addressList;
}

export async function deploySushiswap(
  deployer: SignerWithAddress,
  tokenAddresses: OutputAddress,
  recognizedTestNet: boolean,
  pauser: Function
) {
  return uniclone(
    deployer,
    tokenAddresses,
    recognizedTestNet,
    "sushi",
    "0xc35DADB65012eC5796536bD9864eD8773aBc74C4",
    pauser
  );
}

export async function deployUniswap(
  deployer: SignerWithAddress,
  tokenAddresses: OutputAddress,
  recognizedTestNet: boolean,
  pauser: Function
) {
  return uniclone(
    deployer,
    tokenAddresses,
    recognizedTestNet,
    "uniswap",
    "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
    pauser
  );
}

export async function seedUniswap(
  deployer: SignerWithAddress,
  eyeAddress: string,
  daiAddress: string,
  scxAddress: string,
  wethAddress: string,
  EYEDAIaddress: string,
  SCXWETHaddress: string,
  EYESCXaddress: string,
  pauser: Function
) {
  const EYEDAI = (await ethers.getContractFactory("UniswapV2Pair")).attach(EYEDAIaddress);
  const SCXWETH = (await ethers.getContractFactory("UniswapV2Pair")).attach(SCXWETHaddress);
  const EYESCX = (await ethers.getContractFactory("UniswapV2Pair")).attach(EYESCXaddress);

  const scxInstance = (await ethers.getContractFactory("MockToken")).attach(scxAddress);
  const eyeInstance = (await ethers.getContractFactory("MockToken")).attach(eyeAddress);
  const daiInstance = (await ethers.getContractFactory("MockToken")).attach(daiAddress);
  const wethInstance = (await ethers.getContractFactory("MockToken")).attach(wethAddress);
  logger("about to get total supply of scx");
  const totalSupply = await scxInstance.totalSupply();
  logger("total scx supply " + totalSupply);
  logger("about to get scx balance, scx address: " + scxAddress);
  const scxBalance = (await scxInstance.balanceOf(deployer.address)) as BigNumber;
  await pauser();
  logger("scxbalance: " + scxBalance);
  const seedAmount = scxBalance.div(5);

  const tokenAmount = parseEther("2");

  const EYEDAIBalance = await EYEDAI.balanceOf(deployer.address);
  await pauser();
  const SCXWETHBalance = await SCXWETH.balanceOf(deployer.address);
  await pauser();
  const EYESCXBalance = await EYESCX.balanceOf(deployer.address);
  await pauser();
  logger([EYEDAIBalance.toString(), SCXWETHBalance.toString(), EYESCXBalance.toString()]);
  if (EYEDAIBalance.eq(0)) {
    logger("eyedai");
    await broadcast("eye transfer", eyeInstance.transfer(EYEDAI.address, tokenAmount, await getNonce()), pauser);

    await broadcast("dai transfer", daiInstance.transfer(EYEDAI.address, tokenAmount, await getNonce()), pauser);

    await broadcast("eyedai mint", EYEDAI.mint(deployer.address, await getNonce()), pauser);
  }

  if (SCXWETHBalance.eq(0)) {
    logger("scxweth");
    const wethbalance = await wethInstance.balanceOf(deployer.address);
    await pauser();
    logger("WETH balance: " + wethbalance);
    logger(`transferring ${wethbalance.div(5).toString()} weth and ${seedAmount.toString()} scx`);
    await broadcast(
      "weth transfer",
      wethInstance.transfer(SCXWETH.address, wethbalance.div(5), await getNonce()),
      pauser
    );

    await broadcast("scx transfer", scxInstance.transfer(SCXWETH.address, seedAmount, await getNonce()), pauser);

    const balanceOfWeth = await wethInstance.balanceOf(SCXWETH.address);
    await pauser();
    logger("WETH balance: " + balanceOfWeth);

    const balanceOfScx = await scxInstance.balanceOf(SCXWETH.address);
    await pauser();
    logger("SCX balance: " + balanceOfScx);

    await broadcast("scxweth mint", SCXWETH.mint(deployer.address, await getNonce()), pauser);
  }

  if (EYESCXBalance.eq(0)) {
    logger("eyescx");
    await broadcast("scx transfer", scxInstance.transfer(EYESCX.address, seedAmount, await getNonce()), pauser);

    await broadcast("eye transfer", eyeInstance.transfer(EYESCX.address, tokenAmount, await getNonce()), pauser);
    await pauser();
    await broadcast("eyescx mint", EYESCX.mint(deployer.address, await getNonce()), pauser);
  }
}

export async function deployBehodler(deployer: SignerWithAddress, pauser: Function): Promise<OutputAddress> {
  const AddressBalanceCheck = await ethers.getContractFactory("AddressBalanceCheck");
  const ABDK = await ethers.getContractFactory("ABDK");
  const addressBalanceCheckDeployment = await deploy("AddressBalaneCheck", AddressBalanceCheck, pauser, [], true);
  logger("address balance check");
  const addressBalanceCheckAddress = addressBalanceCheckDeployment.address;
  const BehodlerLite = await ethers.getContractFactory("BehodlerLite", {
    libraries: { AddressBalanceCheck: addressBalanceCheckAddress },
  });

  const behodlerLite = await deploy("Behodler", BehodlerLite, pauser, []);
  await pauser();
  logger("about to wait for behodler");
  const addresses: OutputAddress = {};
  addresses["behodler"] = behodlerLite.address;
  addresses["addressBalanceCheck"] = addressBalanceCheckAddress;
  return addresses;
}

export async function mintOnBehodler(
  deployer: SignerWithAddress,
  tokens: OutputAddress,
  addressBalanceCheckAddress: string,
  lachesisAddress: string,
  pauser: Function
) {
  logger("minting on behodler, lachesis: " + lachesisAddress);
  const behodlerFactory = await ethers.getContractFactory("BehodlerLite", {
    libraries: { AddressBalanceCheck: addressBalanceCheckAddress },
  });
  logger("behodler loaded");
  logger("             ");
  const behodler = behodlerFactory.attach(tokens["SCX"]);
  // let scxBalance = await behodler.balanceOf(deployer.address);
  // await pauser();
  // if (scxBalance.gt(0)) {
  //   logger("scx already minted");
  //   return;
  // }

  const LachesisFactory = await ethers.getContractFactory("LachesisLite");
  const lachesis = await LachesisFactory.attach(lachesisAddress);
  await pauser();
  const tokenKeys = Object.keys(tokens).filter((t) => t.toLowerCase() !== "scx");
  const Token: ContractFactory = await ethers.getContractFactory("MockToken");
  logger("about to loop");
  for (let i = 0; i < tokenKeys.length; i++) {
    logger("i: " + i);
    logger(tokenKeys[i]);
    let token = tokenKeys[i];
    const tokenAddress = tokens[token];
    logger("token address: " + tokenAddress);
    logger("lachesis: " + lachesis.address);
    const config = await lachesis.cut(tokenAddress);
    await pauser();
    logger("pause complete");
    logger("valid: " + config[0]);
    if (!config[0]) {
      await broadcast(
        "lachesis measure " + token,
        lachesis.measure(tokenAddress, true, false, await getNonce()),
        pauser
      );
      await pauser();
      await broadcast("update behodler " + token, lachesis.updateBehodler(tokenAddress, await getNonce()), pauser);
      await pauser();
    }
    const amount = token === "WETH" ? "1" : "40";

    const tokenInstance = Token.attach(tokenAddress);
    const balanceOnBehodler = await tokenInstance.balanceOf(behodler.address);
    await pauser();
    if (!balanceOnBehodler.eq(0)) {
      logger("behodler already has liquidity for " + tokenKeys[i]);
      continue;
    }
    await broadcast(
      "approve behodler",
      tokenInstance.approve(behodler.address, parseEther(amount), await getNonce()),
      pauser
    );

    await broadcast(
      "add liquidity to behodler",
      behodler.addLiquidity(tokenAddress, parseEther(amount), await getNonce()),
      pauser
    );
    await pauser();
  }
  logger("behodler minting complete");
}
