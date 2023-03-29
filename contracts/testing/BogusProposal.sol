// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;
import "../DAO/ProposalFactory.sol";
import "../facades/FlashGovernanceArbiterLike.sol";
import "../facades/LimboDAOLike.sol";

/**
 * @author Justin Goro
 * @notice Earning Fate precludes owners of EYE based assets from earning Flan on Limbo. This proposal makes Fate monetizable into Flan in order to compensate users for the opportunity cost.
 */
contract BogusProposal is Proposal {
  constructor(address dao, string memory _description) Proposal(dao, description) {}

  uint256 number;

  function parameterize(uint256 num) public lockUntilComplete(num>=0) {
    number = num;
  }

  function execute() internal override returns (bool) {
    require(number > 10000);
    number = 2;
    return true;
  }
}
