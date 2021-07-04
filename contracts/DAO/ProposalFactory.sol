// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "../facades/LimboDAOLike.sol";
import "./Governable.sol";

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
        (, , , , address proposal) = DAO.currentProposalState();
        require(proposal != address(this), "LimboDAO: proposal locked");
        _;
    }

    function orchestrateExecute() public onlyDAO {
        require(execute(), "LimboDAO: execution of proposal failed");
    }

    function execute() internal virtual returns (bool);
}

contract ProposalFactory is Governable {
    mapping(address => bool) public whitelistedProposalContracts;

    constructor(address _dao, address whitelistingProposal) Governable(_dao) {
        whitelistedProposalContracts[whitelistingProposal] = true;
    }

    function toggleWhitelistProposal(address proposal)
        public
        onlySuccessfulProposal
    {
        whitelistedProposalContracts[proposal] = !whitelistedProposalContracts[
            proposal
        ];
    }

    function lodgeProposal(address proposal) public {
        require(
            whitelistedProposalContracts[proposal],
            "LimboDAO: invalid proposal"
        );
        LimboDAOLike(DAO).makeProposal(proposal, msg.sender);
    }
}
