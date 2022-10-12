// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

enum FeeExemption{
    NO_EXEMPTIONS,
    
    SENDER_EXEMPT,
    SENDER_AND_RECEIVER_EXEMPT,
    REDEEM_EXEMPT_AND_SENDER_EXEMPT,
    
    REDEEM_EXEMPT_AND_SENDER_AND_RECEIVER_EXEMPT,

    RECEIVER_EXEMPT,
    REDEEM_EXEMPT_AND_RECEIVER_EXEMPT,
    REDEEM_EXEMPT_ONLY
}


abstract contract LiquidityReceiverLike{
 

    function setFeeExemptionStatusOnPyroForContract(
        address pyroToken,
        address target,
        FeeExemption exemption
    ) public virtual;

    function setPyroTokenLoanOfficer(address pyroToken, address loanOfficer)
        public
        virtual;

    function getPyroToken(address baseToken)
        public
        view
        virtual
        returns (address);

    function registerPyroToken(
        address baseToken,
        string memory name,
        string memory symbol
    ) public virtual;

    function drain(address baseToken) external virtual returns (uint);
}