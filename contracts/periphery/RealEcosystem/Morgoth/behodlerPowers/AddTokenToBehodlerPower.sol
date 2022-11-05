// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;
import "../Powers.sol";
import "../../../../facades/LachesisLike.sol";

contract AddTokenToBehodlerPower is PowerInvoker {
    address token;
    bool burnable;

    constructor(
        address _token,
        bool _burnable,
        address _angband
    ) PowerInvoker("ADD_TOKEN_TO_BEHODLER", _angband) {
        token = _token;
        burnable = _burnable;
    }

    function orchestrate() internal override returns (bool) {
        address _lachesis = angband.getAddress(power.domain);
        LachesisLike lachesis = LachesisLike(_lachesis);
        lachesis.measure(token, true, burnable);
        lachesis.updateBehodler(token);
        
        return true;
    }
}
