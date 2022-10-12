// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;
import "../openzeppelin/SafeERC20.sol";
import "../openzeppelin/ERC20Burnable.sol";

///@dev Only use this directly for perpetual tokens. For threshold tokens, use BehodlerTokenProxy
contract TokenProxyBase is ERC20 {
  using SafeERC20 for IERC20;
  bool public constant IS_PROXY = true;
  address public immutable proxyRegistry;

  address public immutable baseToken;

  uint256 public immutable initialRedeemRate;

  constructor(
    address _baseToken,
    string memory name_,
    string memory symbol_,
    address registry,
    uint256 _initialRedeemRate
  ) ERC20(name_, symbol_) {
    baseToken = _baseToken;
    proxyRegistry = registry;
    initialRedeemRate = _initialRedeemRate;
  }

  modifier onlyRegistry() {
    if (msg.sender != proxyRegistry) {
      revert OnlyProxy(msg.sender, proxyRegistry);
    }
    _;
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
    uint256 _redeemRate = (redeemRate() * R_amp) / initialRedeemRate;
    uint256 balanceBefore = IERC20(baseToken).balanceOf(address(this));

    IERC20(baseToken).safeTransferFrom(baseSource, address(this), amount);
    uint256 baseAmount = IERC20(baseToken).balanceOf(address(this)) - balanceBefore;
    proxy = ((baseAmount * initialRedeemRate) / _redeemRate);
    _mint(proxyRecipient, proxy);
  }

  ///@notice public facing mint for PyroToken usage
  function mint(
    address proxyRecipient,
    address baseSource,
    uint256 amount
  ) public returns (uint256 proxy) {
    uint256 _redeemRate = redeemRate();
    uint256 balanceBefore = IERC20(baseToken).balanceOf(address(this));

    IERC20(baseToken).safeTransferFrom(baseSource, address(this), amount);
    uint256 baseAmount = IERC20(baseToken).balanceOf(address(this)) - balanceBefore;
    proxy = ((baseAmount * initialRedeemRate) / _redeemRate);
    _mint(proxyRecipient, proxy);
  }

  function redeem(
    address proxySource,
    address baseRecipient,
    uint256 amount
  ) public returns (uint256 baseAmount) {
    uint256 _redeemRate = redeemRate();
    _burn(proxySource, amount);
    baseAmount = (amount * _redeemRate) / initialRedeemRate;
    IERC20(baseToken).safeTransfer(baseRecipient, baseAmount);
  }

  function redeemRate() public view returns (uint256) {
    uint256 balanceOfBase = IERC20(baseToken).balanceOf(address(this));
    if (totalSupply() == 0 || balanceOfBase == 0) return initialRedeemRate;

    return (balanceOfBase * initialRedeemRate) / totalSupply();
  }

  function migrateBaseReserveToNewProxy(address newProxy) public onlyRegistry {
    IERC20 base = IERC20(baseToken);
    base.transfer(newProxy, base.balanceOf(address(this)));
  }

  function withdrawReserve() public onlyRegistry {
    IERC20(baseToken).safeTransfer(msg.sender, IERC20(baseToken).balanceOf(address(this)));
  }
}
