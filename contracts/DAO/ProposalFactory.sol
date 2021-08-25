// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "../facades/LimboDAOLike.sol";
import "./Governable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

abstract contract Proposal {
    string public description;
    LimboDAOLike DAO;

    constructor(address dao, string memory _description) {
        DAO = LimboDAOLike(dao);
        description = _description;
    }

    modifier onlyDAO() {
        address dao = address(DAO);
        require(dao != address(0), "PROPOSAL: DAO not set");
        require(msg.sender == dao, "PROPOSAL: only DAO can invoke");
        _;
    }

    modifier notCurrent() {
        (, , , , address proposal) = DAO.currentProposalState();
        require(proposal != address(this), "LimboDAO: proposal locked");
        _;
    }

    function orchestrateExecute() public onlyDAO {
        require(execute(), "LimboDAO: execution of proposal failed");
    }

    function execute() internal virtual returns (bool);
}

contract ProposalFactory is Governable, Ownable {
    mapping(address => bool) public whitelistedProposalContracts;
    address public soulUpdateProposal;

    constructor(
        address _dao,
        address whitelistingProposal,
        address _soulUpdateProposal
    ) Governable(_dao) {
        whitelistedProposalContracts[whitelistingProposal] = true;
        whitelistedProposalContracts[_soulUpdateProposal] = true;
        soulUpdateProposal = _soulUpdateProposal;
    }

    //MorgothDAO is the ultimate rule maker
    function changeSoulUpdateProposal(address newProposal) public onlyOwner {
        soulUpdateProposal = newProposal;
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
