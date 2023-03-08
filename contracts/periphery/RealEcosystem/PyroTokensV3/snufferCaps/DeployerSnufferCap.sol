// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;
import "../../../../facades/Enums.sol";
import "../facades/SnufferCap.sol";
import "../../../../openzeppelin/IERC20.sol";

abstract contract GovernableLike {
  function temporaryConfigurationLord() public virtual returns (address);
}

/**
 *@author Justin Goro
 *@notice Let's the Limbo deployer set snuffer cap details. 
 As soon as Limbo is set to live, this snuffer cap will no longer work.

 */
contract DeployerSnufferCap is SnufferCap {
  event DeployerSnufferCapDisabled(address indexed callingUser, uint256 blockNumber);
  bool public disabled;
  address deployer;

  constructor(address receiver) SnufferCap(receiver) {
    deployer = msg.sender;
  }

  function disable() public{
    require(msg.sender == deployer,"Only deployer can call");
    disabled = true;
    emit DeployerSnufferCapDisabled(msg.sender, block.number);
  }

  /**
   *@notice anyone willing to pay 1000 EYE can call this for any contract. Probably not ideal to deploy this contract as
   * there may be good business case reasons for wanting to keep the burn.
   *@param pyroToken contract of pyroToken for which the fee exemption applies
   *@param targetContract contract that will not pay fee.
   */
  function snuff(
    address pyroToken,
    address targetContract,
    FeeExemption exempt
  ) public override completeSnuff(pyroToken, targetContract, exempt) returns (bool) {
    if (disabled) revert("DeployerSnufferCap disabled");
    return true;
  }
}
