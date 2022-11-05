// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

enum FeeExemption{
    NO_EXEMPTIONS,
    
    SENDER_EXEMPT,
    SENDER_EXEMPT_AND_RECEIVER_EXEMPT,
    REDEEM_EXEMPT_AND_SENDER_EXEMPT,
    
    REDEEM_EXEMPT_AND_SENDER_EXEMPT_AND_RECEIVER_EXEMPT,

    RECEIVER_EXEMPT,
    REDEEM_EXEMPT_AND_RECEIVER_EXEMPT,
    REDEEM_EXEMPT_ONLY
}