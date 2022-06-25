// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;
import "./facades/BehodlerLike.sol";
import "./DAO/Governable.sol";
import "./openzeppelin/ERC20Burnable.sol";
import "./facades/FlanLike.sol";
import "./periphery/UniswapV2/interfaces/IUniswapV2Factory.sol";
import "./periphery/UniswapV2/interfaces/IUniswapV2Pair.sol";
import "./facades/AMMHelper.sol";
import "./facades/LimboOracleLike.sol";
// import "hardhat/console.sol";

contract BlackHole {}

///@Title Uniswap V2 helper for managing Flan liquidity on Uniswap V2, Sushiswap and any other compatible AMM
///@author Justin Goro
/**@notice Flan liquidity is boosted on Uniswap (or Sushiswap) via open market operations at the point of a token migration.
 * UniswapHelper handles all the mechanics as well managing a just-in-time (Justin Time?) oracle
 */
contract UniswapHelper is Governable, AMMHelper {
  address limbo;
  uint256 constant SPOT = 1e8;
  struct OracleSet {
    IUniswapV2Pair fln_scx;
    IUniswapV2Pair dai_scx;
    IUniswapV2Pair scx__fln_scx;
    LimboOracleLike oracle;
  }

  struct UniVARS {
    uint256 divergenceTolerance;
    uint256 minQuoteWaitDuration;
    IUniswapV2Factory factory;
    address behodler;
    uint8 precision; // behodler uses a binary search. The higher this number, the more precise
    uint8 priceBoostOvershoot; //percentage (0-100) for which the price must be overcorrected when strengthened to account for other AMMs
    address blackHole;
    address flan;
    address DAI;
    OracleSet oracleSet;
  }

  /**@dev the Dai SCX price and the Dai balance on Behodler are both sampled twice before a migration can occur.
   * The two samples have to be spaced a minimum duration and have to be the same values (within an error threshold). The objective here is to make price manipulation untenably expensive for an attacker
   * so that the mining power expended (or the opportunity cost of eth staked) far exceeds the benefit to manipulating Limbo.
   * The assumption of price stability isn't a bug because migrations aren't required to happen frequently. Instead if natural price drift occurs for non malicious reasons,
   * the migration can be reattempted until a period of sufficient calm allows for migration. If a malicious actor injects volatility in order to prevent migration, by the principle
   * of antifragility, they're doing the entire Ethereum ecosystem a service at their own expense.
   */
  UniVARS VARS;

  //not sure why codebases don't use keyword ether but I'm reluctant to entirely part with that tradition for now.
  uint256 constant EXA = 1e18;

  //needs to be updated for future Martian, Lunar and Venusian blockchains although I suspect Lunar colonies will be very Terracentric because of low time lag.
  uint256 constant year = (1 days * 365);

  modifier onlyLimbo() {
    require(msg.sender == limbo);
    _;
  }

  constructor(address _limbo, address limboDAO) Governable(limboDAO) {
    limbo = _limbo;
    VARS.blackHole = address(new BlackHole());
    VARS.factory = IUniswapV2Factory(address(0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f));
    VARS.DAI = 0x6B175474E89094C44Da98b954EedeAC495271d0F;
  }

  ///@notice LP tokens minted during migration are discarded.
  function blackHole() public view returns (address) {
    return VARS.blackHole;
  }

  ///@dev Only for testing: On mainnet Dai has a fixed address.
  function setDAI(address dai) public {
    require(block.chainid != 1, "DAI hardcoded on mainnet");
    VARS.DAI = dai;
  }

  ///@notice main configuration function.
  ///@dev We prefer to use configuration functions rather than a constructor for a number of reasons.
  ///@param _limbo Limbo contract
  ///@param behodler Behodler AMM
  ///@param flan The flan token
  ///@param divergenceTolerance The amount of price difference between the two quotes that is tolerated before a migration is attempted
  ///@param precision In order to query the tokens redeemed by a quantity of SCX, Behodler performs a binary search. Precision refers to the max iterations of the search.
  ///@param priceBoostOvershoot Flan targets parity with Dai. If we set Flan to equal Dai then between migrations, it will always be below Dai. Overshoot gives us some runway by intentionally "overshooting" the price
  function configure(
    address _limbo,
    address behodler,
    address flan,
    uint256 divergenceTolerance,
    uint8 precision,
    uint8 priceBoostOvershoot,
    address oracle
  ) public onlySuccessfulProposal {
    limbo = _limbo;
    VARS.behodler = behodler;
    VARS.flan = flan;
    require(divergenceTolerance >= 100, "Divergence of 100 is parity");
    VARS.divergenceTolerance = divergenceTolerance;
    VARS.precision = precision == 0 ? precision : precision;
    require(priceBoostOvershoot < 100, "Set overshoot to number between 0 and 99.");
    VARS.priceBoostOvershoot = priceBoostOvershoot;
    LimboOracleLike limboOracle = LimboOracleLike(oracle);
    VARS.factory = limboOracle.factory();

    address fln_scx = VARS.factory.getPair(flan, behodler);
    address dai_scx = VARS.factory.getPair(VARS.DAI, behodler);
    address scx__fln_scx = VARS.factory.getPair(behodler, fln_scx);
    // console.log("dai %s", VARS.DAI);
    // console.log("fln_scx %s", fln_scx);
    // console.log("dai_scx %s", dai_scx);
    // console.log("scx__fln_scx %s", scx__fln_scx);

    address zero = address(0);

    require(!(fln_scx == zero || dai_scx == zero || scx__fln_scx == zero), "EO");

    VARS.oracleSet = OracleSet({
      oracle: limboOracle,
      fln_scx: IUniswapV2Pair(fln_scx),
      dai_scx: IUniswapV2Pair(dai_scx),
      scx__fln_scx: IUniswapV2Pair(scx__fln_scx)
    });
  }

  struct PriceTiltVARS {
    uint256 FlanPerSCX;
    uint256 SCXPerFLN_SCX;
    uint256 totalSupplyOfFLN_SCX;
    uint256 currentSCXInFLN_SCX;
    uint256 currentFLNInFLN_SCX;
  }

  //flan per scx. (0)
  //scx value of fln/scx (1)
  //total supply of fln/scx. (2)
  //flan in flan/scx = ((1*2)/2 * 0)
  function getPriceTiltVARS() internal view returns (PriceTiltVARS memory tilt) {
    tilt.FlanPerSCX = VARS.oracleSet.oracle.consult(VARS.behodler, VARS.flan, SPOT);
    tilt.SCXPerFLN_SCX = VARS.oracleSet.oracle.consult(address(VARS.oracleSet.fln_scx), VARS.behodler, SPOT);
    tilt.totalSupplyOfFLN_SCX = VARS.oracleSet.fln_scx.totalSupply(); // although this can be manipulated, it appears on both sides of the equation(cancels out)

    //console.log("tilt.SCXPerFLN_SCX %s", tilt.SCXPerFLN_SCX);
    tilt.currentSCXInFLN_SCX = (tilt.SCXPerFLN_SCX * tilt.totalSupplyOfFLN_SCX) / (2 * SPOT);

    tilt.currentFLNInFLN_SCX = (tilt.currentSCXInFLN_SCX * tilt.FlanPerSCX) / SPOT;
    // console.log("currentFLN in FLN_SCX %s", tilt.currentFLNInFLN_SCX);
    // console.log("actual flan in fln_scx %s", IERC20(VARS.flan).balanceOf(address(VARS.oracleSet.fln_scx)));
  }

  ///@notice When tokens are migrated to Behodler, SCX is generated. This SCX is used to boost Flan liquidity and nudge the price of Flan back to parity with Dai
  ///@dev makes use of price tilting. Be sure to understand the concept of price tilting before trying to understand the final if statement.
  function stabilizeFlan(uint256 mintedSCX) public override onlyLimbo updateQuotes returns (uint256 lpMinted) {
    PriceTiltVARS memory priceTilting = getPriceTiltVARS();
    uint256 transferredSCX = (mintedSCX * 98) / 100;
    uint256 finalSCXBalanceOnLP = (transferredSCX) + priceTilting.currentSCXInFLN_SCX;
    // console.log(
    //   "finalSCXBalanceOnLP %s, currentSCXInFLN_SCX %s",
    //   finalSCXBalanceOnLP,
    //   priceTilting.currentSCXInFLN_SCX
    // );
    // console.log(
    //   "actual balance of SCX in FLN_SCX %s",
    //   IERC20(VARS.behodler).balanceOf(address(VARS.oracleSet.fln_scx))
    // );
    uint256 DesiredFinalFlanOnLP = (finalSCXBalanceOnLP * priceTilting.FlanPerSCX) / SPOT;
    // console.log("FlanPerSCX %s ", priceTilting.FlanPerSCX);
    // console.log("desiredFlanOnLP %s", DesiredFinalFlanOnLP);
    address pair = address(VARS.oracleSet.fln_scx);

    if (priceTilting.currentFLNInFLN_SCX < DesiredFinalFlanOnLP) {
      uint256 flanToMint = ((DesiredFinalFlanOnLP - priceTilting.currentFLNInFLN_SCX) *
        (100 - VARS.priceBoostOvershoot)) / 100;
      flanToMint = flanToMint == 0 ? DesiredFinalFlanOnLP - priceTilting.currentFLNInFLN_SCX : flanToMint;
      FlanLike(VARS.flan).mint(pair, flanToMint);
      // console.log("MINTED SCX %s, scx balance %s", transferredSCX, IERC20(VARS.behodler).balanceOf(address(this)));

      IERC20(VARS.behodler).transfer(pair, transferredSCX);
      {
        lpMinted = VARS.oracleSet.fln_scx.mint(VARS.blackHole);
      }
    } else {
      uint256 minFlan = priceTilting.currentFLNInFLN_SCX / priceTilting.totalSupplyOfFLN_SCX;
      FlanLike(VARS.flan).mint(pair, minFlan + 2);
      IERC20(VARS.behodler).transfer(pair, transferredSCX);
      lpMinted = VARS.oracleSet.fln_scx.mint(VARS.blackHole);
    }
  }

  function generateFLNQuote() internal {
    OracleSet memory set = VARS.oracleSet;
    set.oracle.update(VARS.behodler, VARS.flan);
    set.oracle.update(VARS.behodler, VARS.DAI);
    set.oracle.update(VARS.behodler, address(set.fln_scx));
  }

  modifier updateQuotes() {
    generateFLNQuote();
    _;
  }

  ///@notice helper function for converting a desired APY into a flan per second (FPS) statistic
  ///@param minAPY Here APY refers to the dollar value of flan relative to the dollar value of the threshold
  ///@param daiThreshold The DAI value of the target threshold to list on Behodler. Threshold is an approximation of the AVB on Behodler
  function minAPY_to_FPS(
    uint256 minAPY, //divide by 10000 to get percentage
    uint256 daiThreshold
  ) public pure override returns (uint256 fps) {
    require(daiThreshold > 0, "EN");
    uint256 returnOnThreshold = (minAPY * daiThreshold) / 1e4;
    fps = returnOnThreshold / (year);
  }

  ///@notice Buys Flan with a specified token, apportions 1% of the purchased Flan to the caller and burns the rest.
  ///@param inputToken The token used to buy Flan
  ///@param amount amount of input token used to buy Flan
  ///@param recipient receives 1% of Flan purchased as an incentive to call this function regularly
  ///@dev Assumes a pair for Flan/InputToken exists on Uniswap
  function buyFlanAndBurn(
    address inputToken,
    uint256 amount,
    address recipient
  ) public override {
    address pair = VARS.factory.getPair(inputToken, VARS.flan);
    uint256 flanBalance = IERC20(VARS.flan).balanceOf(pair);
    uint256 inputBalance = IERC20(inputToken).balanceOf(pair);

    uint256 amountOut = getAmountOut(amount, inputBalance, flanBalance);
    uint256 amount0Out = inputToken < VARS.flan ? 0 : amountOut;
    uint256 amount1Out = inputToken < VARS.flan ? amountOut : 0;
    IERC20(inputToken).transfer(pair, amount);
    IUniswapV2Pair(pair).swap(amount0Out, amount1Out, address(this), "");
    uint256 reward = (amountOut / 100);
    ERC20Burnable(VARS.flan).transfer(recipient, reward);
    ERC20Burnable(VARS.flan).burn(amountOut - reward);
  }

  function getAmountOut(
    uint256 amountIn,
    uint256 reserveIn,
    uint256 reserveOut
  ) internal pure returns (uint256 amountOut) {
    uint256 amountInWithFee = amountIn * 997;
    uint256 numerator = amountInWithFee * reserveOut;
    uint256 denominator = reserveIn * 1000 + amountInWithFee;
    amountOut = numerator / denominator;
  }

  function getAmountIn(
    uint256 amountOut,
    uint256 reserveIn,
    uint256 reserveOut
  ) internal pure returns (uint256 amountIn) {
    uint256 numerator = reserveIn * amountOut * 1000;
    uint256 denominator = (reserveOut - amountOut) * 997;
    amountIn = (numerator / denominator) + 1;
  }
}
