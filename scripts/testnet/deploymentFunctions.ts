import { ethers, network } from "hardhat";
import { id, parseEther } from "ethers/lib/utils";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { BigNumber, Contract, ContractFactory } from "ethers";
import { OutputAddress, logFactory, deploy, getTXCount, getNonce, broadcast, OutputAddressAdder } from "./common";
type address = string;
const nullAddress = "0x0000000000000000000000000000000000000000";
import * as Types from "../../typechain";

const logger = logFactory(true);

export async function deployMultiCall(pauser: Function): Promise<OutputAddress> {
  const Multicall = await ethers.getContractFactory("Multicall");
  const multicall = await deploy<Types.Multicall>("Multicall", Multicall, pauser, []);
  return OutputAddressAdder<Types.Multicall>({} as OutputAddress, "multicall", multicall)
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
  const lachesis: Types.LachesisLite = await LachesisFactory.attach(lachesisAddress) as Types.LachesisLite;

  const BehodlerFactory = await ethers.getContractFactory("BehodlerLite", {
    libraries: { AddressBalanceCheck: addressBalanceCheckAddress },
  });
  const behodler: Types.BehodlerLite = await BehodlerFactory.attach(behodlerAddress) as Types.BehodlerLite;

  const LimboFactory = await ethers.getContractFactory("Limbo", {
    libraries: {
      SoulLib: limboLibraries[0],
      CrossingLib: limboLibraries[1],
      MigrationLib: limboLibraries[2],
    },
  });
  const limbo = await LimboFactory.attach(limboAddress) as Types.Limbo;

  const Angband = await ethers.getContractFactory("Angband");
  const angband = await deploy<Types.Angband>("angband", Angband, pauser, []);
  const LimboAddTokenToBehodlerPower = await ethers.getContractFactory("LimboAddTokenToBehodlerTestNet");
  const limboAddTokenToBehodlerPower = await deploy<Types.LimboAddTokenToBehodlerTestNet>("LimboPower", LimboAddTokenToBehodlerPower, pauser, [
    angband.address,
    behodler.address,
    lachesis.address,
    limbo.address,
  ]);


  let addresses = OutputAddressAdder<Types.Angband>({} as OutputAddress, "angband", angband)
  return OutputAddressAdder<Types.LimboAddTokenToBehodlerTestNet>(addresses, "limboAddTokenToBehodlerPower", limboAddTokenToBehodlerPower)
}

export async function deploySoulReader(pauser: Function): Promise<OutputAddress> {
  const SoulReader = await ethers.getContractFactory("SoulReader");
  const soulReader = await deploy<Types.SoulReader>("SoulReader", SoulReader, pauser, []);
  return OutputAddressAdder<Types.SoulReader>({}, "soulReader", soulReader);
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
    libraries: {},
  });
  const dao = await LimboDAOFactory.attach(daoAddress) as Types.LimboDAO;

  const LimboFactory = await ethers.getContractFactory("Limbo", {
    libraries: {
      SoulLib: limboLibraries[0],
      CrossingLib: limboLibraries[1],
      MigrationLib: limboLibraries[2],
    },
  });
  const limbo = await LimboFactory.attach(limboAddress) as Types.Limbo;

  const UniswapHelperFactory = await ethers.getContractFactory("UniswapHelper");
  const uniswapHelper = await UniswapHelperFactory.attach(uniswapHelperAddress) as Types.UniswapHelper;
  const MockMorgothTokenApprover = await ethers.getContractFactory("MockMorgothTokenApprover");
  const mockMorgothTokenApprover = await deploy<Types.MockMorgothTokenApprover>("MockMorgothTokenApprover", MockMorgothTokenApprover, pauser, []);

  const WhiteList = await ethers.getContractFactory("ToggleWhitelistProposalProposal");
  const whiteList = await deploy<Types.ToggleWhitelistProposalProposal>("WhiteList", WhiteList, pauser, [dao.address, "WhiteListProposal"]);

  const UpdateMultipleSoulConfigProposal = await ethers.getContractFactory("UpdateMultipleSoulConfigProposal");
  const updateMultipleSoulConfigProposal = await deploy<Types.UpdateMultipleSoulConfigProposal>(
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
  const proposalFactory = await deploy<Types.ProposalFactory>("ProposalFactory", ProposalFactory, pauser, [
    dao.address,
    whiteList.address,
    updateMultipleSoulConfigProposal.address,
  ]);

  let addressList = OutputAddressAdder<Types.ProposalFactory>({}, "proposalFactory", proposalFactory)
  addressList = OutputAddressAdder<Types.ToggleWhitelistProposalProposal>(addressList, "whiteList", whiteList)
  addressList = OutputAddressAdder<Types.UpdateMultipleSoulConfigProposal>(addressList, "updateMultipleSoulConfigProposal", updateMultipleSoulConfigProposal)
  addressList = OutputAddressAdder<Types.MockMorgothTokenApprover>(addressList, "mockMorgothTokenApprover", mockMorgothTokenApprover)
  return addressList;
}

export async function deployLimbo(
  deployer: SignerWithAddress,
  flan: string,
  dai: string,
  behodler: string,
  daoAddress: string,
  uniswapRouter: string,
  chainId: number,
  pauser: Function
): Promise<OutputAddress> {
  const daoFactory: ContractFactory = await ethers.getContractFactory("LimboDAO", {
    libraries: {},
  });
  const dao = await daoFactory.attach(daoAddress) as Types.LimboDAO;
  const SoulLib = await ethers.getContractFactory("SoulLib");
  const CrossingLib = await ethers.getContractFactory("CrossingLib");
  const MigrationLib = await ethers.getContractFactory("MigrationLib");

  const soulLib = await deploy<Types.SoulLib>("SoulLib", SoulLib, pauser, []);
  const crossingLib = await deploy("CrossingLib", CrossingLib, pauser, []);
  const migrationLib = await deploy("MigrationLib", MigrationLib, pauser, []);

  const Limbo = await ethers.getContractFactory("Limbo", {
    libraries: {
      SoulLib: soulLib.address,
      CrossingLib: crossingLib.address,
      MigrationLib: migrationLib.address,
    },
  });

  const limbo = await deploy<Types.Limbo>("Limbo", Limbo, pauser, [flan, dao.address]);

  const UniswapHelper = await ethers.getContractFactory("UniswapHelper");
  const uniswapHelper = await deploy<Types.UniswapHelper>("UNi helper", UniswapHelper, pauser, [limbo.address, dao.address]);

  const FlanFactory = await ethers.getContractFactory("Flan");
  const flanInstance = await FlanFactory.attach(flan) as Types.Flan;

  await broadcast("white list limbo", flanInstance.whiteListMinting(limbo.address, true, await getNonce()), pauser);
  await broadcast("white list dao", flanInstance.whiteListMinting(daoAddress, true, await getNonce()), pauser);
  await broadcast(
    "white list uniswap helper",
    flanInstance.whiteListMinting(uniswapHelper.address, true, await getNonce()),
    pauser
  );

  await broadcast("set dai", uniswapHelper.setDAI(dai, await getNonce()), pauser);

  const oracle = await deployOracle(deployer,
    chainId,
    uniswapRouter,
    dao.address,
    dai,
    flan,
    behodler,
    pauser)

  await broadcast(
    "configure uniswaphelper",
    uniswapHelper.configure(limbo.address, behodler, flan, 3, oracle.address, await getNonce()),
    pauser
  );


  let addressList: OutputAddress = OutputAddressAdder<Types.Limbo>({}, "limbo", limbo);
  addressList = OutputAddressAdder<Types.UniswapHelper>(addressList, "uniswapHelper", uniswapHelper)
  addressList = OutputAddressAdder<Types.SoulLib>(addressList, "soulLib", soulLib)
  addressList = OutputAddressAdder(addressList, "crossingLib", crossingLib)
  addressList = OutputAddressAdder(addressList, "migrationLib", migrationLib)
  addressList = OutputAddressAdder(addressList, "uniswapOracle", oracle)
  return addressList;
}

async function deployOracle(
  deployer: SignerWithAddress,
  chainId: number,
  uniswapRouter: string,
  limboDAO: address,
  dai: string,
  flan: string,
  behodler: string,
  pauser: Function
): Promise<Types.LimboOracle> {

  const UniswapV2RouterFactory = await ethers.getContractFactory("UniswapV2Router02")
  const uniRouter = await UniswapV2RouterFactory.attach(uniswapRouter) as Types.UniswapV2Router02

  const UniswapV2FactoryFactory = await ethers.getContractFactory("UniswapV2Factory")
  const uniswapFactory = UniswapV2FactoryFactory.attach(await uniRouter.factory()) as Types.UniswapV2Factory

  const LimboOracleFactory = await ethers.getContractFactory("LimboOracle")
  const limboOracle = await deploy<Types.LimboOracle>("limboOracle", LimboOracleFactory,
    pauser, uniswapFactory.address, limboDAO)

  const getUniPair = pairGetter(uniswapFactory.address, chainId, pauser)
  const fln_scx = await getUniPair(flan, behodler)//For mainnet: liquidity would exist from genesis event
  const dai_scx = await getUniPair(dai, behodler) //For mainnet: Needs to be pre-seeded. Genesis contract will need to seeded with Dai
  const scx__fln_scx = await getUniPair(behodler, fln_scx.address)//For mainnet: liquidity would exist from genesis event

  if (chainId !== 1) {
    const ERC20Factory = await ethers.getContractFactory("ERC20")
    const flanToken = await ERC20Factory.attach(flan) as Types.ERC20
    const scxToken = await ERC20Factory.attach(behodler) as Types.ERC20
    const daiToken = await ERC20Factory.attach(dai) as Types.ERC20

    const ONE = ethers.constants.WeiPerEther

    //Liquidity for scx/fln
    await flanToken.transfer(fln_scx.address, ONE.mul(5000))
    await scxToken.transfer(fln_scx.address, ONE.mul(30))
    await fln_scx.mint(deployer.address)

    //Liquidity for dai/scx
    await scxToken.transfer(dai_scx.address, ONE.mul(30))
    await daiToken.transfer(dai_scx.address, ONE.mul(5000))
    await dai_scx.mint(deployer.address)

    //Liquidity for scx__fln_scx
    await scxToken.transfer(scx__fln_scx.address, ONE.mul(30))
    const balance = await fln_scx.balanceOf(deployer.address);
    await fln_scx.transfer(scx__fln_scx.address, balance.div(2));
    await scx__fln_scx.mint(deployer.address)

    /*execute a trade on each pair to give the oracle some fuel
    1. To call low level pair swap, we need order of tokens. Need unirouter
    2. transfer one token in and call swap correctly.
    3. Only minimal amounts needed.
    */
    //Note on debug: FOT might be knocking things

    //Trade scx for flan
    let [token0, _] = await limboOracle.uniSort(scxToken.address, flanToken.address)
    const flanBought = await uniRouter.quote(ONE.div(10), ONE.mul(30), ONE.mul(5000))
    await scxToken.transfer(fln_scx.address, ONE.div(10))
    if (token0 == scxToken.address) {
      await fln_scx.swap(0, flanBought, deployer.address, [])
    } else {
      await fln_scx.swap(flanBought, 0, deployer.address, [])
    }

    //Trade scx for dai
    [token0, _] = await limboOracle.uniSort(scxToken.address, daiToken.address)
    const daiBought = await uniRouter.quote(ONE.div(10), ONE.mul(30), ONE.mul(5000))
    await scxToken.transfer(dai_scx.address, ONE.div(10))
    if (token0 == scxToken.address) {
      await dai_scx.swap(0, daiBought, deployer.address, [])
    } else {
      await dai_scx.swap(daiBought, 0, deployer.address, [])
    }

    //Trade scx for fln_scx
    [token0, _] = await limboOracle.uniSort(scxToken.address, fln_scx.address)
    const fln_scxBought = await uniRouter.quote(ONE.div(10), ONE.mul(30), balance.div(2))
    await scxToken.transfer(dai_scx.address, ONE.div(10))
    if (token0 == scxToken.address) {
      await scx__fln_scx.swap(0, fln_scxBought, deployer.address, [])
    } else {
      await scx__fln_scx.swap(fln_scxBought, 0, deployer.address, [])
    }

  } else {
    //if no existing liquidity, throw
    if ((await fln_scx.totalSupply()) === BigNumber.from(0)) {
      throw "Fln_SCX pair has no liquidity"
    }
    if ((await dai_scx.totalSupply()) === BigNumber.from(0)) {
      throw "DAI_SCX pair has no liquidity"
    }

    if ((await scx__fln_scx.totalSupply()) === BigNumber.from(0)) {
      throw "SCX__FLN_SCX pair has no liquidity"
    }
  }
  //updating oracle not necessary as both UniHelper.migrate and DAO.stake update first 

  const period = 43200 // 12 hours
  await limboOracle.RegisterPair(fln_scx.address, period)
  await limboOracle.RegisterPair(dai_scx.address, period)
  await limboOracle.RegisterPair(scx__fln_scx.address, period)

  return limboOracle
}



function pairGetter(factory: string, chainId: number, pauser: Function) {
  return async function (token1: string, token2: string): Promise<Types.UniswapV2Pair> {
    const UniswapV2FactoryFactory = await ethers.getContractFactory("UniswapV2Factory")
    const uniFactory = await UniswapV2FactoryFactory.attach(factory) as Types.UniswapV2Factory

    const UniswapV2Pair = await ethers.getContractFactory("UniswapV2Pair")
    const isNullPair = async (): Promise<boolean> => await uniFactory.getPair(token1, token2) === nullAddress
    if (await isNullPair()) {
      if (chainId === 1) {
        throw (`CATASTROPHIC ERROR: Exiting migration because key pair does not exist: (${token1},${token2})`)
      }
      await broadcast(`uniPair:(${token1},${token2})`, uniFactory.createPair(token1, token2), pauser)
      if (await isNullPair()) {
        throw ('Uniswap pair creation failed')
      }
    }
    return UniswapV2Pair.attach(await uniFactory.getPair(token1, token2)) as Types.UniswapV2Pair
  }
}

export async function seedLimboDAO(
  daoAddress: string,
  limbo: address,
  flan: address,
  eye: address,
  proposalFactory: address,
  uniOracle: address,
  uniLPs: address[],
  pauser: Function
) {
  const LimboDAOFactory = await ethers.getContractFactory("LimboDAO", {
    libraries: {},
  });
  const dao = await LimboDAOFactory.attach(daoAddress) as Types.LimboDAO;
  await pauser();
  await dao.seed(limbo, flan, eye, proposalFactory, nullAddress, uniOracle, [], uniLPs);
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
  const limbo = await LimboFactory.attach(limboAddress) as Types.Limbo;
  await broadcast(
    "configure crossing",
    limbo.configureCrossingConfig(
      behodler,
      angband,
      ammHelper,
      morgothPower,
      migrationInvocationReward,
      crossingMigrationDelay,
      await getNonce()
    ),
    pauser
  );
}

export async function deployTokens(deployer: SignerWithAddress, pauser: Function): Promise<OutputAddress> {
  const Token = await ethers.getContractFactory("MockToken");
  const eye = await deploy<Types.MockToken>("EYE", Token, pauser, ["EYE", "EYE", [], []]);
  const maker = await deploy<Types.MockToken>("MKR", Token, pauser, ["MAKER", "MKR", [], []]);
  const oxt = await deploy<Types.MockToken>("OXT", Token, pauser, ["OXT", "OXT", [], []]);
  const pnk = await deploy<Types.MockToken>("PNK", Token, pauser, ["PNK", "PNK", [], []]);
  const link = await deploy<Types.MockToken>("LNK", Token, pauser, ["LINK", "LINK", [], []]);
  const weidai = await deploy<Types.MockToken>("WeiDai", Token, pauser, ["WEIDAI", "WDAI", [], []]);
  const loom = await deploy<Types.MockToken>("LOOM", Token, pauser, ["LOOM", "LOOM", [], []]);
  const dai = await deploy<Types.MockToken>("DAI", Token, pauser, ["DAI", "DAI", [], []]);
  let tokens: OutputAddress = OutputAddressAdder<Types.MockToken>({}, "EYE", eye);
  tokens = OutputAddressAdder<Types.MockToken>(tokens, "EYE", eye);
  tokens = OutputAddressAdder<Types.MockToken>(tokens, "MAKER", maker);
  tokens = OutputAddressAdder<Types.MockToken>(tokens, "OXT", oxt);
  tokens = OutputAddressAdder<Types.MockToken>(tokens, "PNK", pnk);
  tokens = OutputAddressAdder<Types.MockToken>(tokens, "LINK", link);
  tokens = OutputAddressAdder<Types.MockToken>(tokens, "WEIDAI", weidai);
  tokens = OutputAddressAdder<Types.MockToken>(tokens, "LOOM", loom);
  tokens = OutputAddressAdder<Types.MockToken>(tokens, "DAI", dai);
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
    libraries: {},
  });

  const dao = await LimboDAOFactory.attach(daoAddress) as Types.LimboDAO;

  const LachesisFactory = await ethers.getContractFactory("LachesisLite");
  const lachesis = await LachesisFactory.attach(lachesisAddress) as Types.LachesisLite;

  const BehodlerFactory = await ethers.getContractFactory("BehodlerLite", {
    libraries: { AddressBalanceCheck: addressBalanceCheckAddress },
  });
  const behodler = await BehodlerFactory.attach(behodlerAddress) as Types.BehodlerLite;

  const UniswapFactory = await ethers.getContractFactory("UniswapV2Factory");
  const uniswapFactory = await UniswapFactory.attach(uniswapFactoryAddress) as Types.UniswapV2Factory;

  const LiquidityReceiverFactory = await ethers.getContractFactory("LiquidityReceiver");
  const liquidityReceiver = await LiquidityReceiverFactory.attach(liquidityReceiverAddress) as Types.LiquidityReceiver;

  const Flan = await ethers.getContractFactory("Flan");
  const flan = await deploy<Types.Flan>("Flan", Flan, pauser, [dao.address]);

  await broadcast("lachesis measure", lachesis.measure(flan.address, true, false, await getNonce()), pauser);

  await broadcast("lachesis update behodler", lachesis.updateBehodler(flan.address, await getNonce()), pauser);

  await broadcast(
    "registerPyro",
    liquidityReceiver.registerPyroToken(flan.address, "PyroFlan", "PyroFLN", 18, await getNonce()),
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
  const flanSCXPair = UniswapPair.attach(flanSCX) as Types.UniswapV2Pair;

  await broadcast("flanSCXPair mint", flanSCXPair.mint(deployer.address, await getNonce()), pauser);
  let addressList: OutputAddress = OutputAddressAdder<Types.Flan>({}, "FLAN", flan);
  addressList = OutputAddressAdder<Types.UniswapV2Pair>(addressList, "flanSCX", flanSCXPair)
  return addressList;
}

//for hardhat only. In otherwords, on non persist.
export async function deployFakeTokens(pauser: Function): Promise<OutputAddress> {
  const MockTokenFactory = await ethers.getContractFactory("MockToken");
  const Aave = await deploy<Types.MockToken>("LimboMigrationToken1", MockTokenFactory, pauser, ["Aave", "Aave", [], []]);
  const Sushi = await deploy<Types.MockToken>("LimboMigrationToken2", MockTokenFactory, pauser, ["Sushi", "SUSHI", [], []]);
  const Mana = await deploy<Types.MockToken>("LimboMigrationToken3", MockTokenFactory, pauser, ["Mana", "MANA", [], []]);
  const Uni = await deploy<Types.MockToken>("LimboMigrationToken4", MockTokenFactory, pauser, ["Uni", "UNI", [], []]);
  const ENS = await deploy<Types.MockToken>("LimboMigrationToken5", MockTokenFactory, pauser, ["ENS", "ENS", [], []]);

  let addresses: OutputAddress = OutputAddressAdder<Types.MockToken>({}, "LimboMigrationToken1", Aave)
  addresses = OutputAddressAdder<Types.MockToken>(addresses, "LimboMigrationToken2", Sushi)
  addresses = OutputAddressAdder<Types.MockToken>(addresses, "LimboMigrationToken3", Mana)
  addresses = OutputAddressAdder<Types.MockToken>(addresses, "LimboMigrationToken4", Uni)
  addresses = OutputAddressAdder<Types.MockToken>(addresses, "LimboMigrationToken5", ENS)
  return addresses;
}
export async function deployLimboDAO(
  deployer: SignerWithAddress,
  eyeAddress: string,
  pauser: Function
): Promise<OutputAddress> {

  const LimboDAO = await ethers.getContractFactory("LimboDAO", {

  });
  const dao = await deploy<Types.LimboDAO>("LimboDAO", LimboDAO, pauser, []);
  const FlashGovernanceArbiter = await ethers.getContractFactory("FlashGovernanceArbiter");
  const flashGovernanceArbiter = await deploy<Types.FlashGovernanceArbiter>("FlashGovArb", FlashGovernanceArbiter, pauser, [dao.address]);
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
  let addressList: OutputAddress = OutputAddressAdder<Types.LimboDAO>({}, "dao", dao);
  addressList = OutputAddressAdder<Types.FlashGovernanceArbiter>(addressList, "flashGovernanceArbiter", flashGovernanceArbiter)
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

  const LachesisLite = await ethers.getContractFactory("LachesisLite");
  const lachesis = await deploy<Types.LachesisLite>("Lachesis", LachesisLite, pauser, [], true);
  logger("lachesis address at deployment " + lachesis.address); //0x147396210d38d88B5CDC605F7f60E90d0550771e
  let addressList = OutputAddressAdder<Types.LachesisLite>({}, "lachesis", lachesis)


  const behodlerAddress = tokens["SCX"];
  const BehodlerFactory = await ethers.getContractFactory("BehodlerLite", {
    libraries: { AddressBalanceCheck: addressBalanceCheckAddress },
  });
  const behodler = await BehodlerFactory.attach(behodlerAddress) as Types.BehodlerLite;

  await broadcast("set lachesis", behodler.setLachesis(lachesis.address, await getNonce()), pauser);
  await pauser();
  await broadcast("set behodler", lachesis.setBehodler(behodler.address, await getNonce()), pauser);

  const LiquidityReceiver = await ethers.getContractFactory("LiquidityReceiver");
  //0xFB13c8ad2303F98F80931D06AFd1607744327F99
  const liquidityReceiver = await deploy<Types.LiquidityReceiver>("LiquidityReceiver", LiquidityReceiver, pauser, [lachesis.address]);
  addressList = OutputAddressAdder<Types.LiquidityReceiver>(addressList, "liquidityReceiver", liquidityReceiver)
  const tokenKeys = Object.keys(tokens);
  logger("creating pyrotokens");
  for (let i = 0; i < tokenKeys.length; i++) {
    if (tokenKeys[i].toLowerCase() === "scx") continue;
    const address = tokens[tokenKeys[i]];
    const pyrotokenAddress = await liquidityReceiver.getPyroToken(address);
    await pauser();
    logger("pyroTokenAddress: " + pyrotokenAddress);
    const TokenFactory = await ethers.getContractFactory("MockToken");
    const pyroToken = await TokenFactory.attach(pyrotokenAddress) as Types.MockToken;

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
          18,
          await getNonce()
        ),
        pauser
      );
    }
  }
  const eyeAddress = tokens["EYE"];
  const SnufferCap = await ethers.getContractFactory("BurnEYESnufferCap");

  const snufferCap = await deploy<Types.BurnEYESnufferCap>("SnufferCap", SnufferCap, pauser, [eyeAddress, liquidityReceiver.address]);
  addressList = OutputAddressAdder<Types.SnufferCap>(addressList, "snufferCap", snufferCap);
  await broadcast("set snuffer cap", liquidityReceiver.setSnufferCap(snufferCap.address, await getNonce()), pauser);
  return addressList;
}

export async function deployWeth(
  deployer: SignerWithAddress,
  liquidityReceiverAddress: string,
  lachesisAddress: string,
  pauser: Function
): Promise<OutputAddress> {
  let addressList: OutputAddress = {};
  const LiquidityReceiverFactory: ContractFactory = await ethers.getContractFactory("LiquidityReceiver");
  const liquidityReceiver = await LiquidityReceiverFactory.attach(liquidityReceiverAddress) as Types.LiquidityReceiver;

  const LachesisFactory: ContractFactory = await ethers.getContractFactory("LachesisLite");
  const lachesis = await LachesisFactory.attach(lachesisAddress) as Types.LachesisLite;
  const Weth = await ethers.getContractFactory("WETH10");
  const weth = await deploy<Types.WETH10>("WETH", Weth, pauser);
  await broadcast("weth deposit", weth.deposit({ value: parseEther("2"), nonce: await getTXCount(deployer) }), pauser);
  addressList = OutputAddressAdder<Types.WETH10>(addressList, "WETH", weth);

  await broadcast("lachesis measure weth", lachesis.measure(weth.address, true, false, await getNonce()), pauser);

  await broadcast("lachesis update behodler", lachesis.updateBehodler(weth.address, await getNonce()), pauser);

  await broadcast(
    "register pyroweth",
    liquidityReceiver.registerPyroToken(weth.address, "PyroWETH", "KPyroWETH", 18, await getNonce()),
    pauser
  );

  const pyroWethAddress = await liquidityReceiver.getPyroToken(weth.address);
  await pauser();

  logger("pyroWeth: " + pyroWethAddress);
  const PyroWeth10Proxy = await ethers.getContractFactory("PyroWeth10Proxy");

  const proxy = await deploy<Types.PyroWeth10Proxy>("PYROWETH10Proxy", PyroWeth10Proxy, pauser, [pyroWethAddress], true);
  logger("PyroWeth10Proxy" + proxy.address);
  addressList = OutputAddressAdder<Types.PyroWeth10Proxy>(addressList, "proxy", proxy);

  await broadcast("weth approve", weth.approve(proxy.address, parseEther("10000"), await getNonce()), pauser);
  return addressList;
}

async function uniclone(
  deployer: SignerWithAddress,
  tokenAddresses: OutputAddress,
  recognizedTestNet: boolean,
  name: string,
  router: string,
  pauser: Function
): Promise<OutputAddress> {


  const daiAddress = tokenAddresses["DAI"];
  const eyeAddress = tokenAddresses["EYE"];
  const wethAddress = tokenAddresses["WETH"];

  const scxAddress = tokenAddresses["SCX"];

  const UniswapV2RouterFactory = await ethers.getContractFactory("UniswapV2Router02")
  const UniswapV2Factory = await ethers.getContractFactory("UniswapV2Factory");

  let uniswapRouter: Types.UniswapV2Router02
  let uniswapFactory: Types.UniswapV2Factory
  if (!recognizedTestNet) {
    logger("WARNING: NETWORK DETECTED NOT PUBLIC TESTNET");

    uniswapFactory = await deploy<Types.UniswapV2Factory>("UniV2Factry", UniswapV2Factory, pauser, [deployer.address]);
    uniswapRouter = await deploy<Types.UniswapV2Router02>("UniV2Router", UniswapV2RouterFactory, pauser, uniswapFactory.address, wethAddress)
  } else {
    uniswapRouter = await UniswapV2RouterFactory.attach(router) as Types.UniswapV2Router02
    uniswapFactory = await UniswapV2Factory.attach(await uniswapRouter.factory()) as Types.UniswapV2Factory
  }

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

  let EYEDAI = await pair.attach(eyeDaiAddress) as Types.UniswapV2Pair;
  let SCXWETH = await pair.attach(scxWethAddress) as Types.UniswapV2Pair;
  let EYESCX = await pair.attach(eyeScxAddress) as Types.UniswapV2Pair;
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

  EYEDAI = await pair.attach(eyeDaiAddress) as Types.UniswapV2Pair;
  SCXWETH = await pair.attach(scxWethAddress) as Types.UniswapV2Pair;
  EYESCX = await pair.attach(eyeScxAddress) as Types.UniswapV2Pair;

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
  let addressList = OutputAddressAdder<Types.UniswapV2Factory>({}, `${name}Factory`, uniswapFactory);
  addressList = OutputAddressAdder<Types.UniswapV2Router02>(addressList, `${name}Router`, uniswapRouter)
  addressList = OutputAddressAdder<Types.UniswapV2Pair>(addressList, "EYEDAI" + suffix, EYEDAI);
  addressList = OutputAddressAdder<Types.UniswapV2Pair>(addressList, "EYESCX" + suffix, EYESCX);
  addressList = OutputAddressAdder<Types.UniswapV2Pair>(addressList, "SCXWETH" + suffix, SCXWETH);
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
    "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
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
  const EYEDAI = (await ethers.getContractFactory("UniswapV2Pair")).attach(EYEDAIaddress) as Types.UniswapV2Pair;
  const SCXWETH = (await ethers.getContractFactory("UniswapV2Pair")).attach(SCXWETHaddress) as Types.UniswapV2Pair;
  const EYESCX = (await ethers.getContractFactory("UniswapV2Pair")).attach(EYESCXaddress) as Types.UniswapV2Pair;

  const scxInstance = (await ethers.getContractFactory("MockToken")).attach(scxAddress) as Types.MockToken;
  const eyeInstance = (await ethers.getContractFactory("MockToken")).attach(eyeAddress) as Types.MockToken;
  const daiInstance = (await ethers.getContractFactory("MockToken")).attach(daiAddress) as Types.MockToken;
  const wethInstance = (await ethers.getContractFactory("MockToken")).attach(wethAddress) as Types.MockToken;
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
  const addressBalanceCheckDeployment = await deploy<Types.AddressBalanceCheck>("AddressBalaneCheck", AddressBalanceCheck, pauser, [], true);
  logger("address balance check");
  const addressBalanceCheckAddress = addressBalanceCheckDeployment.address;
  const BehodlerLite = await ethers.getContractFactory("BehodlerLite", {
    libraries: { AddressBalanceCheck: addressBalanceCheckAddress },
  });

  const behodlerLite = await deploy<Types.BehodlerLite>("Behodler", BehodlerLite, pauser, []);
  await pauser();
  logger("about to wait for behodler");
  let addresses: OutputAddress = {};
  addresses = OutputAddressAdder<Types.BehodlerLite>(addresses, "behodler", behodlerLite);
  addresses = OutputAddressAdder<Types.AddressBalanceCheck>(addresses, "addressBalanceCheck", addressBalanceCheckDeployment)
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
  const behodler = behodlerFactory.attach(tokens["SCX"]) as Types.BehodlerLite;
  // let scxBalance = await behodler.balanceOf(deployer.address);
  // await pauser();
  // if (scxBalance.gt(0)) {
  //   logger("scx already minted");
  //   return;
  // }

  const LachesisFactory = await ethers.getContractFactory("LachesisLite");
  const lachesis = await LachesisFactory.attach(lachesisAddress) as Types.LachesisLite;
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

    const tokenInstance = Token.attach(tokenAddress) as Types.MockToken;
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
