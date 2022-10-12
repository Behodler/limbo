
// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;
import "../../openzeppelin/IERC20.sol";
import "../../facades/LiquidityReceiverLike.sol";
import "./SnufferCap.sol";

/**
 * @dev Interface of the ERC20 standard as defined in the EIP but with a burn friendly extra param added to transfer
 */

abstract contract BurnableERC20 is IERC20 {
    function burn (uint value) public virtual;
}

contract BurnEYESnufferCap is SnufferCap {
    BurnableERC20 eye;

    constructor(address EYE, address receiver) SnufferCap(receiver) {
        eye = BurnableERC20(EYE);
    }

    function snuff(
        address pyroToken,
        address targetContract,
        FeeExemption exempt
    ) public override returns (bool) {
        require(eye.transferFrom(msg.sender,address(this), 1000 * (1 ether)),"ERC20: transfer failed.");
        uint balance = eye.balanceOf(address(this));
        eye.burn(balance);
        _snuff(pyroToken, targetContract, exempt);
        return true;
    }
}
