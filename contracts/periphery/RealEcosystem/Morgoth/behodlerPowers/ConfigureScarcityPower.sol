// SPDX-License-Identifier: MIT
pragma solidity ^0.7.1;
import "../Powers.sol";
import "../Limbo/IdempotentPowerInvoker.sol";

abstract contract Scarcity_071 {
    function configureScarcity(
        uint256 transferFee,
        uint256 burnFee,
        address feeDestination
    ) public virtual;
}

contract ConfigureScarcityPower is IdempotentPowerInvoker {
    uint256 transferFee;
    uint256 burnFee;
    address feeDestination;

    constructor(address _angband)
        IdempotentPowerInvoker("CONFIGURE_SCARCITY", _angband)
    {}

    function parameterize(
        uint256 _transferFee,
        uint256 _burnFee,
        address _feeDestination
    ) public {
        transferFee = _transferFee;
        burnFee = _burnFee;
        feeDestination = _feeDestination;
    }

    function orchestrate() internal override returns (bool) {
        address scarcity = angband.getAddress(power.domain);
        Scarcity_071 scx  = Scarcity_071(scarcity);
        scx.configureScarcity(transferFee, burnFee, feeDestination);
        return true;
    }
}
