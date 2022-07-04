// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;
abstract contract TokenProxyLike {
    address internal immutable baseToken;
    uint constant internal ONE = 1 ether;
    constructor (address _baseToken) {
        baseToken=_baseToken;
    }

    function mint(address to, uint256 amount) public virtual returns (uint);
    function redeem(address to, uint256 amount) public virtual returns (uint);
}