// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;
import "../facades/LimboDAOLike.sol";
import "./Governable.sol";
import "../openzeppelin/Ownable.sol";
import "../periphery/Errors.sol";

// import "hardhat/console.sol";

///@title Proposal
///@author Justin Goro
///@notice suggested base contract for proposals on Limbo. Not strictly enforced but strongly recommended
abstract contract Proposal {
  string public description;
  bool public locked;
  LimboDAOLike immutable DAO;

  constructor(address dao, string memory _description) {
    DAO = LimboDAOLike(dao);
    description = _description;
  }

  modifier onlyProposalFactoryOrDAO() {
    address dao = address(DAO);
    (, , address proposalFactory) = DAO.proposalConfig();
    if(msg.sender!=dao && msg.sender!=proposalFactory){
      revert OnlyFactoryOrDAO(dao, proposalFactory);
    }
    _;
  }

  modifier lockUntilComplete() {
    if(locked){
      revert ProposalLocked(address(this));
    }
    _;
    locked = true;
  }

  function setLocked(bool _locked) public onlyProposalFactoryOrDAO {
    locked = _locked;
  }

  function orchestrateExecute() public onlyProposalFactoryOrDAO {
    if(!execute()){
      revert ExecutionFailed();
    }
  }

  //override this function with all proposal logic. Only instructions included in this function will be executed if the proposal is a success.
  function execute() internal virtual returns (bool);
}

///@title Proposal Factory
///@author Justin Goro
///@notice authenticates and gatekeeps proposals up for vote on LimboDAO.
///@dev constructors are prefered to initializers when an imporant base contract exists.
contract ProposalFactory is Governable, Ownable {
  mapping(address => bool) public whitelistedProposalContracts;
  address public soulUpdateProposal;
  event LodgingStatus(address indexed proposal, string status);

  constructor(
    address _dao,
    address whitelistingProposal,
    address _soulUpdateProposal
  ) Governable(_dao) {
    //in order for proposals to be white listed, an initial whitelisting proposal needs to be whitelisted at deployment
    whitelistedProposalContracts[whitelistingProposal] = true;
    whitelistedProposalContracts[_soulUpdateProposal] = true;
    soulUpdateProposal = _soulUpdateProposal;
  }

  ///@notice SoulUpdateProposal is one of the most important proposals and governs the creation of new staking souls.
  ///@dev onlyOwner denotes that this important function is overseen by MorgothDAO.
  ///@param newProposal new update soul
  function changeSoulUpdateProposal(address newProposal) public onlyOwner {
    soulUpdateProposal = newProposal;
  }

  ///@notice there is no formal onchain enforcement of proposal structure and compliance. Proposal contracts must first be white listed for usage
  function toggleWhitelistProposal(address proposal) public onlySuccessfulProposal {
    whitelistedProposalContracts[proposal] = !whitelistedProposalContracts[proposal];
  }

  /**@notice user facing function to vote on a new proposal. 
  Note that the proposal contract must first be whitelisted for usage
  Does not revert on a failed lodging because the proposal must be unlocked on failure. 
  This breaks convention for the sake of security. If you wrap this contract so it reverts, your 
  proposal will be left in an invalid state if lodging reverts.
  * @param proposal whitelisted popular contract
  */
  function lodgeProposal(address proposal) public {
    string memory status = "SUCCESS";
    bool success;
    if (whitelistedProposalContracts[proposal]) {
      if(!Proposal(proposal).locked()){
        revert ProposalNotLocked(proposal);
      }
      (success, ) = DAO.call(abi.encodeWithSignature("makeProposal(address,address)", proposal, msg.sender));
      if (!success) {
        status = "FAILED";
      }
    } else {
      status = "NOT_WHITELISTED";
      success = false;
    }
    if (!success) Proposal(proposal).setLocked(false);
    emit LodgingStatus(proposal, status);
  }
}
