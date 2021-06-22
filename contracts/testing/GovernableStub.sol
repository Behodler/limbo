// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;
import "../DAO/Governable.sol";

contract GovernableStub is Governable {
    constructor(address dao) Governable(dao){}
}