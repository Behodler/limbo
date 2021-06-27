// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../facades/LimboDAOLike.sol";
import "../facades/Burnable.sol";
import "../facades/FlashGovernanceArbiterLike.sol";

abstract contract Governable {
    FlashGovernanceArbiterLike internal flashGoverner;
    bool public configured;
    address public DAO;

    function endConfiguration() public {
        configured = true;
    }

    modifier onlySuccessfulProposal {
        assertSuccessfulProposal(msg.sender);
        _;
    }

    modifier governanceApproved {
        if (configured && !LimboDAOLike(DAO).successfulProposal(msg.sender))
            flashGoverner.assertGovernanceApproved(msg.sender, address(this));
        _;
    }

    function assertSuccessfulProposal(address sender) internal view {
        require(
            !configured || LimboDAOLike(DAO).successfulProposal(sender),
            "Limbo: governance action failed."
        );
    }

    constructor(address dao) {
        setDAO(dao);
    }

    function setDAO(address dao) public {
        require(
            DAO == address(0) || msg.sender == DAO || !configured,
            "LimboDAO: access denied"
        );
        DAO = dao;
        flashGoverner = FlashGovernanceArbiterLike(
            LimboDAOLike(dao).getFlashGoverner()
        );
    }
}
