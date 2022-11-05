// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;
import "./BigConstantsLike.sol";
import "./Enums.sol";

abstract contract LiquidityReceiverLike{
 
  BigConstantsLike public bigConstants;

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