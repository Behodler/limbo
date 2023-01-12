// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;
import "../periphery/Errors.sol";
import "../facades/LimboDAOLike.sol";
import "../facades/FlashGovernanceArbiterLike.sol";
import "../facades/ProposalFactoryLike.sol";

///@title Governable
///@author Justin Goro
/**@dev Contracts that implement this can be governed by LimboDAO.
 * Depending on the importance and context, you can enforce governance oversight with one of two modifiers:
 *       -enforceGovernance will execute if either a proposal passes with a yes vote or if the caller is using flash governance
 *       -onlySuccessfulProposals will only execute if a proposal passes with a yes vote.
 */
abstract contract Governable {
  address public temporaryConfigurationLord;
  address public DAO;

  /**@notice during initial setup, requiring strict multiday proposals for calibration would unecessarily delay release.
   * As long as configured is false, the contract has no governance enforcement. Calling endConfiguration is a one way operation
   * to ensure governance mechanisms kick in. As a user, do not interact with these contracts if configured is false.
   * Only the original contract deployer can call endConfiguration. This is to protect against backrunning.
   * If other variables were sneakily changed, the DAO can always correct those through traditional tedious means. Then
   * backrunning becomes a mere inconvenience
   */
  function endConfiguration(address expectedDAO) public {
    if (msg.sender != temporaryConfigurationLord) {
      revert AccessDenied(temporaryConfigurationLord, msg.sender);
    }
    if (expectedDAO != DAO) revert BackrunDetected(expectedDAO, DAO);

    temporaryConfigurationLord = address(0);
  }

  function configured() public view returns (bool) {
    return temporaryConfigurationLord == address(0);
  }

  modifier onlySuccessfulProposal() {
    //modifiers are inline macros so you'd get a lot of code duplication if you don't refactor (EIP-170)
    assertSuccessfulProposal(msg.sender);
    _;
  }

  modifier onlySoulUpdateProposal() {
    assertSoulUpdateProposal(msg.sender);
    _;
  }

  function assertSoulUpdateProposal(address sender) internal view {
    (, , address proposalFactory) = LimboDAOLike(DAO).proposalConfig();
    if (configured() && sender != ProposalFactoryLike(proposalFactory).soulUpdateProposal()) {
      revert GovernanceActionFailed(configured(), sender);
    }
    assertSuccessfulProposal(sender);
  }

  function _governanceApproved(bool emergency) internal {
    bool successfulProposal = LimboDAOLike(DAO).successfulProposal(msg.sender);
    FlashGovernanceArbiterLike refreshedGoverner = flashGoverner();
    if (successfulProposal) {
      refreshedGoverner.setEnforcement(false);
    } else if (configured()) {
      refreshedGoverner.setEnforcement(true);
      refreshedGoverner.assertGovernanceApproved(msg.sender, address(this), emergency);
    }
  }

  modifier governanceApproved(bool emergency) {
    _governanceApproved(emergency);
    _;
  }

  function assertSuccessfulProposal(address sender) internal view {
    if (configured() && !LimboDAOLike(DAO).successfulProposal(sender)) {
      revert GovernanceActionFailed(configured(), sender);
    }
  }

  constructor(address dao) {
    temporaryConfigurationLord = msg.sender;
    setDAO(dao);
  }

 function flashGoverner() internal view returns (FlashGovernanceArbiterLike) {    
    return  FlashGovernanceArbiterLike(LimboDAOLike(DAO).getFlashGoverner());
  }

  ///@param dao The LimboDAO contract address
  function setDAO(address dao) public {
    if (configured()) {
      revert AccessDenied(temporaryConfigurationLord, msg.sender);
    }
    DAO = dao;
  }
}
