// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

//LOW LEVEL
error InvocationFailure(address recipient);
error NotAContract(address target);
error Create2Failed();
error AddressNonZero();
error OnlyOwner(address owner, address msgSender);

//ERC20
error ApproveToNonZero(address token, address spender, uint256 amount);
error InsufficinetFunds(uint256 balance, uint256 value);
error AllowanceExceeded(uint256 allowance, uint256 amount);
error AllowanceUnderflow(uint256 allowance, uint256 subtraction);
error OperationFailure();

//PyroToken
error StakeFailedInsufficientBalance(uint256 stake, uint256 userPyroBalance);
error Reantrancy();
error BaseTokenNotSet(address pyroToken);
error OnlyReceiver(address receiver, address msgSender);
error OnlyLoanOfficer(address officer, address msgSender);
error UnsustainablePyroLoan(uint256 stake, uint256 minStake);
error SlashPercentageTooHigh(uint256 slashPercentage);
error FunctionNoLongerAvailable();

//LIQUIDITYRECEIVER
error SnufferCapExpected(address expected, address actual);
error OnlyContracts(address target);
error AddressOccupied(address expectedAddress);
error LachesisValidationFailed(address token, bool valid, bool burnable);
error AddressPredictionInvariant(address actual, address expected);

//PYROWETHPROXY
error EthForwardingFailed(uint256 msgvalue, uint256 baseTokenAmount);

//V2MIGRATOR
error P3AmountInvariant(uint256 balanceAfter, uint balanceBefore,  uint expectedAmount);

//REBASE
error InvalidPyroToken();

//TESTING
error InfiniteLeverageForbidden(uint pyroEquivalent, uint pyroStaked);
