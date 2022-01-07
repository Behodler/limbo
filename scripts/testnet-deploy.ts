import { ethers } from "hardhat";
import { parseEther } from "ethers/lib/utils";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { BigNumber, Contract } from "ethers";
import { write, writeFileSync } from "fs";
type address = string;
const nullAddress = "0x0000000000000000000000000000000000000000";

interface OutputAddress {
  address: address;
  name: string;
}

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

async function main() {
  let output: OutputAddress[] = [];
  const [deployer] = await ethers.getSigners();
  const network = await deployer.provider?.getNetwork();
  const isKovan = network?.chainId === 42;
  const behodler = await deployBehodler(deployer);
  output.push({ name: "behodler", address: behodler.address });

  const tokens = await deployTokens(deployer);
  tokens.push({ name: "scx", instance: behodler, burnable: true });
  output.push(...tokens.map((t) => ({ name: t.name, address: t.instance.address })));

  const [lachesis, liquidityReceiver, snufferCap] = await deployLiquidityReceiver(deployer, tokens, behodler);
  output.push({ name: "lachesis", address: lachesis.address });
  output.push({ name: "liquidityReceiver", address: liquidityReceiver.address });
  output.push({ name: "snufferCap", address: snufferCap.address });

  const [weth, proxy] = await deployWeth(deployer, liquidityReceiver, lachesis);
  output.push({ name: "weth", address: weth.address });
  output.push({ name: "proxy", address: proxy.address });

  await weth.deposit({ value: parseEther("4") });
  tokens.push({ name: "weth", instance: weth, burnable: false });
  await mintOnBehodler(behodler, tokens);
  const [uniswapFactory, EYEDAI, SCXWETH, EYESCX] = await deployUniswap(deployer, tokens, isKovan);
  output.push({ name: "uniswapFactory", address: uniswapFactory.address });
  output.push({ name: "EYEDAI", address: EYEDAI.address });
  output.push({ name: "SCXWETH", address: SCXWETH.address });
  output.push({ name: "EYESCX", address: EYESCX.address });

  const [dao, flashGovernanceArbiter] = await deployLimboDAO(
    deployer,
    tokens.filter((t) => t.name === "eye")[0].instance
  );
  output.push({ name: "dao", address: dao.address });
  output.push({ name: "flashGovernanceArbiter", address: flashGovernanceArbiter.address });

  const [flan, flanSCXPair] = await deployFlan(deployer, dao, lachesis, behodler, uniswapFactory, liquidityReceiver);
  output.push({ name: "flan", address: flan.address });
  output.push({ name: "flanSCXPair", address: flanSCXPair.address });

  const getToken = getTokenFactory(tokens);
  const dai = getToken("dai");
  const [limbo, uniswapHelper] = await deployLimbo(
    deployer,
    flan.address,
    flanSCXPair.address,
    dai.instance.address,
    behodler.address,
    dao
  );
  output.push({ name: "limbo", address: limbo.address });
  output.push({ name: "uniswapHelper", address: uniswapHelper.address });

  const [mockMorgothTokenApprover, whiteList, updateMultipleSoulConfigProposal, proposalFactory] =
    await deployProposalFactory(deployer, dao, limbo, uniswapHelper);
  output.push({ name: "mockMorgothTokenApprover", address: mockMorgothTokenApprover.address });
  output.push({ name: "whiteList", address: whiteList.address });
  output.push({ name: "updateMultipleSoulConfigProposal", address: updateMultipleSoulConfigProposal.address });
  output.push({ name: "proposalFactory", address: proposalFactory.address });

  await seedLimboDAO(
    dao,
    limbo.address,
    flan.address,
    getToken("eye").instance.address,
    proposalFactory.address,
    uniswapFactory.address,
    flashGovernanceArbiter.address,
    [EYEDAI.address, EYESCX.address]
  );

  const [angband, migrationPower] = await deployMorgothDAO(deployer, lachesis, behodler, limbo);

  output.push({ name: "angband", address: angband.address });
  output.push({ name: "migrationPower", address: migrationPower.address });

  await limbo.configureCrossingConfig(
    behodler.address,
    angband.address,
    uniswapHelper.address,
    migrationPower.address,
    500,
    300,
    0
  );

  const SoulReader = await ethers.getContractFactory("SoulReader");
  const soulReader = await SoulReader.deploy();
  output.push({ name: "soulReader", address: soulReader.address });
  printAddresses(output, network?.chainId);
}

function printAddresses(output: OutputAddress[], chainId?: number) {
  if (!chainId) {
    console.log("chainId not defined");
    return;
  }
  const name = (() => {
    switch (chainId) {
      case 42:
        return "kovan";
    }
  })();

  //TODO: deploy multicall
  writeFileSync(name + ".json", JSON.stringify(output, null, 2));
}

async function deployMorgothDAO(
  deployer: SignerWithAddress,
  lachesis: Contract,
  behodler: Contract,
  limbo: Contract
): Promise<Contract[]> {
  const Angband = await ethers.getContractFactory("Angband");
  const angband = await Angband.deploy();

  const LimboAddTokenToBehodlerPower = await ethers.getContractFactory("LimboAddTokenToBehodlerTestNet");
  const limboAddTokenToBehodlerPower = await LimboAddTokenToBehodlerPower.deploy(
    angband.address,
    lachesis.address,
    behodler.address,
    limbo.address
  );
  return [angband, limboAddTokenToBehodlerPower];
}

async function deployProposalFactory(
  deployer: SignerWithAddress,
  dao: Contract,
  limbo: Contract,
  uniswapHelper: Contract
): Promise<Contract[]> {
  const MockMorgothTokenApprover = await ethers.getContractFactory("MockMorgothTokenApprover");
  const mockMorgothTokenApprover = await MockMorgothTokenApprover.deploy();

  const WhiteList = await ethers.getContractFactory("ToggleWhitelistProposalProposal");
  const whiteList = await WhiteList.deploy(dao.address, "WhiteListProposal");

  const UpdateMultipleSoulConfigProposal = await ethers.getContractFactory("UpdateMultipleSoulConfigProposal");
  const updateMultipleSoulConfigProposal = await UpdateMultipleSoulConfigProposal.deploy(
    dao.address,
    "UpdateMultipleSoulConfigProposal",
    limbo.address,
    uniswapHelper.address,
    mockMorgothTokenApprover.address
  );

  const ProposalFactory = await ethers.getContractFactory("ProposalFactory");
  const proposalFactory = await ProposalFactory.deploy(
    dao.address,
    whiteList.address,
    updateMultipleSoulConfigProposal.address
  );

  return [mockMorgothTokenApprover, whiteList, updateMultipleSoulConfigProposal, proposalFactory];
}

async function deployLimbo(
  deployer: SignerWithAddress,
  flan: string,
  flanSCXPair: string,
  dai: string,
  behodler: string,
  dao: Contract
): Promise<Contract[]> {
  const SoulLib = await ethers.getContractFactory("SoulLib");
  const CrossingLib = await ethers.getContractFactory("CrossingLib");
  const MigrationLib = await ethers.getContractFactory("MigrationLib");
  const soulLib = await SoulLib.deploy();
  const crossingLib = await CrossingLib.deploy();
  const migrationLib = await MigrationLib.deploy();

  const Limbo = await ethers.getContractFactory("Limbo", {
    libraries: {
      SoulLib: soulLib.address,
      CrossingLib: crossingLib.address,
      MigrationLib: migrationLib.address,
    },
  });
  const limbo = await Limbo.deploy(flan, dao.address);

  const UniswapHelper = await ethers.getContractFactory("UniswapHelper");
  const uniswapHelper = await UniswapHelper.deploy(limbo.address, dao.address);
  await uniswapHelper.configure(limbo.address, flanSCXPair, behodler, flan, 180, 3, 20, 10);
  await uniswapHelper.setDAI(dai);

  return [limbo, uniswapHelper];
}

async function seedLimboDAO(
  dao: Contract,
  limbo: address,
  flan: address,
  eye: address,
  proposalFactory: address,
  uniswapFactory: address,
  flashGoverner: address,
  uniLPs: address[]
) {
  await dao.seed(limbo, flan, eye, proposalFactory, nullAddress, uniswapFactory, flashGoverner, 9, [], uniLPs);
}

async function deployTokens(deployer: SignerWithAddress): Promise<Token[]> {
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
  const eye = await Token.deploy("EYE", "EYE", [], []);
  const maker = await Token.deploy("MAKER", "MKR", [], []);
  const oxt = await Token.deploy("OXT", "OXT", [], []);
  const pnk = await Token.deploy("PNK", "PNK", [], []);
  const link = await Token.deploy("LINK", "LNK", [], []);
  const weidai = await Token.deploy("WEIDAI", "WDAI", [], []);
  const loom = await Token.deploy("LOOM", "Loom", [], []);
  const dai = await Token.deploy("DAI", "DAI", [], []);

  let tokens: Token[] = [];
  tokens.push({ name: "eye", instance: eye, burnable: true });
  tokens.push({ name: "maker", instance: maker, burnable: true });
  tokens.push({ name: "oxt", instance: oxt, burnable: false });
  tokens.push({ name: "pnk", instance: pnk, burnable: false });
  tokens.push({ name: "link", instance: link, burnable: false });
  tokens.push({ name: "weidai", instance: weidai, burnable: true });
  tokens.push({ name: "loom", instance: loom, burnable: false });
  tokens.push({ name: "dai", instance: dai, burnable: false });

  return tokens;
}

async function deployFlan(
  deployer: SignerWithAddress,
  dao: Contract,
  lachesis: Contract,
  behodler: Contract,
  uniswapFactory: Contract,
  liquidityReceiver: Contract
): Promise<Contract[]> {
  const Flan = await ethers.getContractFactory("Flan");
  const flan = await Flan.deploy(dao.address);
  await lachesis.measure(flan.address, true, false);
  await lachesis.updateBehodler(flan.address);

  await liquidityReceiver.registerPyroToken(flan.address, "PyroFlan", "PyroFLN");

  await flan.mint(deployer.address, parseEther("10"));
  await flan.approve(behodler.address, parseEther("100"));
  await behodler.addLiquidity(flan.address, parseEther("10"));
  const scxBalance = await behodler.balanceOf(deployer.address);

  await uniswapFactory.createPair(flan.address, behodler.address);

  const flanSCX = await uniswapFactory.getPair(flan.address, behodler.address);
  await behodler.transfer(flanSCX, scxBalance.div(4));
  await flan.mint(flanSCX, parseEther("200"));
  const UniswapPair = await ethers.getContractFactory("RealUniswapV2Pair");
  const flanSCXPair = UniswapPair.attach(flanSCX);
  await flanSCXPair.mint(deployer.address);

  return [flan, flanSCXPair];
}

async function deployLimboDAO(deployer: SignerWithAddress, eye: Contract): Promise<Contract[]> {
  const TransferHelper = await ethers.getContractFactory("TransferHelper");
  const transferHelper = await TransferHelper.deploy();
  const LimboDAO = await ethers.getContractFactory("LimboDAO", {
    libraries: { TransferHelper: transferHelper.address },
  });

  const dao = await LimboDAO.deploy();

  const FlashGovernanceArbiter = await ethers.getContractFactory("FlashGovernanceArbiter");
  const flashGovernanceArbiter = await FlashGovernanceArbiter.deploy(dao.address);
  await flashGovernanceArbiter.configureFlashGovernance(eye.address, parseEther("20000"), 86400, true);

  await flashGovernanceArbiter.configureSecurityParameters(2, 10000, 20);

  return [dao, flashGovernanceArbiter];
}

async function deployLiquidityReceiver(
  deployer: SignerWithAddress,
  tokens: Token[],
  behodler: Contract
): Promise<Contract[]> {
  const LachesisLite = await ethers.getContractFactory("LachesisLite");
  const lachesis = await LachesisLite.deploy();
  await lachesis.setBehodler(behodler.address);
  await behodler.setLachesis(lachesis.address);

  const LiquidityReceiver = await ethers.getContractFactory("LiquidityReceiver");
  const liquidityReceiver = await LiquidityReceiver.deploy(lachesis.address);
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].name === "scx") continue;
    await lachesis.measure(tokens[i].instance.address, true, tokens[i].burnable);
    await lachesis.updateBehodler(tokens[i].instance.address);
    if (!tokens[i].burnable) {
      await liquidityReceiver.registerPyroToken(
        tokens[i].instance.address,
        `Pyro${tokens[i].name}`,
        `KPyro${tokens[i].name.substring(2)}`
      );
    }
  }
  const getToken = getTokenFactory(tokens);

  const SnufferCap = await ethers.getContractFactory("BurnEYESnufferCap");
  const snufferCap = await SnufferCap.deploy(getToken("eye").instance.address, liquidityReceiver.address);

  await liquidityReceiver.setSnufferCap(snufferCap.address);
  return [lachesis, liquidityReceiver, snufferCap];
}

async function deployWeth(
  deployer: SignerWithAddress,
  liquidityReceiver: Contract,
  lachesis: Contract
): Promise<Contract[]> {
  const Weth = await ethers.getContractFactory("WETH10");
  const weth = await Weth.deploy();

  await lachesis.measure(weth.address, true, false);
  await lachesis.updateBehodler(weth.address);
  await liquidityReceiver.registerPyroToken(weth.address, "PyroWETH", "KPyroWETH");
  const pyroWethAddress = await liquidityReceiver.getPyroToken(weth.address);
  console.log("pyroWeth: " + pyroWethAddress);
  const PyroWeth10Proxy = await ethers.getContractFactory("PyroWeth10Proxy");

  const proxy = await PyroWeth10Proxy.deploy(pyroWethAddress);
  await weth.approve(proxy.address, parseEther("10000"));
  return [weth, proxy];
}

async function deployUniswap(deployer: SignerWithAddress, tokens: Token[], isKovan: boolean): Promise<Contract[]> {
  const UniswapV2Factory = await ethers.getContractFactory("RealUniswapV2Factory");
  if (!isKovan) {
    console.log("WARNING: NETWORK DETECTED NOT KOVAN");
  }
  const uniswapFactory = isKovan
    ? await UniswapV2Factory.attach("0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f")
    : await UniswapV2Factory.deploy(deployer.address);

  const getToken = getTokenFactory(tokens);

  const dai = getToken("dai");
  const eye = getToken("eye");
  const weth = getToken("weth");
  const scx = getToken("scx");

  await uniswapFactory.createPair(dai.instance.address, eye.instance.address);
  await uniswapFactory.createPair(weth.instance.address, scx.instance.address);
  await uniswapFactory.createPair(eye.instance.address, scx.instance.address);

  const pair = await ethers.getContractFactory("RealUniswapV2Pair");

  const EYEDAI = await pair.attach(await uniswapFactory.getPair(dai.instance.address, eye.instance.address));
  const SCXWETH = await pair.attach(await uniswapFactory.getPair(weth.instance.address, scx.instance.address));
  const EYESCX = await pair.attach(await uniswapFactory.getPair(eye.instance.address, scx.instance.address));

  const scxBalance = (await scx.instance.balanceOf(deployer.address)) as BigNumber;
  console.log("scxbalance: " + scxBalance);
  const seedAmount = scxBalance.div(5);

  const tokenAmount = parseEther("2");

  await eye.instance.transfer(EYEDAI.address, tokenAmount);
  await eye.instance.transfer(EYESCX.address, tokenAmount);

  await dai.instance.transfer(EYEDAI.address, tokenAmount);
  const wethbalance = await weth.instance.balanceOf(deployer.address);
  console.log("WETH balance: " + wethbalance);
  await weth.instance.transfer(SCXWETH.address, tokenAmount);

  await scx.instance.transfer(SCXWETH.address, seedAmount);
  await scx.instance.transfer(EYESCX.address, seedAmount);

  await EYEDAI.mint(deployer.address);
  console.log("scx amount: " + seedAmount);
  // await SCXWETH.mint(deployer.address);
  // await EYESCX.mint(deployer.address);

  return [uniswapFactory, EYEDAI, SCXWETH, EYESCX];
}

async function deployBehodler(deployer: SignerWithAddress): Promise<Contract> {
  //const openBehodler = await ethers.getContractFactory("AddressBalanceCheck")

  const AddressBalanceCheck = await ethers.getContractFactory("AddressBalanceCheck");
  const ABDK = await ethers.getContractFactory("ABDK");

  const addressBalanceCheckAddress = (await AddressBalanceCheck.deploy()).address;
  const abdkAddress = (await ABDK.deploy()).address;
  const BehodlerLite = await ethers.getContractFactory("BehodlerLite", {
    libraries: { AddressBalanceCheck: addressBalanceCheckAddress },
  });

  const behodlerLite = await BehodlerLite.deploy();

  return behodlerLite;
}

async function mintOnBehodler(behodler: Contract, tokens: Token[]) {
  await Promise.all(
    tokens
      .filter((t) => t.name !== "scx")
      .map(async (token) => {
        const amount = token.name === "weth" ? "1" : "40";
        await token.instance.approve(behodler.address, parseEther(amount));
        return behodler.addLiquidity(token.instance.address, parseEther(amount));
      })
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
