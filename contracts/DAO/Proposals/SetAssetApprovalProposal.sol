// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;
import "../ProposalFactory.sol";

/**
 * @author Justin Goro
 * @notice EYE and EYE based assets can be used to earn fate. This proposal determines which tokens fall into the latter category.
 */
contract SetAssetApprovalProposal is Proposal {
  struct Parameters {
    address asset; //metaLP
    bool approved;
    bool uniswap;
    uint256 period;
  }

  Parameters public params;

  constructor(address dao, string memory _description) Proposal(dao, description) {}

  function parameterize(
    address asset,
    bool approved,
    bool uniswap,
    uint256 period
  ) public lockUntilComplete {
    params.asset = asset;
    params.approved = approved;
    params.uniswap = uniswap;
    params.period = period;
  }

  function execute() internal override returns (bool) {
    DAO.setApprovedAsset(params.asset, params.approved, params.uniswap, params.period);
    return true;
  }
}
