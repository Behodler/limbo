// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../facades/LimboDAOLike.sol";
import "../facades/Burnable.sol";

abstract contract Governable {
    event flashDecision(address actor, address deposit_asset, uint256 amount);

    struct FlashGovernanceConfig {
        address asset;
        uint256 amount;
        uint256 lockDuration;
        bool assetBurnable;
    }

    struct SecurityParameters {
        uint8 maxGovernanceChangePerEpoch; //prevents flash governance from wrecking the incentives.
        uint256 epochSize; //only one flash governance action can happen per epoch to prevent governance DOS
        uint256 lastFlashGovernanceAct;
        uint8 changeTolerance; //1-100 maximum percentage any numeric variable can be changed through flash gov
    }

    FlashGovernanceConfig public flashGovernanceConfig;
    SecurityParameters public security;
    mapping(address => FlashGovernanceConfig) pendingFlashDecision;
    bool private configured;
    address public DAO;

    function endConfiguration() public {
        configured = true;
    }

    modifier onlySuccessfulProposal {
        assertSuccessfulProposal(msg.sender);
        _;
    }

    modifier governanceApproved {
        assertGovernanceApproved(msg.sender);
        _;
    }

    function assertSuccessfulProposal(address sender) internal view {
        require(
            !configured || LimboDAOLike(DAO).successfulProposal(sender),
            "Limbo: governance action failed."
        );
    }

    function assertGovernanceApproved(address sender) internal {
        if (!configured) return;
        if (LimboDAOLike(DAO).successfulProposal(sender)) {
            return;
        } else if (
            IERC20(flashGovernanceConfig.asset).transferFrom(
                sender,
                address(this),
                flashGovernanceConfig.amount
            ) && pendingFlashDecision[sender].lockDuration < block.timestamp
        ) {
            require(
                block.timestamp - security.lastFlashGovernanceAct >
                    security.epochSize,
                "Limbo: flash governance disabled for rest of epoch"
            );
            pendingFlashDecision[sender] = flashGovernanceConfig;
            pendingFlashDecision[sender].lockDuration += block.timestamp;
            security.lastFlashGovernanceAct = block.timestamp;
        } else {
            revert("LIMBO: governance decision rejected.");
        }
    }

    constructor(address dao) {
        setDAO(dao);
    }

    function setDAO(address dao) public {
        require(
            DAO == address(0) || msg.sender == DAO,
            "LimboDAO: access denied"
        );
        DAO = dao;
    }

    function configureFlashGovernance(
        address asset,
        uint256 amount,
        uint256 lockDuration,
        bool assetBurnable
    ) public virtual onlySuccessfulProposal {
        flashGovernanceConfig.asset = asset;
        flashGovernanceConfig.amount = amount;
        flashGovernanceConfig.lockDuration = lockDuration;
        flashGovernanceConfig.assetBurnable = assetBurnable;
    }

    function configureSecurityParameters(
        uint8 maxGovernanceChangePerEpoch,
        uint256 epochSize,
        uint8 changeTolerance
    ) public virtual onlySuccessfulProposal {
        security.maxGovernanceChangePerEpoch = maxGovernanceChangePerEpoch;
        security.epochSize = epochSize;
        require(security.changeTolerance < 100, "Limbo: % between 0 and 100");
        security.changeTolerance = changeTolerance;
    }

    function burnFlashGovernanceAsset(
        address user,
        address asset,
        uint256 amount
    ) public virtual onlySuccessfulProposal {
        if (pendingFlashDecision[user].assetBurnable) {
            Burnable(asset).burn(amount);
        }

        delete pendingFlashDecision[user];
    }

    function withdrawGovernanceAsset(address asset) public virtual {
        require(
            pendingFlashDecision[msg.sender].asset == asset &&
                pendingFlashDecision[msg.sender].amount > 0 &&
                pendingFlashDecision[msg.sender].lockDuration < block.timestamp,
            "Limbo: Flashgovernance decision pending."
        );
        IERC20(pendingFlashDecision[msg.sender].asset).transfer(
            msg.sender,
            pendingFlashDecision[asset].amount
        );
        delete pendingFlashDecision[msg.sender];
    }

    function enforceToleranceInt(int256 v1, int256 v2) internal view {
        uint256 uv1 = uint256(v1 > 0 ? v1 : -1 * v1);
        uint256 uv2 = uint256(v2 > 0 ? v2 : -1 * v2);
        enforceTolerance(uv1, uv2);
    }

    //bonus points for readability
    function enforceTolerance(uint256 v1, uint256 v2) internal view {
        if (v1 > v2) {
            if (v2 == 0) require(v1 <= 1, "FE1");
            else
                require(
                    ((v1 - v2) * 100) < security.changeTolerance * v1,
                    "FE1"
                );
        } else {
            if (v1 == 0) require(v2 <= 1, "FE1");
            else
                require(
                    ((v2 - v1) * 100) < security.changeTolerance * v1,
                    "FE1"
                );
        }
    }
}
