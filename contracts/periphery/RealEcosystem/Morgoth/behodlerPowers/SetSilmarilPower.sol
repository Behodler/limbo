// SPDX-License-Identifier: MIT
pragma solidity ^0.7.1;
import "../Powers.sol";

interface IronCrownFacade_Silmaril {
    function setSilmaril(
        uint8 index,
        uint16 percentage,
        address exit
    ) external;
}

contract SetSilmarilPower is PowerInvoker {
    struct Parameters {
        uint8 index;
        uint16 percentage;
        address exit;
    }
    Parameters parameters;

    constructor(address _angband)
        PowerInvoker("INSERT_SILMARIL", _angband)
    {}

/**

    uint8 public constant perpetualMining = 0; //liquid vault etc
    uint8 public constant dev = 1;
    uint8 public constant treasury = 2; //angband
 */
    function parameterize(
        uint8 index,
        uint16 percentage,
        address exit
    ) public {
        parameters.exit = exit;
        parameters.percentage = percentage;
        parameters.index = index;
    }

    function orchestrate() internal override returns (bool) {
        IronCrownFacade_Silmaril ironCrown =
            IronCrownFacade_Silmaril(angband.getAddress(power.domain));
        ironCrown.setSilmaril(
            parameters.index,
            parameters.percentage,
            parameters.exit
        );
        return true;
    }
}
