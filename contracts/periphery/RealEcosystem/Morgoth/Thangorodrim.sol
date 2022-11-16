// SPDX-License-Identifier: MIT
pragma solidity ^0.7.1;

contract Thangorodrim {
    bytes32 public constant POWERREGISTRY = "POWERREGISTRY";
    bytes32 public constant BEHODLER = "BEHODLER";
    bytes32 public constant LACHESIS = "LACHESIS";
    bytes32 public constant IRON_CROWN = "IRON_CROWN";
    bytes32 public constant ANGBAND = "ANGBAND";

    mapping(bytes32 => address) private addresses;

    function getAddress(bytes32 _key) public view returns (address) {
        return addresses[_key];
    }

    function _setAddress(bytes32 _key, address _value) internal {
        addresses[_key] = _value;
    }
}
