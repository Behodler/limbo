// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;
import "../openzeppelin/SafeERC20.sol";
import "../openzeppelin/ERC20Burnable.sol";
import "../libraries/RedeemableMaths.sol";

///@dev Only use this directly for perpetual tokens. For threshold tokens, use BehodlerTokenProxy
contract TokenProxyBase is ERC20 {
  using RedeemableMaths for uint256;
  using SafeERC20 for IERC20;
  bool public constant IS_PROXY = true;
  address public immutable proxyRegistry;

  address public immutable baseToken;

  /**
  @notice Setting below ONE will amplify the baseToken amount. 
  For instance, set to 1e6 for USDC but 1e18 for WETH
  */
  uint256 public immutable initialRedeemRate;

  ///@dev Proxy Tokens must all be 18 decimal places, regardless of base token
  uint256 public constant ONE = 1e18;

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
   if R_amp > ONE, marginal redeem rate increases, meaning 
   you get less proxy for every unit of baseToken added 
   */
  function mint(
    uint256 R_amp,
    address proxyRecipient,
    address baseSource,
    uint256 amount,
    uint256 existingRedeemRate
  ) internal returns (uint256 proxy) {
    uint256 marginalRedeemRate = ((existingRedeemRate > 0 ? existingRedeemRate : redeemRate()) * R_amp) / ONE;
    uint256 balanceBefore = IERC20(baseToken).balanceOf(address(this));

    IERC20(baseToken).safeTransferFrom(baseSource, address(this), amount);
    uint256 baseAmount = IERC20(baseToken).balanceOf(address(this)) - balanceBefore;
    proxy = baseAmount.toProxy(marginalRedeemRate);
    _mint(proxyRecipient, proxy);
  }

  ///@notice public facing mint for PyroToken usage
  function mint(
    address proxyRecipient,
    address baseSource,
    uint256 amount
  ) public virtual returns (uint256 proxy) {
    uint256 _redeemRate = redeemRate();
    uint256 balanceBefore = IERC20(baseToken).balanceOf(address(this));
    IERC20(baseToken).safeTransferFrom(baseSource, address(this), amount);
    uint256 baseAmount = IERC20(baseToken).balanceOf(address(this)) - balanceBefore;
    proxy = baseAmount.toProxy(_redeemRate);
    _mint(proxyRecipient, proxy);
  }

  function redeem(
    address proxySource,
    address baseRecipient,
    uint256 amount
  ) public returns (uint256 baseAmount) {
    uint256 _redeemRate = redeemRate();
    _burn(proxySource, amount);
    baseAmount = amount.toBase(_redeemRate);
    IERC20(baseToken).safeTransfer(baseRecipient, baseAmount);
  }

  function redeemRate() public view returns (uint256) {
    uint256 balanceOfBase = IERC20(baseToken).balanceOf(address(this));
    if (totalSupply() == 0 || balanceOfBase == 0) return initialRedeemRate;

    return (balanceOfBase * ONE) / totalSupply();
  }

  function migrateBaseReserveToNewProxy(address newProxy) public onlyRegistry {
    IERC20 base = IERC20(baseToken);
    base.transfer(newProxy, base.balanceOf(address(this)));
  }

  function withdrawReserve() public onlyRegistry {
    IERC20(baseToken).safeTransfer(msg.sender, IERC20(baseToken).balanceOf(address(this)));
  }
}
