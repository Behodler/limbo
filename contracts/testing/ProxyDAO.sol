// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

contract ProxyDAO {
  function successfulProposal(address proposal) public view returns (bool) {
    return true;
  }

  function makeProposal(address proposal, address proposer) public {}
}
