// SPDX-License-Identifier: MIT
pragma solidity ^0.7.1;
import "../Powers.sol";
import "../facades/LachesisLike.sol";
import "../openzeppelin/IERC20.sol";
import "../facades/BehodlerLike.sol";
import "../facades/LiquidityReceiverNewLike.sol";

contract AddTokenAndValueToBehodlerPower is PowerInvoker, Empowered {
  address token;
  bool burnable;
  address rewardContract;
  address liquidityReceiverPower;

  constructor(
    address _token,
    bool _burnable,
    address _angband,
    address _rewardContract,
    address _liquidityReceiverPower
  ) PowerInvoker("ADD_TOKEN_TO_BEHODLER", _angband) {
    token = _token;
    burnable = _burnable;
    rewardContract = _rewardContract;
    liquidityReceiverPower = _liquidityReceiverPower;
  }

  function orchestrate() internal override returns (bool) {
    address _lachesis = angband.getAddress(power.domain);
    address behodler = angband.getAddress("BEHODLER");
    LachesisLike_071 lachesis = LachesisLike_071(_lachesis);
    lachesis.measure(token, true, burnable);
    lachesis.updateBehodler(token);
    angband.executePower(liquidityReceiverPower);
    uint256 balanceOfToken = IERC20_071(token).balanceOf(address(this));
    require(balanceOfToken > 0, "remember to seed contract");
    IERC20_071(token).approve(behodler, uint256(-1));
    Behodler_071Like(behodler).addLiquidity(token, balanceOfToken);
    uint256 scxBal = IERC20_071(behodler).balanceOf(address(this));
    IERC20_071(behodler).transfer(rewardContract, scxBal);
    return true;
  }
}
