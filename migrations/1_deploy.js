const Limbo = artifacts.require("Limbo");
const TransferHelperLibrary = artifacts.require("TransferHelper");
const LimboDAO = artifacts.require("LimboDAO");
const Flan = artifacts.require("Flan");
const UniswapHelper = artifacts.require("UniswapHelper");
const ProposalFactory = artifacts.require("ProposalFactory");
const WhiteListProposal = artifacts.require("ToggleWhitelistProposalProposal");
const FlashGovernanceArbiter = artifacts.require("FlashGovernanceArbiter");
const SoulReader = artifacts.require("SoulReader");
const AddTokenPower = artifacts.require("LimboAddTokenToBehodler");
const Angband = artifacts.require("AngbandLite");
const AddressBalanceCheckLib = artifacts.require("AddressBalanceCheck");
const BehodlerLite = artifacts.require("BehodlerLite");
const UniswapFactory = artifacts.require("RealUniswapV2Factory");
const SushiswapFactory = artifacts.require("RealUniswapV2Factory");
const MockToken1 = artifacts.require("MockToken");
const MockToken2 = artifacts.require("MockToken");

module.exports = async function (deployer, network, accounts) {
  //deployments
  await deployer.deploy(TransferHelperLibrary);
  await deployer.link(TransferHelperLibrary, LimboDAO);

  await deployer.deploy(LimboDAO);
  const limboDAOInstance = await LimboDAO.deployed();

  await deployer.deploy(MockToken1, "aave", "aave", [], []);
  const aaveInstance = await MockToken1.deployed();

  await deployer.deploy(MockToken2, "DAI", "DAI", [], []);
  const daiInstance = await MockToken2.deployed();

  await deployer.deploy(MockToken2, "EYE", "EYE", [], []);
  const EyeInstance = await MockToken2.deployed();

  await deployer.deploy(FlashGovernanceArbiter, limboDAOInstance.address);
  const flashGovernanceInstance = await FlashGovernanceArbiter.deployed();
  await flashGovernanceInstance.configureSecurityParameters(10, 100, 30);

  await deployer.deploy(Flan, limboDAOInstance.address);
  const flanInstance = await Flan.deployed();

  await deployer.deploy(Limbo, flanInstance.address, limboDAOInstance.address);
  const limboInstance = await Limbo.deployed();

  await deployer.deploy(Angband);
  const angbandInstance = await Angband.deployed();

  await deployer.deploy(AddressBalanceCheckLib);
  await deployer.link(AddressBalanceCheckLib, BehodlerLite);
  await deployer.deploy(BehodlerLite);
  const behodlerInstance = await BehodlerLite.deployed();

  await deployer.deploy(
    AddTokenPower,
    angbandInstance.address,
    limboInstance.address,
    behodlerInstance.address
  );
  const powerInstance = await AddTokenPower.deployed();

  await deployer.deploy(UniswapFactory, accounts[0]);
  const uniswapFactoryInstance = await UniswapFactory.deployed();

  await deployer.deploy(SushiswapFactory, accounts[0]);
  const sushiswapFactoryInstance = await SushiswapFactory.deployed();

  await uniswapFactoryInstance.createPair(
    flanInstance.address,
    behodlerInstance.address
  );
  await deployer.deploy(SoulReader);
  const soulReaderInstance = await SoulReader.deployed();

  await deployer.deploy(
    UniswapHelper,
    limboInstance.address,
    limboDAOInstance.address
  );
  const uniswapHelperInstance = await UniswapHelper.deployed();

  await deployer.deploy(WhiteListProposal, limboDAOInstance.address, "toggle");
  const whiteListingProposalInstance = await WhiteListProposal.deployed();
  await deployer.deploy(
    ProposalFactory,
    limboDAOInstance.address,
    whiteListingProposalInstance.address
  );

  const proposalFactoryInstance = await ProposalFactory.deployed();

  //configuration
  await limboDAOInstance.seed(
    limboInstance.address,
    flanInstance.address,
    EyeInstance.address,
    proposalFactoryInstance.address,
    sushiswapFactoryInstance.address,
    uniswapFactoryInstance.address,
    flashGovernanceInstance.address,
    9,
    [],
    []
  );
  await limboDAOInstance.makeLive();

  const requiredFate = (await limboDAOInstance.proposalConfig())[1];
  console.log("required fate: " + requiredFate.toString());
  const bigRequire = BigInt(requiredFate.toString());
  await EyeInstance.mint(requiredFate);
  await EyeInstance.approve(limboDAOInstance.address, bigRequire * 2n);
  await limboDAOInstance.burnAsset(
    EyeInstance.address,
    (bigRequire * 5n) / 10n
  );


   await limboInstance.setDAO(limboDAOInstance.address);

  await limboInstance.configureCrossingConfig(
    behodlerInstance.address,
    angbandInstance.address,
    uniswapHelperInstance.address,
    powerInstance.address,
    6756,
    1000,
    111
  );
  await limboInstance.configureCrossingParameters(
    aaveInstance.address,
    1,
    1,
    true,
    10000010
  );

  await limboInstance.configureSoul(
    aaveInstance.address,
    100, //crossingThreshold
    1, //soulType
    0, //exitPenalty
    1, //state
    0,
    10000000
  );

  const pairaddress = await uniswapFactoryInstance.getPair(
    flanInstance.address,
    behodlerInstance.address
  );

  await uniswapHelperInstance.configure(
    limboInstance.address,
    pairaddress,
    behodlerInstance.address,
    flanInstance.address,
    200,
    105,
    3,
    20,
    0
  );
  await uniswapHelperInstance.setDAI(daiInstance.address);
  await uniswapHelperInstance.setFactory(uniswapFactoryInstance.address)

  await flanInstance.whiteListMinting(limboInstance.address, true);
  await flanInstance.whiteListMinting(accounts[0], true);
  await flanInstance.whiteListMinting(uniswapHelperInstance.address, true);
};
