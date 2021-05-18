// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/access/Ownable.sol";
import "../facades/LimboDAOLike.sol";

abstract contract Proposal {
    uint256 public timeProposed;
    bytes32 internal description;
    LimboDAOLike DAO;

    constructor(address dao, bytes32 _description) {
        DAO = LimboDAOLike(dao);
        description = _description;
    }

    modifier onlyDAO {
        address dao = address(DAO);
        require(dao != address(0), "PROPOSAL: MDAO not set");
        require(msg.sender == dao, "PROPOSAL: only MDAO can invoke");
        _;
    }

    function orchestrateExecute() public onlyDAO {
        require(execute(), "LimboDAO: execution of proposal failed");
    }

    function execute() internal virtual returns (bool);
}

contract GrantLimboMintingPower is Proposal {
    address minter;
    bool enabled;

    constructor(
        address _minter,
        bool _enabled,
        address dao,
        bytes32 _description
    ) Proposal(dao, _description) {}

    function parameterize(address _minter, bool _enabled) public {
        minter = _minter;
        enabled = _enabled;
    }

    function execute() internal override returns (bool) {
        DAO.approveFlanMintingPower(minter, enabled);
        return true;
    }
}

contract ProposalFactory is Ownable {
    LimboDAOLike dao;
    mapping (address => bool) public whitelistedProposalContracts;


    function seed(address _dao) public onlyOwner {
        dao = LimboDAOLike(_dao);
    }

    function toggleWhitelistProposal (address proposal) public onlyOwner {
        whitelistedProposalContracts[proposal] = !whitelistedProposalContracts[proposal] ;
    }

    function lodgeProposal (address proposal) public onlyOwner {
        require(whitelistedProposalContracts[proposal], "LimboDAO: invalid proposal");
        dao.makeProposal(proposal, msg.sender);
    }
}
