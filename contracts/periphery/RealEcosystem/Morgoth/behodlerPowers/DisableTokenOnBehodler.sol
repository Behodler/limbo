// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;
import "../Powers.sol";
import "../../../../facades/LachesisLike.sol";

contract DisableTokenOnBehodler is PowerInvoker {
    address public token;

    constructor(
        address _token,
        address _angband
    ) PowerInvoker("ADD_TOKEN_TO_BEHODLER", _angband) {
        token = _token;
    }

    function orchestrate() internal override returns (bool) {
        address _lachesis = angband.getAddress(power.domain);
        LachesisLike lachesis = LachesisLike(_lachesis);
        lachesis.measure(token, false, false);
        lachesis.updateBehodler(token);
        return true;
    }
}
