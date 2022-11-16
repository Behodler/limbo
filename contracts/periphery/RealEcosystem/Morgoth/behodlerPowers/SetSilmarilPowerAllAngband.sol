// SPDX-License-Identifier: MIT
pragma solidity ^0.7.1;
import "../Powers.sol";

interface IronCrownFacade {
    function setSilmaril(
        uint8 index,
        uint16 percentage,
        address exit
    ) external;
}

contract SetSilmarilPowerAllAngband is PowerInvoker {

    constructor(address _angband)
        PowerInvoker("INSERT_SILMARIL", _angband)
    {}

/**

    uint8 public constant perpetualMining = 0; //liquid vault etc
    uint8 public constant dev = 1;
    uint8 public constant treasury = 2; //angband
 */

    function orchestrate() internal override returns (bool) {
        IronCrownFacade ironCrown =
            IronCrownFacade(angband.getAddress(power.domain));
        ironCrown.setSilmaril(
            0,
            0,
            address(0)
        );
        ironCrown.setSilmaril(
            1,
            0,
            address(0)
        );
          ironCrown.setSilmaril(
            2,
            1000,
            address(angband)
        );
        return true;
    }
}
