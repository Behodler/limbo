// SPDX-License-Identifier: MIT
pragma solidity ^0.7.1;
import "../Powers.sol";
import "../facades/Behodler_071.sol";

contract SetSafetyParametersOnBehodler is PowerInvoker {

    constructor(address _angband)
        PowerInvoker("CONFIGURE_SCARCITY", _angband)
    {}

    function orchestrate() internal override returns (bool) {

        address b = angband.getAddress(power.domain);
        Behodler_071 behodler = Behodler_071(b);
        behodler.setSafetParameters(30,40);
        return true;
    }
}
