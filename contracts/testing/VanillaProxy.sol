// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;
import "../../contracts/TokenProxies/TokenProxyBase.sol";

///@dev for testing basic proxy functionality
contract VanillaProxy is TokenProxyBase {
  uint256 R_amp;

  constructor(
    address _baseToken,
    string memory name_,
    string memory symbol_,
    address registry
  ) TokenProxyBase(_baseToken, name_, symbol_, registry, 1 ether) {
    R_amp = 1 ether;
  }

  function setRAmpFinney(uint256 _R_amp) public {
    R_amp = _R_amp * 10**15;
  }

  function mintCustom(
    address proxyRecipient,
    address baseSource,
    uint256 amount
  ) public returns (uint) {
    return mint(R_amp, proxyRecipient, baseSource, amount);
  }

  function redeemSelf(address recipient, uint256 amount) public returns (uint) {
    return redeem(msg.sender,recipient,amount);
  }
}
