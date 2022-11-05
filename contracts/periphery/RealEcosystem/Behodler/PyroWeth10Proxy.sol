// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;
import "../../../openzeppelin/IERC20.sol";
import "../../../openzeppelin/Ownable.sol";
import "./WETH10.sol";
import "./Pyrotoken.sol";
import "./Pyrotoken.sol";

abstract contract MintRedeem {
  function redeem(uint256 pyroTokenAmount) external virtual returns (uint256);

  function mint(uint256 baseTokenAmount) external payable virtual returns (uint256);

  function redeemRate() public view virtual returns (uint256);
}

contract PyroWeth10Proxy is Ownable, MintRedeem {
  // address public baseToken;
  IWETH10 public weth10;
  uint256 constant ONE = 1e18;
  bool unlocked = true;
  address baseToken;
  modifier reentrancyGuard() {
    require(unlocked, "PyroProxy: reentrancy guard active");
    unlocked = false;
    _;
    unlocked = true;
  }

  constructor(address pyroWeth) {
    baseToken = pyroWeth;
    weth10 = IWETH10(Pyrotoken(baseToken).baseToken());
    IERC20(weth10).approve(baseToken, type(uint256).max);
  }

  function balanceOf(address holder) external view returns (uint256) {
    return IERC20(baseToken).balanceOf(holder);
  }

  function redeem(uint256 pyroTokenAmount) external override reentrancyGuard returns (uint256) {
    IERC20(baseToken).transferFrom(msg.sender, address(this), pyroTokenAmount); //0.1% fee
    uint256 actualAmount = IERC20(baseToken).balanceOf(address(this));
    Pyrotoken(baseToken).redeem(actualAmount);
    uint256 balanceOfWeth = weth10.balanceOf(address(this));
    weth10.withdrawTo(payable(msg.sender), balanceOfWeth);
    return balanceOfWeth;
  }

  function mint(uint256 baseTokenAmount) external payable override reentrancyGuard returns (uint256) {
    require(msg.value == baseTokenAmount && baseTokenAmount > 0, "PyroWethProxy: amount invariant");
    weth10.deposit{value: msg.value}();
    uint256 weth10Balance = weth10.balanceOf(address(this));
    Pyrotoken(baseToken).mint(weth10Balance);
    uint256 pyroWethBalance = IERC20(baseToken).balanceOf(address(this));
    IERC20(baseToken).transfer(msg.sender, pyroWethBalance);
    return (pyroWethBalance * 999) / 1000; //0.1% fee
  }

  function calculateMintedPyroWeth(uint256 baseTokenAmount) external view returns (uint256) {
    uint256 pyroTokenRedeemRate = Pyrotoken(baseToken).redeemRate();
    uint256 mintedPyroTokens = (baseTokenAmount * ONE) / (pyroTokenRedeemRate);
    return (mintedPyroTokens * 999) / 1000; //0.1% fee
  }

  function calculateRedeemedWeth(uint256 pyroTokenAmount) external view returns (uint256) {
    uint256 pyroTokenSupply = IERC20(baseToken).totalSupply() - ((pyroTokenAmount * 1) / 1000);
    uint256 wethBalance = IERC20(weth10).balanceOf(baseToken);
    uint256 newRedeemRate = (wethBalance * ONE) / pyroTokenSupply;
    uint256 newPyroTokenbalance = (pyroTokenAmount * 999) / 1000;
    uint256 fee = (newPyroTokenbalance * 2) / 100;
    uint256 net = newPyroTokenbalance - fee;
    return (net * newRedeemRate) / ONE;
  }

  function redeemRate() public view override returns (uint256) {
    return Pyrotoken(baseToken).redeemRate();
  }
}
