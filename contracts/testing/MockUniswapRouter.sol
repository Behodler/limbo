// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "../facades/UniswapRouterLike.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockUniswapRouter is UniswapRouterLike {

    function quote(
        uint256 amountA,
        uint256 reserveA,
        uint256 reserveB
    ) public pure override returns (uint256 amountB) {
        require(amountA > 0, "UniswapV2Library: INSUFFICIENT_AMOUNT");
        require(
            reserveA > 0 && reserveB > 0,
            "UniswapV2Library: INSUFFICIENT_LIQUIDITY"
        );
        amountB = (amountA * reserveB) / reserveA;
    }

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external override returns (uint256[] memory amounts) {
        IERC20(path[0]).transferFrom(msg.sender, address(this), amountIn);
        IERC20(path[1]).transfer(to, amountOutMin);
    }
}
