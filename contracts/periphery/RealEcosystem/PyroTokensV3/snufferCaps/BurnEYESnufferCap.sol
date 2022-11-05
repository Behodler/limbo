// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;
import * as Snuffer from "../facades/SnufferCap.sol";
import "../../../../openzeppelin/IERC20.sol";
import "../../../../facades/Enums.sol";
import "../../../../facades/Burnable.sol";


/**
 *@author Justin Goro
 *@notice demonstration of a snuffer cap that charges 1000 EYE to exempt a contract from paying a particular fee. The EYE is burnt.
 */
contract BurnEYESnufferCap is Snuffer.SnufferCap {
    Burnable eye;

    constructor(address EYE, address receiver) Snuffer.SnufferCap(receiver) {
        eye = Burnable(EYE);
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
    )
        public
        override
        completeSnuff(pyroToken, targetContract, exempt)
        returns (bool)
    {
        eye.transferFrom(msg.sender, address(this), 1000 * (1 ether));
        uint256 balance = eye.balanceOf(address(this));
        eye.burn(balance);
        return true;
    }
}
