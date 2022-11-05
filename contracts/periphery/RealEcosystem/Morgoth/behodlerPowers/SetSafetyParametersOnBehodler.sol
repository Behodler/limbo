// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;
import "../Powers.sol";
import "../../../../facades/BehodlerLike.sol";

contract SetSafetyParametersOnBehodler is PowerInvoker {

    constructor(address _angband)
        PowerInvoker("CONFIGURE_SCARCITY", _angband)
    {}

    function orchestrate() internal override returns (bool) {

        address b = angband.getAddress(power.domain);
        BehodlerLike behodler = BehodlerLike(b);
        behodler.setSafetParameters(30,40);
        return true;
    }
}
