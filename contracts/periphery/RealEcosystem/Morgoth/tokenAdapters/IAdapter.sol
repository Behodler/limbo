// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;
import "../../../../openzeppelin/IERC20.sol";
/*
    Behodler implementation: 
    1. An adapter should always be registered as burnable. The burn function should then determine whether to burn or to forward to Pyrotokens
    2. Assuming the token at hand plays well with Pyrotokens and is not burnable, it shold be registered as valid with Lachesis and then used to 
    spawn a Pyrotoken before being disabled on Behodler.
 */
interface IAdapter is IERC20{
    function baseToken() external view returns (address);
    function burn (uint amount) external; 
}
