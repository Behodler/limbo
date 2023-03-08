// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;
import "../../../../openzeppelin/IERC20.sol";

///@dev Only use this directly for perpetual tokens. For threshold tokens, use BehodlerTokenProxy
abstract contract TokenProxyBaseLike {
    function mint(
        address proxyRecipient,
        address baseSource,
        uint256 amount
    ) public virtual returns (uint256 proxy);

    function redeem(
        address proxySource,
        address baseRecipient,
        uint256 amount
    ) public virtual returns (uint256 baseAmount);

    function redeemRate() public view virtual returns (uint256);

    function baseToken () public virtual view returns (address);
}
