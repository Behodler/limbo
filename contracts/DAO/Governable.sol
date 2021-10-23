// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../facades/LimboDAOLike.sol";
import "../facades/FlashGovernanceArbiterLike.sol";
import "../facades/ProposalFactoryLike.sol";

abstract contract Governable {
    FlashGovernanceArbiterLike internal flashGoverner;
    bool public configured;
    address public DAO;

    function endConfiguration() public {
        configured = true;
    }

    modifier onlySuccessfulProposal() {
        assertSuccessfulProposal(msg.sender);
        _;
    }

    modifier onlySoulUpdateProposal(){
        assertSoulUpdateProposal(msg.sender);
        _;
    }

    function assertSoulUpdateProposal(address sender) internal view {
        (,,address proposalFactory) = LimboDAOLike(DAO).proposalConfig();
        require(!configured || sender == ProposalFactoryLike(proposalFactory).soulUpdateProposal(),"EJ");
        assertSuccessfulProposal(sender);
    }

    function _governanceApproved(bool emergency) internal {
        bool successfulProposal = LimboDAOLike(DAO).successfulProposal(
            msg.sender
        );
        if (successfulProposal) {
            flashGoverner.setEnforcement(false);
        } else if (configured)
            flashGoverner.assertGovernanceApproved(
                msg.sender,
                address(this),
                emergency
            );
    }

    modifier governanceApproved(bool emergency) {
        _governanceApproved(emergency);
        _;
        flashGoverner.setEnforcement(true);
    }

    function assertSuccessfulProposal(address sender) internal view {
        require(
            !configured || LimboDAOLike(DAO).successfulProposal(sender),
            "EJ"
        );
    }

    constructor(address dao) {
        setDAO(dao);
    }

    function setDAO(address dao) public {
        require(
            DAO == address(0) || msg.sender == DAO || !configured,
            "EK"
        );
        DAO = dao;
        flashGoverner = FlashGovernanceArbiterLike(
            LimboDAOLike(dao).getFlashGoverner()
        );
    }
}
