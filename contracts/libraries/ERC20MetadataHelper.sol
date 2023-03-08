// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;
import "./AddressToString.sol";
import "../openzeppelin/ERC20MetaData.sol";

library MetadataHelper {
  using AddressToString for address;

  function tryGetMetadata(address tokenAddress) internal view returns (string memory name, string memory symbol) {
    ERC20Meta token = ERC20Meta(tokenAddress);

    try token.name() returns (string memory _name) {
      name = _name;
    } catch {
      name = string.concat(tokenAddress.toString(5), "_name");
    }

    try token.symbol() returns (string memory _symbol) {
      symbol = _symbol;
    } catch {
      symbol = string.concat(tokenAddress.toString(5), "_symbol");
    }
  }
}