// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;
import "./UniswapV2/interfaces/IUniswapV2Factory.sol";
import "../DAO/Governable.sol";

import "./UniswapV2/interfaces/IUniswapV2Pair.sol";
import "./UniswapV2/lib/FixedPoint.sol";

import "./UniswapV2/libraries/UniswapV2OracleLibrary.sol";
import "./UniswapV2/libraries/UniswapV2Library.sol";
import "hardhat/console.sol";

/**
 *@title LimboOracle
 * @author Justin Goro
 * @notice There are two reasons to gather reliable prices in Limbo: calculating Fate from relative EYE containing LP prices and pricing Flan during a migration to Behodler.
 * Neither requires up to date accuracy but must simply be resitant to tampering.
 * @dev This contract is based on the UniswapV2 ExampleOracleSimple. Originally, a simpler version of an Oracle was created but a tension emerged between griefing and security that only resolved in a hell of complication.
 */
contract LimboOracle is Governable {
  using FixedPoint for *;
  using FixedPoint for FixedPoint.uq112x112;

  IUniswapV2Factory public factory;
  struct PairMeasurement {
    uint256 price0CumulativeLast;
    uint256 price1CumulativeLast;
    uint32 blockTimestampLast;
    FixedPoint.uq112x112 price0Average;
    FixedPoint.uq112x112 price1Average;
    uint256 period;
  }
  mapping(address => PairMeasurement) public pairMeasurements;

  modifier validPair(address token0, address token1) {
    require(isPair(token0, token1), "ORACLE: PAIR_NOT_FOUND");
    _;
  }

  constructor(address V2factory, address limboDAO) Governable(limboDAO) {
    factory = IUniswapV2Factory(V2factory);
  }

  /**
   *@param pairAddress the UniswapV2 pair address
   *@param period the minimum duration in hours between sampling
   */
  function RegisterPair(address pairAddress, uint256 period) public onlySuccessfulProposal {
    IUniswapV2Pair pair = IUniswapV2Pair(pairAddress);
    uint256 price0CumulativeLast = pair.price0CumulativeLast(); // fetch the current accumulated price value (1 / 0)
    uint256 price1CumulativeLast = pair.price1CumulativeLast(); // fetch the current accumulated price value (0 / 1)
    uint112 reserve0;
    uint112 reserve1;
    uint32 blockTimestampLast;
    (reserve0, reserve1, blockTimestampLast) = pair.getReserves();
    require(reserve0 != 0 && reserve1 != 0, "ORACLE: NO_RESERVES"); // ensure that there's liquidity in the pair
    pairMeasurements[pairAddress] = PairMeasurement({
      price0CumulativeLast: price0CumulativeLast,
      price1CumulativeLast: price1CumulativeLast,
      blockTimestampLast: blockTimestampLast,
      price0Average: FixedPoint.uq112x112(0),
      price1Average: FixedPoint.uq112x112(0),
      period: period * (1 hours)
    });
  }

  /**
   *@dev the order of tokens doesn't matter
   */
  function update(address token0, address token1) public validPair(token0, token1) {
    address pair = factory.getPair(token0, token1);
    _update(pair);
  }

  /**
   *@param pair the UniswapV2 pair
   */
  function updatePair(address pair) public {
    _update(pair);
  }

  /**
   *@param tokenIn the token for which the price is required
   *@param tokenOut the token that the priced token is being priced in.
   *@param amountIn the quantity of pricedToken to allow for price impact
   */
  function consult(
    address tokenIn,
    address tokenOut,
    uint256 amountIn
  ) external view validPair(tokenIn, tokenOut) returns (uint256 amountOut) {
    IUniswapV2Pair pair = IUniswapV2Pair(factory.getPair(tokenIn, tokenOut));
    PairMeasurement memory measurement = pairMeasurements[address(pair)];

    //console.log("pricedToken %s", pricedToken);

/*
    // note this will always return 0 before update has been called successfully for the first time.
    function consult(address token, uint amountIn) external view returns (uint amountOut) {
        if (token == token0) {
            amountOut = price0Average.mul(amountIn).decode144();
        } else {
            require(token == token1, 'ExampleOracleSimple: INVALID_TOKEN');
            amountOut = price1Average.mul(amountIn).decode144();
        }
    }
*/
    if (tokenIn == pair.token0()) {
      amountOut = (measurement.price0Average.mul(amountIn)).decode144();
    } else {
      require(tokenIn == pair.token1(), "ORACLE: INVALID_TOKEN");
      amountOut = (measurement.price1Average.mul(amountIn)).decode144();
    }

    require(amountOut > 0, "ORACLE: UPDATE FIRST");
  }

  function _update(address _pair) private {
    (uint256 price0Cumulative, uint256 price1Cumulative, uint32 blockTimestamp) = UniswapV2OracleLibrary
      .currentCumulativePrices(_pair);
    PairMeasurement memory measurement = pairMeasurements[_pair];
    // //console.log("ORACLE: price0Cumulative %s, price1Cumulative", price0Cumulative, price1Cumulative);

    require(measurement.period > 0, "ORACLE: Asset not registered");
    uint32 timeElapsed;
    unchecked {
      timeElapsed = blockTimestamp - measurement.blockTimestampLast; // overflow is desired
    }

    //console.log("period %s, timeElapsed %s", measurement.period, timeElapsed);
    // ensure that at least one full period has passed since the last update
    require(timeElapsed >= measurement.period, "ORACLE: WAIT PERIOD TOO SMALL");

    //console.log(
    //   "price0Cumulative %s, measurement.price0CumulativeLast %s, difference %s",
    //   price0Cumulative,
    //   measurement.price0CumulativeLast,
    //   price0Cumulative - measurement.price0CumulativeLast
    // );

    measurement.price0Average = FixedPoint.uq112x112(
      uint224((price0Cumulative - measurement.price0CumulativeLast) / timeElapsed)
    );

    //console.log(
    //   "price1Cumulative %s, measurement.price1CumulativeLast %s, difference %s",
    //   price1Cumulative,
    //   measurement.price1CumulativeLast,
    //   price1Cumulative - measurement.price1CumulativeLast
    // );

    measurement.price1Average = FixedPoint.uq112x112(
      uint224((price1Cumulative - measurement.price1CumulativeLast) / timeElapsed)
    );

    //console.log(
    //   "final price1Average %s, price0Average %s ",
    //   measurement.price1Average.decode(),
    //   measurement.price0Average.decode()
    // );
    measurement.price0CumulativeLast = price0Cumulative;
    measurement.price1CumulativeLast = price1Cumulative;
    measurement.blockTimestampLast = blockTimestamp;
    pairMeasurements[_pair] = measurement;
    //console.log("");
  }

  function isPair(address tokenA, address tokenB) private view returns (bool) {
    return factory.getPair(tokenA, tokenB) != address(0);
  }
}