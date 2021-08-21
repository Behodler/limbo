// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "./Governable.sol";
import "hardhat/console.sol";
import "../facades/Burnable.sol";

contract FlashGovernanceArbiter is Governable {
    event flashDecision(
        address actor,
        address deposit_asset,
        uint256 amount,
        address target
    );
    mapping(address => bool) enforceLimitsActive;

    constructor(address dao) Governable(dao) {}

    struct FlashGovernanceConfig {
        address asset;
        uint256 amount;
        uint256 unlockTime;
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
    mapping(address => mapping(address => FlashGovernanceConfig))
        public pendingFlashDecision; //contract->user->config

    function assertGovernanceApproved(address sender, address target, bool emergency) public {
        if (
            IERC20(flashGovernanceConfig.asset).transferFrom(
                sender,
                address(this),
                flashGovernanceConfig.amount
            ) &&
            pendingFlashDecision[target][sender].unlockTime < block.timestamp
        ) {
            require(
               emergency || ( block.timestamp - security.lastFlashGovernanceAct >
                    security.epochSize),
                "Limbo: flash governance disabled for rest of epoch"
            );
            pendingFlashDecision[target][sender] = flashGovernanceConfig;
            pendingFlashDecision[target][sender].unlockTime += block.timestamp;

            security.lastFlashGovernanceAct = block.timestamp;
            emit flashDecision(
                sender,
                flashGovernanceConfig.asset,
                flashGovernanceConfig.amount,
                target
            );
        } else {
            revert("LIMBO: governance decision rejected.");
        }
    }

    function configureFlashGovernance(
        address asset,
        uint256 amount,
        uint256 unlockTime,
        bool assetBurnable
    ) public virtual onlySuccessfulProposal {
        flashGovernanceConfig.asset = asset;
        flashGovernanceConfig.amount = amount;
        flashGovernanceConfig.unlockTime = unlockTime;
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
        address targetContract,
        address user,
        address asset,
        uint256 amount
    ) public virtual onlySuccessfulProposal {
        if (pendingFlashDecision[targetContract][user].assetBurnable) {
            Burnable(asset).burn(amount);
        }

        pendingFlashDecision[targetContract][user] = flashGovernanceConfig;
    }

    function withdrawGovernanceAsset(address targetContract, address asset)
        public
        virtual
    {
        require(
            pendingFlashDecision[targetContract][msg.sender].asset == asset &&
                pendingFlashDecision[targetContract][msg.sender].amount > 0 &&
                pendingFlashDecision[targetContract][msg.sender].unlockTime <
                block.timestamp,
            "Limbo: Flashgovernance decision pending."
        );
        IERC20(pendingFlashDecision[targetContract][msg.sender].asset).transfer(
                msg.sender,
                pendingFlashDecision[targetContract][msg.sender].amount
            );
        delete pendingFlashDecision[targetContract][msg.sender];
    }

    function setEnforcement(bool enforce) public {
        enforceLimitsActive[msg.sender] = enforce;
    }

    function enforceToleranceInt(int256 v1, int256 v2) public view {
        if (!configured) return;
        uint256 uv1 = uint256(v1 > 0 ? v1 : -1 * v1);
        uint256 uv2 = uint256(v2 > 0 ? v2 : -1 * v2);
        enforceTolerance(uv1, uv2);
    }

    //bonus points for readability
    function enforceTolerance(uint256 v1, uint256 v2) public view {
        if (!configured || !enforceLimitsActive[msg.sender]) return;
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
