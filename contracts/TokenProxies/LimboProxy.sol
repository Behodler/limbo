// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;
import "./TokenProxyBase.sol";
import "../facades/LimboLike.sol";
import "../openzeppelin/SafeERC20.sol";

///@author Justin Goro
///@title Limbo Token Proxy
///@dev normalizes the behaviour of FOT and rebase tokens so that Limbo can focus on logic
contract LimboProxy is TokenProxyBase {
  using SafeERC20 for IERC20;
  LimboLike limbo;
  IERC20 flan;

  constructor(
    address _baseToken,
    string memory name_,
    string memory symbol_,
    address registry,
    address _limbo,
    address _flan,
    uint256 initialRedeemRate
  ) TokenProxyBase(_baseToken, name_, symbol_, registry, initialRedeemRate) {
    limbo = LimboLike(_limbo);
    flan = IERC20(_flan);
  }

  function approveLimbo() public {
    IERC20(address(this)).safeApprove(address(limbo), type(uint256).max);
  }

  function stake(uint256 amount) public {
    uint256 minted = mint(initialRedeemRate, address(this), msg.sender, amount);
    limbo.stakeFor(address(this), minted, msg.sender);
  }

  function unstake(uint256 amount, uint index) public {
    limbo.unstakeFor(address(this), amount, msg.sender,index);
    redeem(address(this), msg.sender, amount);
    flan.safeTransfer(msg.sender, flan.balanceOf(address(this)));
  }
}
