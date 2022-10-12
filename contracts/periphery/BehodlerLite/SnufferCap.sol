// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;
import "../../facades/LiquidityReceiverLike.sol";

/*Snuffs out fees for given address */
abstract contract SnufferCap {
    LiquidityReceiverLike public _liquidityReceiver;

    constructor(address liquidityReceiver) {
        _liquidityReceiver = LiquidityReceiverLike(liquidityReceiver);
    }

    function snuff (address pyroToken, address targetContract, FeeExemption exempt) public virtual returns (bool);

    //after perfroming business logic, call this function
    function _snuff(address pyroToken, address targetContract, FeeExemption exempt)
        internal
    {
        _liquidityReceiver.setFeeExemptionStatusOnPyroForContract(pyroToken,targetContract,exempt);
    }
}
