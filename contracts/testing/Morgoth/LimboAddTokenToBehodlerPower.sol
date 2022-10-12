// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;
import "../../openzeppelin/IERC20.sol";
import "../../facades/AngbandLike.sol";
import "../../openzeppelin/Ownable.sol";

import "../../facades/LachesisLike.sol";
interface IBehodler is IERC20 {
  function addLiquidity(address inputToken, uint256 amount) external payable returns (uint256 deltaSCX);

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

contract LimboAddTokenToBehodlerTestNet {
  event PowerInvoked(address user, bytes32 minion, bytes32 domain);

  struct Parameters {
    address soul;
    bool burnable;
    address limbo;
  }

  struct Config {
    address behodler;
    address lachesis;
    address angband;
  }

  Parameters public params;
  Config config;

  constructor(
    address angband,
    address behodler,
    address lachesis,
    address limbo
  ) {
    params.limbo = limbo;
    config.angband = angband;
    config.lachesis = lachesis;
    config.behodler = behodler;
  }

  function parameterize(address soul, bool burnable) public {
    require(msg.sender == params.limbo, "MORGOTH: Only Limbo can migrate tokens from Limbo.");
    params.soul = soul;
    params.burnable = burnable;
  }

  function invoke(bytes32 minion, address sender) public {
    require(msg.sender == address(config.angband), "MORGOTH: angband only");
    require(orchestrate(), "MORGOTH: Power invocation");
    emit PowerInvoked(sender, minion, "domain");
  }

  function orchestrate() internal returns (bool) {
    require(params.soul != address(0), "MORGOTH: PowerInvoker not parameterized.");
    LachesisLike lachesis = LachesisLike(config.lachesis);
    lachesis.measure(params.soul, true, params.burnable);
    lachesis.updateBehodler(params.soul);
    uint256 balanceOfToken = IERC20(params.soul).balanceOf(address(this));
    require(balanceOfToken > 0, "MORGOTH: remember to seed contract");
    IERC20(params.soul).approve(config.behodler, type(uint256).max);
    IBehodler(config.behodler).addLiquidity(params.soul, balanceOfToken);
    uint256 scxBal = IERC20(config.behodler).balanceOf(address(this));
    IERC20(config.behodler).transfer(params.limbo, scxBal);
    params.soul = address(0); // prevent non limbo from executing.
    return true;
  }
}
