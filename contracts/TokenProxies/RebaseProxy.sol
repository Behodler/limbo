// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;
import "../facades/TokenProxyLike.sol";
import "../openzeppelin/ERC20Burnable.sol";
import "../openzeppelin/SafeERC20.sol";

///@title Rebase Proxy
///@author Justin Goro
/**@notice expresses the balance changes of a rebase token as a fluctuating redeem rate, allowing for balanceOf stability. Useful for dapps which maintain their own balance values
 * Very large rebase down movement tokens are still discouraged as this could cause threshold instability.
 */
///@dev TokenProxyRegistry contract maps this token to a base token.
contract RebaseProxy is ERC20, TokenProxyLike {
  using SafeERC20 for IERC20;

  constructor(
    address _baseToken,
    string memory name_,
    string memory symbol_
  ) TokenProxyLike(_baseToken) ERC20(name_, symbol_) {}

  function redeemRate() public view returns (uint256) {
    uint256 balanceOfBase = IERC20(baseToken).balanceOf(address(this));
    if (totalSupply() == 0 || balanceOfBase == 0) return ONE;

    return (balanceOfBase * ONE) / totalSupply();
  }

  /**
   *@param to recipient of newly minted tokens
   *@param amount base token quantity to deduct from caller
   */
  function mint(address to, uint256 amount) public override returns (uint256) {
    uint256 _redeemRate = redeemRate();
    IERC20(baseToken).safeTransferFrom(msg.sender, address(this), amount);
    uint256 proxy = (amount * ONE) / _redeemRate;
    _mint(to, proxy);
    return proxy;
  }

  /**
   *@param to recipient of released base tokens
   *@param amount quantity of proxy tokens to deduct from caller
   */
  function redeem(address to, uint256 amount) public override returns (uint256) {
    uint256 baseTokens = (redeemRate() * amount) / ONE;
    _burn(msg.sender, amount);
    IERC20(baseToken).safeTransfer(to, baseTokens);
    return baseTokens;
  }
}
