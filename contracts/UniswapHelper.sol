// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;
import "./facades/BehodlerLike.sol";
import "./DAO/Governable.sol";
import "./openzeppelin/ERC20Burnable.sol";
import "./facades/FlanLike.sol";
import "./periphery/UniswapV2/interfaces/IUniswapV2Factory.sol";
import "./periphery/UniswapV2/interfaces/IUniswapV2Pair.sol";
import "./facades/AMMHelper.sol";
import "./facades/LimboOracleLike.sol";
import "./facades/BehodlerLike.sol";

contract BlackHole {}

///@Title Uniswap V2 helper for managing Flan liquidity on Uniswap V2, Sushiswap and any other compatible AMM
///@author Justin Goro
/**@notice Flan liquidity is boosted on Uniswap (or Sushiswap) via open market operations at the point of a token migration.
 * UniswapHelper handles all the mechanics as well managing a just-in-time (Justin Time?) oracle
 */
contract UniswapHelper is Governable, AMMHelper {
  address limbo;
  /*SPOT is a small constant used to express selling a very small portion of a token. 
  It is used to simulate a small trade in the oracle to give something close to the spot price. 
  EG. if oracle.consult(tokenIN,tokenOut, 10000) = 20000 then we know 10000 units of tokenIn will buy 20000 units
  of tokenOut in the Uniswap Pair that contains (tokenIn;tokenOut). So we're asking how much SPOT units of token in buys.
  The reason we don't use 1 is because of fixed point arithmetic: we may get back a value of zero if tokenOut is more abundant
  than tokenIn or we may get back 1 if tokenOut is only slightly more abundant than tokenIn. SPOT gives us 8 decimal places.
  */
  uint256 constant SPOT = 1e8;

  struct OracleSet {
    IUniswapV2Pair fln_scx;
    IUniswapV2Pair dai_scx;
    IUniswapV2Pair scx__fln_scx;
    LimboOracleLike oracle;
  }

  struct UniVARS {
    uint256 minQuoteWaitDuration;
    IUniswapV2Factory factory;
    address behodler;
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
  UniVARS public VARS;

  //not sure why codebases don't use keyword ether but I'm reluctant to entirely part with that tradition for now.
  uint256 constant EXA = 1e18;

  //needs to be updated for future Martian, Lunar and Venusian blockchains although I suspect Lunar colonies will be very Terracentric because of low time lag.
  uint256 constant year = 31536000; // seconds in 365 day year

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

  ///@param dai the address of the Dai token
  function setDAI(address dai) public {
    VARS.DAI = dai;
  }

  ///@notice main configuration function.
  ///@dev We prefer to use configuration functions rather than a constructor for a number of reasons.
  ///@param _limbo Limbo contract
  ///@param behodler Behodler AMM
  ///@param flan The flan token
  ///@param priceBoostOvershoot Flan targets parity with Dai. If we set Flan to equal Dai then between migrations, it will always be below Dai. Overshoot gives us some runway by intentionally "overshooting" the price
  function configure(
    address _limbo,
    address behodler,
    address flan,
    uint8 priceBoostOvershoot,
    address oracle
  ) public onlySuccessfulProposal {
    limbo = _limbo;
    VARS.behodler = behodler;
    VARS.flan = flan;

    if (priceBoostOvershoot > 99) {
      revert PriceOvershootTooHigh(priceBoostOvershoot);
    }

    VARS.priceBoostOvershoot = priceBoostOvershoot;
    LimboOracleLike limboOracle = LimboOracleLike(oracle);
    VARS.factory = limboOracle.factory();

    address fln_scx = VARS.factory.getPair(flan, behodler);
    address dai_scx = VARS.factory.getPair(VARS.DAI, behodler);
    address scx__fln_scx = VARS.factory.getPair(behodler, fln_scx);

    address zero = address(0);

    if (fln_scx == zero || dai_scx == zero || scx__fln_scx == zero) {
      revert OracleLPsNotSet(fln_scx, dai_scx, scx__fln_scx);
    }
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
    uint256 DAIPerSCX;
  }

  //flan per scx. (0)
  //scx value of fln/scx (1)
  //total supply of fln/scx. (2)
  //flan in flan/scx = ((1*2)/2 * (0))
  function getPriceTiltVARS() internal view returns (PriceTiltVARS memory tilt) {
    tilt.FlanPerSCX = VARS.oracleSet.oracle.consult(VARS.behodler, VARS.flan, SPOT);
    tilt.SCXPerFLN_SCX = VARS.oracleSet.oracle.consult(address(VARS.oracleSet.fln_scx), VARS.behodler, SPOT);
    tilt.totalSupplyOfFLN_SCX = VARS.oracleSet.fln_scx.totalSupply(); // although this can be manipulated, it appears on both sides of the equation(cancels out)
    tilt.DAIPerSCX = VARS.oracleSet.oracle.consult(VARS.behodler, VARS.DAI, SPOT);

    /*if all of the contained liquidity of FLN_SCX were converted to SCX, tilt.SCXPerFLN_SCX * tilt.totalSupplyOfFLN_SCX) / (SPOT) would be the quantity.
     Divide by 2 and we get an approximation of the true quantity of SCX in FLN_SCX since half of FLN_SCX is indeed SCX.
     Divide (tilt.SCXPerFLN_SCX * tilt.totalSupplyOfFLN_SCX) by SPOT and to remove the SPOT amplification of the oracle operation
     and are left with the order or magnitude of totalSupply.
     which is 18 decimal places or 1 ether since FLN and SCX are both 18 decimal place tokens
     */
    tilt.currentSCXInFLN_SCX = (tilt.SCXPerFLN_SCX * tilt.totalSupplyOfFLN_SCX) / (SPOT * 2); //normalized to in units of 1 ether
    tilt.currentFLNInFLN_SCX = (tilt.currentSCXInFLN_SCX * tilt.FlanPerSCX) / SPOT;
  }

  ///@notice When tokens are migrated to Behodler, SCX is generated. This SCX is used to boost Flan liquidity and nudge the price of Flan back to parity with Dai
  ///@dev makes use of price tilting. Be sure to understand the concept of price tilting before trying to understand the final if statement.
  function stabilizeFlan(uint256 mintedSCX) public override returns (uint256 lpMinted) {
    if (msg.sender != limbo) {
      revert OnlyLimbo(msg.sender, limbo);
    }
    generateFLNQuote();
    PriceTiltVARS memory priceTilting = getPriceTiltVARS();
    (uint256 transferFee, uint256 burnFee, ) = BehodlerLike(VARS.behodler).config();

    uint256 transferredSCX = (mintedSCX * (1000 - transferFee - burnFee)) / 1000;
    uint256 finalSCXBalanceOnLP = (transferredSCX) + priceTilting.currentSCXInFLN_SCX;
    uint256 DesiredFinalFlanOnLP = (finalSCXBalanceOnLP * priceTilting.DAIPerSCX) / SPOT;

    address pair = address(VARS.oracleSet.fln_scx);
    if (priceTilting.currentFLNInFLN_SCX < DesiredFinalFlanOnLP) {
      uint256 flanToMint = ((DesiredFinalFlanOnLP - priceTilting.currentFLNInFLN_SCX) *
        (100 - VARS.priceBoostOvershoot)) / 100;
      flanToMint = flanToMint == 0 ? DesiredFinalFlanOnLP - priceTilting.currentFLNInFLN_SCX : flanToMint;
      FlanLike(VARS.flan).mint(pair, flanToMint);

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
    LimboOracleLike oracle = set.oracle;
    UniVARS memory localVARS = VARS;

    //update scx/fln if stale
    (uint32 blockTimeStamp, uint256 period) = oracle.getLastUpdate(localVARS.behodler, localVARS.flan);
    if (block.timestamp - blockTimeStamp > period) {
      set.oracle.update(localVARS.behodler, localVARS.flan);
    }

    //update scx/DAI if stale
    (blockTimeStamp, period) = oracle.getLastUpdate(localVARS.behodler, localVARS.DAI);
    if (block.timestamp - blockTimeStamp > period) set.oracle.update(localVARS.behodler, localVARS.DAI);

    //update scx/fln_scx if stale
    (blockTimeStamp, period) = oracle.getLastUpdate(localVARS.behodler, address(set.fln_scx));
    if (block.timestamp - blockTimeStamp > period) set.oracle.update(localVARS.behodler, address(set.fln_scx));
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
