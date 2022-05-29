// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

abstract contract MorgothTokenApproverLike{
    function approved(address token) public virtual view returns (bool);
}