// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;
import "../openzeppelin/SafeERC20.sol";
import "../openzeppelin/ERC20Burnable.sol";

///@dev Only use this directly for perpetual tokens. For threshold tokens, use BehodlerTokenProxy
contract TokenProxyBase is ERC20Burnable {
  using SafeERC20 for IERC20;
  address public immutable proxyRegistry;

  address internal immutable baseToken;
  uint256 internal constant ONE = 1 ether;

constructor(
    address _baseToken,
    string memory name_,
    string memory symbol_,
    address registry
  ) ERC20(name_, symbol_) {
    baseToken = _baseToken;
    proxyRegistry = registry;
  }

  /**
   *@param R_amp amplify the redeem rate and mint less for each baseToken. 
   */
  function mint(
    uint256 R_amp,
    address proxyRecipient,
    address baseSource,
    uint256 amount
  ) internal returns (uint256 proxy) {
    uint256 _redeemRate = (redeemRate() * R_amp) / ONE;
    uint256 balanceBefore = IERC20(baseToken).balanceOf(address(this));
    IERC20(baseToken).safeTransferFrom(baseSource, address(this), amount);
    uint256 baseAmount = IERC20(baseToken).balanceOf(address(this)) - balanceBefore;
    proxy = ((baseAmount * ONE) / _redeemRate);
    _mint(proxyRecipient, proxy);
  }

  function redeem(address proxySource, address baseRecipient, uint256 amount) public returns (uint256 baseAmount){
    uint _redeemRate = redeemRate();
    _burn(proxySource, amount);
    baseAmount = (amount * _redeemRate) / ONE;
    IERC20(baseToken).safeTransfer(baseRecipient, baseAmount);
  }

  function redeemRate() public view returns (uint256) {
    uint256 balanceOfBase = IERC20(baseToken).balanceOf(address(this));
    if (totalSupply() == 0 || balanceOfBase == 0) return ONE;

    return (balanceOfBase * ONE) / totalSupply();
  }

  
  function migrateBaseReserveToNewProxy(address newProxy) public {
    if (msg.sender != proxyRegistry) {
      revert OnlyProxy(msg.sender, proxyRegistry);
    }
    IERC20 base = IERC20(baseToken);
    base.transfer(newProxy, base.balanceOf(address(this)));
  }
}
