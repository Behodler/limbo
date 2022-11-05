// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;
import "../Powers.sol";

contract ReplaceLachesisPower is PowerInvoker {
    address newLachesis;
    address existingBehodler;

    constructor(
        address _angband,
        address _newLachesis,
        address _existingBehodler
    ) PowerInvoker("TREASURER", _angband) {
        newLachesis = _newLachesis;
        existingBehodler = _existingBehodler;
    }

    function orchestrate() internal override returns (bool) {
        angband.setBehodler(existingBehodler, newLachesis);
        return true;
    }
}
