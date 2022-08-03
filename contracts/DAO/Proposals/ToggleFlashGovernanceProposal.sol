// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;
import "../ProposalFactory.sol";
import "../../facades/LimboDAOLike.sol";
import "../../facades/FlashGovernanceArbiterLike.sol";

contract ToggleFlashGovernanceProposal is Proposal {
  struct ParameterSet {
    address[] governed;
    bool[] areGoverned;
  }

  ParameterSet params;

  constructor(address dao, string memory _description) Proposal(dao, _description) {}

  function parameterize(address[] calldata governed, bool[] calldata areGoverned) public lockUntilComplete {
    params.areGoverned = areGoverned;
    params.governed = governed;
  }

  function execute() internal override returns (bool) {
    FlashGovernanceArbiterLike(LimboDAOLike(DAO).getFlashGoverner()).setGoverned(params.governed, params.areGoverned);
    return true;
  }
}
