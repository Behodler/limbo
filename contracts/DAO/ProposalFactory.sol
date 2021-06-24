// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/access/Ownable.sol";
import "../facades/LimboDAOLike.sol";

abstract contract Proposal {
    string public description;
    LimboDAOLike DAO;

    constructor(address dao, string memory _description) {
        DAO = LimboDAOLike(dao);
        description = _description;
    }

    modifier onlyDAO {
        address dao = address(DAO);
        require(dao != address(0), "PROPOSAL: DAO not set");
        require(msg.sender == dao, "PROPOSAL: only DAO can invoke");
        _;
    }

    modifier notCurrent {
        require(
            DAO.currentProposal() != address(this),
            "LimboDAO: proposal locked"
        );
        _;
    }

    function orchestrateExecute() public onlyDAO {
        require(execute(), "LimboDAO: execution of proposal failed");
    }

    function execute() internal virtual returns (bool);
}

contract ProposalFactory is Ownable {
    LimboDAOLike dao;
    mapping(address => bool) public whitelistedProposalContracts;

    function seed(address _dao) public onlyOwner {
        dao = LimboDAOLike(_dao);
    }

    function toggleWhitelistProposal(address proposal) public onlyOwner {
        whitelistedProposalContracts[proposal] = !whitelistedProposalContracts[
            proposal
        ];
    }

    function lodgeProposal(address proposal) public {
        require(
            whitelistedProposalContracts[proposal],
            "LimboDAO: invalid proposal"
        );
         dao.makeProposal(proposal, msg.sender);
    }
}
