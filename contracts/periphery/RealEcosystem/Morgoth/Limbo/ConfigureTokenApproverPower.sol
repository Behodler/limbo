// SPDX-License-Identifier: MIT
pragma solidity ^0.7.1;
import "../Powers.sol";
import "./IdempotentPowerInvoker.sol";

abstract contract TokenApproverLike {
  function config() public view virtual returns (address, address, address);

  function cliffFaceMapping(address) public view virtual returns (address);

  function morgothApproved(address) public view virtual returns (address);

  function approveOrBlock(address token, bool approve, bool blocked) public virtual;

  function updateConfig(
    address proxyRegistry,
    address referenceToken,
    address behodler,
    address limbo,
    address flan
  ) public virtual;

  ///@notice in the event of botched generation
  function unmapCliffFace(address baseToken) public virtual;
}

contract ConfigureTokenApproverPower is IdempotentPowerInvoker, Empowered {
  struct ApproveOrBlockParams {
    address[] tokens;
    bool[] approved;
    bool[] blocked;
  }

  struct UpdateConfigParams {
    address proxyRegistry;
    address referenceToken;
    address behodler;
    address limbo;
    address flan;
  }

  struct UnmapParams {
    address[] tokensToUnmap;
  }

  ApproveOrBlockParams approveOrBlockParams;
  UpdateConfigParams updateConfigParams;
  UnmapParams unmapParams;

  enum ExecutionChoice {
    Nothing,
    UpdateConfig,
    Unmap,
    ApproveOrBlock
  }
  ExecutionChoice public choice;

  function getChoice() public view returns (uint256) {
    return uint256(choice);
  }

  modifier resetChoice() {
    _;
    choice = ExecutionChoice.Nothing;
  }

  modifier setChoice(ExecutionChoice selectedChoice) {
    choice = selectedChoice;
    _;
  }

  constructor(address _angband, address powers) IdempotentPowerInvoker("CONFIGURE_TOKEN_APPROVER", _angband) {
    powersRegistry = PowersRegistry(powers);
    initialized = true;
  }

  function setApproveOrBlock(
    address[] memory tokens,
    bool[] memory approved,
    bool[] memory blocked
  ) public requiresPower("CONFIGURE_TOKEN_APPROVER") setChoice(ExecutionChoice.ApproveOrBlock) {
    approveOrBlockParams.tokens = tokens;
    approveOrBlockParams.approved = approved;
    approveOrBlockParams.blocked = blocked;
  }

  function setUpdateConfig(
    address proxyRegistry,
    address referenceToken,
    address behodler,
    address limbo,
    address flan
  ) public requiresPower("CONFIGURE_TOKEN_APPROVER") setChoice(ExecutionChoice.UpdateConfig) {
    updateConfigParams.behodler = behodler;
    updateConfigParams.referenceToken = referenceToken;
    updateConfigParams.proxyRegistry = proxyRegistry;
    updateConfigParams.limbo = limbo;
    updateConfigParams.flan = flan;
  }

  function setUnmapParams(
    address[] memory tokensToUnmap
  ) public requiresPower("CONFIGURE_TOKEN_APPROVER") setChoice(ExecutionChoice.Unmap) {
    unmapParams.tokensToUnmap = tokensToUnmap;
  }

  function orchestrate() internal override resetChoice returns (bool) {
    TokenApproverLike tokenApprover = TokenApproverLike(angband.getAddress(power.domain));

    if (choice == ExecutionChoice.ApproveOrBlock) {
      ApproveOrBlockParams memory ap = approveOrBlockParams;
      for (uint256 i = 0; i < ap.tokens.length; i++) {
        tokenApprover.approveOrBlock(ap.tokens[i], ap.approved[i], ap.blocked[i]);
      }
    } else if (choice == ExecutionChoice.UpdateConfig) {
      tokenApprover.updateConfig(
        updateConfigParams.proxyRegistry,
        updateConfigParams.referenceToken,
        updateConfigParams.behodler,
        updateConfigParams.limbo,
        updateConfigParams.flan
      );
    } else if (choice == ExecutionChoice.Unmap) {
      UnmapParams memory UP = unmapParams;
      for (uint256 i = 0; i < UP.tokensToUnmap.length; i++) {
        tokenApprover.unmapCliffFace(UP.tokensToUnmap[i]);
      }
    } else {
      return false;
    }
    return true;
  }
}
