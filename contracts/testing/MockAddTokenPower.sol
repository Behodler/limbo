// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;
import "./MockBehodler.sol";
import "../facades/LimboAddTokenToBehodlerPowerLike.sol";

contract MockAddTokenPower is LimboAddTokenToBehodlerPowerLike {
    address behodler;
    address limbo;

    function seed(address _behodler, address _limbo) public {
        limbo = _limbo;
        behodler = _behodler;
    }

    function parameterize(address token, bool burnable) public override {}

    function invoke() public {
        MockBehodler(behodler).mint(10000);
        MockBehodler(behodler).transfer(limbo, 10000);
    }
}
