// SPDX-License-Identifier: MIT
pragma solidity ^0.7.1;
import "../Powers.sol";
import "../facades/Behodler_071.sol";

contract SeedBehodlerPower is PowerInvoker, Ownable_071 {
    struct Params {
        address weth;
        address lachesis;
        address flashLoanArbiter;
        address liquidityReceiver;
        address weidaiReserve;
        address dai;
        address weiDai; 
    }

Params params;
    constructor(address _angband)
        PowerInvoker("CONFIGURE_SCARCITY", _angband)
    {}

    function parameterize(
        address weth,
        address lachesis,
        address flashLoanArbiter,
        address liquidityReceiver,
        address weidaiReserve,
        address dai,
        address weiDai
    ) public onlyOwner {
        params.weth = weth;
        params.lachesis= lachesis;
        params.flashLoanArbiter = flashLoanArbiter;
        params.liquidityReceiver = liquidityReceiver;
        params.weidaiReserve = weidaiReserve;
        params.dai = dai;
        params.weiDai = weiDai;
    }

    function orchestrate() internal override returns (bool) {
        Behodler_071 behodler = Behodler_071(angband.getAddress(power.domain));
        behodler.seed(
            params.weth,
            params.lachesis,
            params.flashLoanArbiter, 
            params.liquidityReceiver,
            params.weidaiReserve,
            params.dai,
            params.weiDai 
        );
        return true;
    }
}
