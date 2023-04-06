// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;
import "../TokenProxies/CliffFace.sol";
import "../TokenProxies/LimboProxy.sol";

library ProxyDeployer {
  function DeployCliffFace(
    address baseToken,
    string memory name,
    string memory symbol,
    address registry,
    address referenceToken,
    uint256 multiple,
    address behodler,
    uint256 initalRedeemRate
  ) internal returns (address proxyAddress) {
    proxyAddress = address(new CliffFace(
      baseToken,
     string(abi.encodePacked(name, "_CF")),
      string(abi.encodePacked(symbol, "_CF")),
      registry,
      referenceToken,
      multiple,
      behodler,
      initalRedeemRate
    ));
  }

  function DeployLimboProxy(
    address baseToken,
    string memory name,
    string memory symbol,
    address registry,
    address limbo,
    address flan,
    uint256 initialRedeemRate
  ) public returns (address proxyAddress) {
    proxyAddress = address(new LimboProxy(baseToken, string(abi.encodePacked(name,"Lim")), string(abi.encodePacked(symbol,"Lim")), registry, limbo, flan, initialRedeemRate));
  }
}
