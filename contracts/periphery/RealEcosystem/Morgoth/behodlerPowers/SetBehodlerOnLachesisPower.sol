// SPDX-License-Identifier: MIT
pragma solidity ^0.7.1;
import "../Powers.sol";
import "../facades/LachesisLike.sol";

contract SetBehodlerOnLachesis_071Power is PowerInvoker {
    address behodler;

    constructor(
        address _behodler,
        address _angband
    ) PowerInvoker("ADD_TOKEN_TO_BEHODLER", _angband) {
        behodler = _behodler;
    }

    function orchestrate() internal override returns (bool) {
        address _lachesis = angband.getAddress(power.domain);
        Lachesis_071Like lachesis = Lachesis_071Like(_lachesis);
        lachesis.setBehodler(behodler);
        return true;
    }
}