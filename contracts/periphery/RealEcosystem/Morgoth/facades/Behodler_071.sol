// SPDX-License-Identifier: MIT
pragma solidity ^0.7.1;

abstract contract Behodler_071 {
  function seed(
    address weth,
    address lachesis,
    address flashLoanArbiter,
    address _pyroTokenLiquidityReceiver,
    address weidaiReserve,
    address dai,
    address weiDai
  ) external virtual;

  function setSafetParameters(uint8 swapPrecisionFactor, uint8 maxLiquidityExit) external virtual;
}
