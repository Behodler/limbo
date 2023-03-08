// SPDX-License-Identifier: MIT
pragma solidity ^0.7.1;
import "../Powers.sol";
import "./IdempotentPowerInvoker.sol";

abstract contract TokenApproverLike {
  function config()
    public
    view
    virtual
    returns (
      address,
      address,
      address
    );

  function cliffFaceMapping(address) public view virtual returns (address);

  function morgothApproved(address) public view virtual returns (address);

  function morgothApprove(address token, bool approve) public virtual;

  function updateConfig(
    address proxyRegistry,
    address referenceToken,
    address behodler,
    address limbo,
    address flan
  ) public virtual;

  ///@notice in the event of botched generation
  function unmapCliffFace(address baseToken) public virtual;

  function blockBaseToken(address token, bool blocked) public virtual;
}

contract ConfigureTokenApproverPower is IdempotentPowerInvoker, Empowered {
  struct ApproveParams {
    address[] tokensToApprove;
    bool[] approved;
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

  struct BlockParams {
    address[] tokensToBlock;
    bool[] blockToken;
  }

  ApproveParams approveParams;
  UpdateConfigParams updateConfigParams;
  UnmapParams unmapParams;
  BlockParams blockParams;

  enum ExecutionChoice {
    Nothing,
    Approve,
    UpdateConfig,
    Unmap,
    BlockBaseToken
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

  function setApprove(address[] memory tokens, bool[] memory approved)
    public
    requiresPower("CONFIGURE_TOKEN_APPROVER")
    setChoice(ExecutionChoice.Approve)
  {
    approveParams.tokensToApprove = tokens;
    approveParams.approved = approved;
  }

  function setBlockBaseToken(address[] memory tokens, bool[] memory blockToken)
    public
    requiresPower("CONFIGURE_TOKEN_APPROVER")
    setChoice(ExecutionChoice.BlockBaseToken)
  {
    blockParams.tokensToBlock = tokens;
    blockParams.blockToken = blockToken;
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

  function setUnmapParams(address[] memory tokensToUnmap)
    public
    requiresPower("CONFIGURE_TOKEN_APPROVER")
    setChoice(ExecutionChoice.Unmap)
  {
    unmapParams.tokensToUnmap = tokensToUnmap;
  }

  function orchestrate() internal override resetChoice returns (bool) {
    TokenApproverLike tokenApprover = TokenApproverLike(angband.getAddress(power.domain));

    if (choice == ExecutionChoice.Approve) {
      ApproveParams memory ap = approveParams;
      for (uint256 i = 0; i < ap.tokensToApprove.length; i++) {
        tokenApprover.morgothApprove(ap.tokensToApprove[i], ap.approved[i]);
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
    } else if (choice == ExecutionChoice.BlockBaseToken) {
      BlockParams memory blocked = blockParams;
      for (uint256 i = 0; i < blocked.tokensToBlock.length; i++) {
        tokenApprover.blockBaseToken(blocked.tokensToBlock[i], blocked.blockToken[i]);
      }
    } else {
      return false;
    }
    return true;
  }
}
