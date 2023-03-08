// SPDX-License-Identifier: MIT
pragma solidity ^0.7.1;
import "../Powers.sol";

contract ReplaceLachesis_071Power is PowerInvoker {
    address newLachesis_071;
    address existingBehodler;

    constructor(
        address _angband,
        address _newLachesis_071,
        address _existingBehodler
    ) PowerInvoker("TREASURER", _angband) {
        newLachesis_071 = _newLachesis_071;
        existingBehodler = _existingBehodler;
    }

    function orchestrate() internal override returns (bool) {
        angband.setBehodler(existingBehodler, newLachesis_071);
        return true;
    }
}
