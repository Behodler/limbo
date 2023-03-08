// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;
import "../openzeppelin/Strings.sol";


library AddressToString {
  using Strings for address;

  function toString(address value, uint256 length) public pure returns (string memory) {
    bytes memory data = bytes(value.toHexString());

    bytes memory bytesArray = new bytes(length);
    for(uint i =0;i<length;i++){
        bytesArray[i] = data[i];
    }
    return string (bytesArray);
  }
}
