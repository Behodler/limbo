// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

abstract contract FlashLoanArbiterLike {
    function canBorrow (address borrower) public virtual returns (bool);
}