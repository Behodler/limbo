// SPDX-License-Identifier: MIT
pragma solidity ^0.7.1;
import "../openzeppelin/IERC20.sol";

interface Behodler_071Like is IERC20_071 {
    function addLiquidity(address inputToken, uint256 amount)
        external
        payable
        returns (uint256 deltaSCX);

    function withdrawLiquidityFindSCX(
        address outputToken,
        uint256 tokensToRelease,
        uint256 scx,
        uint256 passes
    ) external view returns (uint256);

    function setValidToken(
        address token,
        bool valid,
        bool burnable
    ) external;
}
