// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "../DAO/Governable.sol";

contract GovernableStub is Governable {
    constructor(address dao) Governable(dao){}
}