// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;
import "../periphery/UniswapV2/interfaces/IUniswapV2Factory.sol";

/**
 *@title SoulReader
 * @author Justin Goro
 * @notice There are two reasons to gather reliable prices in Limbo: calculating Fate from relative EYE containing LP prices and pricing Flan during a migration to Behodler.
 * Neither requires up to date accuracy but must simply be resitant to tampering.
 * @dev This contract is based on the UniswapV2 ExampleOracleSimple. Originally, a simpler version of an Oracle was created but a tension emerged between griefing and security that only resolved in a hell of complication.
 */
abstract contract LimboOracleLike {
  function factory() public virtual returns (IUniswapV2Factory);

  function RegisterPair(address pairAddress, uint256 period) public virtual;

  function update(address token0, address token1) public virtual;

  function update(address pair) public virtual;

  function consult(
    address pricedToken,
    address referenceToken,
    uint256 amountIn
  ) external view virtual returns (uint256 amountOut);

  function getLastUpdate (address token1, address token2) public virtual view returns (uint32,uint);
}
