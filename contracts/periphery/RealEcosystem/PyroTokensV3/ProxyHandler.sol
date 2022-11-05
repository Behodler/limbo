// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;
import "../../../facades/PyroTokenLike.sol";
import "./facades/TokenProxyBaseLike.sol";
import "../../../openzeppelin/IERC20.sol";
import * as Error from "./Errors.sol";

/**
*@author Justin Goro
*@title ProxyHandler for Behodler
*@notice For the proxy tokens such as CliffFace, the holder of a pyroToken is interested in the underlying base token, not the proxy token. 
This contract performs single transaction wrapping and unwrapping analogous to PyroWethProxy
*@dev On deploy, remember to exempt this from FOT and REdeem fees
*/
contract ProxyHandler {
    uint256 constant ONE = 1e18;

    /**
     *@notice Once off ERC20 approve to save gas
     *@param pyro PyroToken for which minting of baseToke should be approved
     */
    function approvePyroTokenForProxy(address pyro) external returns (bool) {
        (, IERC20 proxyToken, , ) = PyroTokenLike(pyro).config();
        proxyToken.approve(pyro, type(uint256).max);
        return true;
    }

    ///@param pyroToken pyroToken of proxy of base.
    ///@notice For a given pyroToken that wraps a proxy, we want to know how many units of the proxy's base token we'd get for 1 PyroToken
    function baseRedeemRate(address pyroToken) public view returns (uint256) {
        uint256 pyroRedeemRate = PyroTokenLike(pyroToken).redeemRate();
        (, IERC20 proxyToken, , ) = PyroTokenLike(pyroToken).config();
        TokenProxyBaseLike proxy = TokenProxyBaseLike(address(proxyToken));
        uint256 proxyRedeemRate = proxy.redeemRate();
        return (pyroRedeemRate * proxyRedeemRate) / ONE;
    }

    /**
    @notice allows a pyroToken to be minted from a base token without requiring the user go through an intermediate proxy
    @param pyroToken The PyroToken minted and redeemed on Behodler
    @param baseAmount the quantity of baseToken
     */
    function mintPyroFromBase(address pyroToken, uint256 baseAmount)
        public
        returns (uint256)
    {
        (, IERC20 proxyToken, , ) = PyroTokenLike(pyroToken).config();
        TokenProxyBaseLike proxy = TokenProxyBaseLike(address(proxyToken));
        uint256 proxyMinted = proxy.mint(address(this), msg.sender, baseAmount);
        return PyroTokenLike(pyroToken).mint(msg.sender, proxyMinted);
    }

    /**
    @notice allows a pyroToken to be redeemed for a base token without requiring the user go through an intermediate proxy
    @param pyroToken The PyroToken minted and redeemed on Behodler
    @param pyroAmount the quantity of pyroToken to redeem
     */
    function redeemFromPyro(address pyroToken, uint256 pyroAmount)
        public
        returns (uint256)
    {
        PyroTokenLike pyro = PyroTokenLike(pyroToken);
        //NB. This must be exempt from FOT
        pyro.transferFrom(msg.sender, address(this), pyroAmount);
        (, IERC20 proxyToken, , ) = PyroTokenLike(pyroToken).config();

        TokenProxyBaseLike proxy = TokenProxyBaseLike(address(proxyToken));

        uint256 proxyRedeemed = pyro.redeem(address(this), pyroAmount);
        return proxy.redeem(address(this), msg.sender, proxyRedeemed);
    }
}
