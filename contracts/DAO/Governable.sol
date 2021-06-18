// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;
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

    address public DAO;

    modifier onlySuccessfulProposal {
        require(
            LimboDAOLike(DAO).successfulProposal(msg.sender),
            "Limbo: flash governance not allowed."
        );
        _;
    }

    modifier governanceApproved {
        if (LimboDAOLike(DAO).successfulProposal(msg.sender)) {
            //quirk of modifier syntax: appears to do nothing if success
        } else if (
            IERC20(flashGovernanceConfig.asset).transferFrom(
                msg.sender,
                address(this),
                flashGovernanceConfig.amount
            ) && pendingFlashDecision[msg.sender].lockDuration < block.timestamp
        ) {
            require(
                block.timestamp - security.lastFlashGovernanceAct >
                    security.epochSize,
                "Limbo: flash governance disabled for rest of epoch"
            );
            pendingFlashDecision[msg.sender] = flashGovernanceConfig;
            pendingFlashDecision[msg.sender].lockDuration += block.timestamp;
            security.lastFlashGovernanceAct = block.timestamp;
        } else {
            revert("LIMBO: governance decision rejected.");
        }
        _;
    }

    constructor(address dao) {
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

    function enforceTolerance(uint256 v1, uint256 v2) internal view {
        if (v1 > v2) {
            require(((v1 - v2) * 100) / v1 < security.changeTolerance, "FE1");
        } else {
            require(((v2 - v1) * 100) / v1 < security.changeTolerance, "FE1");
        }
    }
}
