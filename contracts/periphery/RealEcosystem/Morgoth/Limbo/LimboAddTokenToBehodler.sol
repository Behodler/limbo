// SPDX-License-Identifier: MIT
pragma solidity ^0.7.1;
import "./IdempotentPowerInvoker.sol";
import "../facades/BehodlerLike.sol";
import "../behodlerPowers/ConfigureScarcityPower.sol";

contract LimboAddTokenToBehodler is IdempotentPowerInvoker {
  struct Parameters {
    address soul;
    bool burnable;
    address limbo;
  }

  Parameters public params;
  ConfigureScarcityPower public configureScarcityPower;

  constructor(
    address _angband,
    address limbo,
    address configSCXPower
  ) IdempotentPowerInvoker("ADD_TOKEN_TO_BEHODLER", _angband) {
    params.limbo = limbo;
    configureScarcityPower = ConfigureScarcityPower(configSCXPower);
  }

  function parameterize(address soul, bool burnable) public {
    require(msg.sender == params.limbo, "MORGOTH: Only Limbo can migrate tokens from Limbo.");
    params.soul = soul;
    params.burnable = burnable;
  }

  function orchestrate() internal override returns (bool) {
    address _lachesis = angband.getAddress(power.domain);
    address behodler = angband.getAddress("BEHODLER");
    (uint256 transferFee, uint256 burnFee, address destination) = Behodler_071Like(behodler).config();
    //temp set pyro fee to zero so that the whole amount goes into Behodler
    configureScarcityPower.parameterize(transferFee, 0, destination);
    angband.executePower(address(configureScarcityPower));

    require(params.soul != address(0), "MORGOTH: PowerInvoker not parameterized.");
    Lachesis_071Like lachesis = Lachesis_071Like(_lachesis);
    lachesis.measure(params.soul, true, params.burnable);
    lachesis.updateBehodler(params.soul);
    uint256 balanceOfToken = IERC20_071(params.soul).balanceOf(address(this));
    require(balanceOfToken > 0, "MORGOTH: remember to seed contract");
    IERC20_071(params.soul).approve(behodler, uint256(-1));
    Behodler_071Like(behodler).addLiquidity(params.soul, balanceOfToken);
    uint256 scxBal = IERC20_071(behodler).balanceOf(address(this));
    uint256 balanceOfTokenOnBehodler = IERC20_071(params.soul).balanceOf(behodler);
    IERC20_071(behodler).transfer(params.limbo, scxBal);
    params.soul = address(0); // prevent non limbo from executing.
    configureScarcityPower.parameterize(transferFee, burnFee, destination);
    angband.executePower(address(configureScarcityPower));
    return true;
  }
}
