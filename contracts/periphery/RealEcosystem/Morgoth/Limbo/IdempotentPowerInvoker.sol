// SPDX-License-Identifier: MIT
pragma solidity ^0.7.1;
import "../Powers.sol";
import "../facades/LachesisLike.sol";
import "../openzeppelin/IERC20.sol";

abstract contract IdempotentPowerInvoker {
    event PowerInvoked(address user, bytes32 minion, bytes32 domain);

    Power public power;
    PowersRegistry public registry;
    AngbandLike_071 public angband;

    constructor(bytes32 _power, address _angband) {
        angband = AngbandLike_071(_angband);
        address _registry = angband.getAddress(angband.POWERREGISTRY());
        registry = PowersRegistry(_registry);
        (bytes32 name, bytes32 domain, bool transferrable, bool unique) =
            registry.powers(_power);
        power = Power(name, domain, transferrable, unique);
    }

    modifier revertOwnership {
        _;
        address ownableContract = angband.getAddress(power.domain);
        if (ownableContract != address(angband))
            Ownable_071(ownableContract).transferOwnership(address(angband));
    }

    function orchestrate() internal virtual returns (bool);

    function invoke(bytes32 minion, address sender) public revertOwnership {
        require(msg.sender == address(angband), "MORGOTH: angband only");
        require(
            registry.isUserMinion(sender, minion),
            "MORGOTH: Invocation by minions only."
        );
        require(orchestrate(), "MORGOTH: Power invocation");
        emit PowerInvoked(sender, minion, power.domain);
    }
}