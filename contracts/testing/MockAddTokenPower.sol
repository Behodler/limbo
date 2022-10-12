// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;
import "./MockBehodler.sol";
import "../facades/LimboAddTokenToBehodlerPowerLike.sol";

contract MockAddTokenPower is LimboAddTokenToBehodlerPowerLike {
    address behodler;
    uint256 scxToMint = 10000;

 constructor(
        address _angband,
        address limbo,
        address proxyRegistry
    ) {
        params.limbo = limbo;
        params.tokenProxyRegistry = proxyRegistry;
    }

    function setScarcityToMint(uint256 _scarcity) public {
        scxToMint = _scarcity;
    }

    function seed(address _behodler, address _limbo) public {
        params.limbo = _limbo;
        behodler = _behodler;
    }

    function parameterize(address token, bool burnable) public override {}

    function invoke() public {
        MockBehodler(behodler).mint(scxToMint);
        MockBehodler(behodler).transfer(params.limbo, scxToMint);
    }
}
