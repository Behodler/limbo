// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;
import "../Powers.sol";

abstract contract BehodlerWithSeedLike {
    function seed(
        address weth,
        address lachesis,
        address flashLoanArbiter,
        address _pyroTokenLiquidityReceiver,
        address weidaiReserve,
        address dai,
        address weiDai
    ) external virtual;
}

contract PointBehodlerToNewLachesis is PowerInvoker {
    address _weth;
    address _lachesis;
    address _flashLoanArbiter;
    address _pyroTokenLiquidityReceiver;
    address _weidaiReserve;
    address _dai;
    address _weiDai;

    constructor(
        address _angband,
        address weth,
        address lachesis,
        address flashLoanArbiter,
        address pyroTokenLiquidityReceiver,
        address weidaiReserve,
        address dai,
        address weiDai
    ) PowerInvoker("CONFIGURE_SCARCITY", _angband) {
        _weth = weth;
        _lachesis = lachesis;
        _flashLoanArbiter = flashLoanArbiter;
        _pyroTokenLiquidityReceiver = pyroTokenLiquidityReceiver;
        _weidaiReserve = weidaiReserve;
        _dai = dai;
        _weiDai = weiDai;
    }

    function orchestrate() internal override returns (bool) {
        BehodlerWithSeedLike behodler =
            BehodlerWithSeedLike(angband.getAddress(power.domain));
        behodler.seed(
            _weth,
            _lachesis,
            _flashLoanArbiter,
            _pyroTokenLiquidityReceiver,
            _weidaiReserve,
            _dai,
            _weiDai
        );
        return true;
    }
}
