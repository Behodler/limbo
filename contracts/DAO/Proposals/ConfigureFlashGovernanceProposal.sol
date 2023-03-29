// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;
import "../ProposalFactory.sol";
import "../../facades/LimboDAOLike.sol";
import "../../facades/FlashGovernanceArbiterLike.sol";

contract ConfigureFlashGovernanceProposal is Proposal {
  struct ParameterSet {
    address asset;
    uint256 amount;
    uint256 unlockTime;
    bool assetBurnable;
  }

  ParameterSet params;

  constructor(address dao, string memory _description) Proposal(dao, description) {}

  function parameterize(
    address asset,
    uint256 amount,
    uint256 unlockTime,
    bool assetBurnable
  ) public lockUntilComplete(true) {
    params.asset = asset;
    params.amount = amount;
    params.unlockTime = unlockTime;
    params.assetBurnable = assetBurnable;
  }

  function execute() internal override returns (bool) {
    FlashGovernanceArbiterLike(LimboDAOLike(DAO).getFlashGoverner()).configureFlashGovernance(
      params.asset,
      params.amount,
      params.unlockTime,
      params.assetBurnable
    );
    return true;
  }
}
