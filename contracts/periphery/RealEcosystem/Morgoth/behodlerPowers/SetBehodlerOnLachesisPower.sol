// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;
import "../Powers.sol";
import "../../../../facades/LachesisLike.sol";

contract SetBehodlerOnLachesisPower is PowerInvoker {
    address behodler;

    constructor(
        address _behodler,
        address _angband
    ) PowerInvoker("ADD_TOKEN_TO_BEHODLER", _angband) {
        behodler = _behodler;
    }

    function orchestrate() internal override returns (bool) {
        address _lachesis = angband.getAddress(power.domain);
        LachesisLike lachesis = LachesisLike(_lachesis);
        lachesis.setBehodler(behodler);
        return true;
    }
}