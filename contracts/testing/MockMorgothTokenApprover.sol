// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "../facades/MorgothTokenApproverLike.sol";

contract MockMorgothTokenApprover is MorgothTokenApproverLike {
    mapping(address => bool) public approvedTokens;

    function addToken(address token) public {
        approvedTokens[token] = true;
    }

    function removeToken(address token) public {
        approvedTokens[token] = false;
    }

    function approved(address token) public override view returns (bool) {
        return approvedTokens[token];
    }
}
