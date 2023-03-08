// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;
import "../ProposalFactory.sol";
import "../../facades/ProposalFactoryLike.sol";

// import "hardhat/console.sol";

/**
 * @author Justin Goro
 * @notice LimboDAO sets Flan minting rights.
 */
contract ApproveFlanMintingProposal is Proposal {
  struct Parameters {
    address minter;
    bool enabled;
  }

  Parameters public params;

  constructor(address dao, string memory _description) Proposal(dao, description) {}

  function parameterize(address minter, bool enabled) public lockUntilComplete {
    params.minter = minter;
    params.enabled = enabled;
  }

  function execute() internal override returns (bool) {
    LimboDAOLike(DAO).approveFlanMintingPower(params.minter, params.enabled);
    return true;
  }
}
