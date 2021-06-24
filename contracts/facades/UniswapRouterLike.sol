// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

abstract contract UniswapRouterLike {
        function quote(
        uint256 amountA,
        uint256 reserveA,
        uint256 reserveB
    ) public pure virtual returns (uint256 amountB);

       function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external virtual returns (uint[] memory amounts);
}