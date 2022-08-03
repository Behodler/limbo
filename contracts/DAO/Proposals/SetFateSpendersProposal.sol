// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;
import "../ProposalFactory.sol";
import "../../facades/LimboDAOLike.sol";

contract SetFateSpendersProposal is Proposal {
  struct ParameterSet {
    address[] spenders;
    bool[] canSpend;
  }

  ParameterSet params;

  constructor(address dao, string memory _description) Proposal(dao, _description) {}

  function parameterize(address[] calldata spenders, bool[] calldata canSpend) public lockUntilComplete {
    if (spenders.length > 50) revert GriefSafetyFactorExceeded(50, spenders.length);
    params.spenders = spenders;
    params.canSpend = canSpend;
  }

  function execute() internal override returns (bool) {
    for (uint256 i = 0; i < params.spenders.length; i++) {
      LimboDAOLike(DAO).setFateSpender(params.spenders[i], params.canSpend[i]);
    }
    return true;
  }
}
