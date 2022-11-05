// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;
import "../../../../facades/LiquidityReceiverLike.sol";
import "../../../../facades/Enums.sol";


/**
 *@author Justin Goro
 *@notice Snuffer caps are gatekeeper contracts for applying logic to the exemption of pyrotoken fee payment.
 *The SnufferCap is asigned on the LiquidityReceiverV2 level which means all PyroTokens conform to the same snuffer cap at any one time
 */
abstract contract SnufferCap {
    /**
     *@param pyroToken contract of pyroToken for which the fee exemption applies
     *@param target contract that will not pay fee.
     *@param exempt fee exemption type
     */
    event Snuffed(
        address indexed pyroToken,
        address indexed target,
        FeeExemption exempt
    );

    LiquidityReceiverLike public _liquidityReceiver;

    constructor(address liquidityReceiver) {
        _liquidityReceiver = LiquidityReceiverLike(liquidityReceiver);
    }

    modifier completeSnuff(
        address pyroToken,
        address targetContract,
        FeeExemption exempt
    ) {
        _;
        _snuff(pyroToken, targetContract, exempt);
    }

    /**
 *@dev Implement this function for all business logic prior to calling snuff. 
 For simplicity, decorate your implementation with the completeSnuff modifier.
 @param pyroToken the pyrotoken for which a fee is being turned off
 @param targetContract the contract that will be exempted.
 @param exempt the type of exemption
 */
    function snuff(
        address pyroToken,
        address targetContract,
        FeeExemption exempt
    ) public virtual returns (bool);

    ///@dev after perfroming business logic, call this function or decorate with the completeSnuff modifier.
    function _snuff(
        address pyroToken,
        address targetContract,
        FeeExemption exempt
    ) internal {
        _liquidityReceiver.setFeeExemptionStatusOnPyroForContract(
            pyroToken,
            targetContract,
            exempt
        );
        emit Snuffed(pyroToken, targetContract, exempt);
    }
}
