// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;
import "./PyroToken.sol";
import * as RB from "./RebaseWrapper.sol";

contract BigConstants {
        bytes public constant PYROTOKEN_BYTECODE = type(PyroToken).creationCode;

        constructor(){

        }

        function deployRebaseWrapper (address pyroTokenAddress) external returns (address){
            return address(new RB.RebaseWrapper(pyroTokenAddress));
        }
}